/**
 * DEPLOY58 — dre-run-evaluation.ts
 * netlify/functions/dre-run-evaluation.ts
 *
 * Damage Reality Engine — Run Evaluation
 * Full DRE normalization + scoring + damage inference
 * Plus underwater intelligence extension when underwater profile exists
 *
 * POST { damage_case_id, org_id }
 *
 * CONSTRAINT: String concatenation only — no backtick template literals
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/* ========================================================================
   EVENT CATEGORY INFERENCE (duplicated from intake for independence)
   ======================================================================== */

var EVENT_KEYWORDS: Array<{ category: string; terms: string[] }> = [
  { category: "wind", terms: ["wind", "gust", "hurricane", "tornado", "storm wind"] },
  { category: "wave_surge", terms: ["wave", "surge", "current", "sea state", "swell", "splash zone"] },
  { category: "rain_flood", terms: ["rain", "flood", "inundation", "water intrusion", "washout"] },
  { category: "extreme_heat", terms: ["extreme heat", "overheated", "high temperature", "thermal exposure"] },
  { category: "extreme_cold", terms: ["freeze", "cold", "cold snap", "low temperature"] },
  { category: "hail_ice_snow", terms: ["hail", "ice", "snow", "freezing rain"] },
  { category: "earthquake_ground_movement", terms: ["earthquake", "subsidence", "settlement", "ground movement"] },
  { category: "lightning_electrical", terms: ["lightning", "electrical strike", "power surge", "arc flash"] },
  { category: "impact", terms: ["impact", "hit", "struck", "collision", "anchor drag", "dropped object", "tree fell"] },
  { category: "fire_blast", terms: ["fire", "blast", "explosion", "overpressure", "flash fire"] },
];

function textHasAny(text: string, terms: string[]): boolean {
  var lower = text.toLowerCase();
  for (var i = 0; i < terms.length; i++) {
    if (lower.indexOf(terms[i]) !== -1) return true;
  }
  return false;
}

function inferEventCategory(dc: any): string {
  if (dc.event_category) return dc.event_category;
  var narrative = dc.narrative || "";
  var matched: string[] = [];
  for (var i = 0; i < EVENT_KEYWORDS.length; i++) {
    if (textHasAny(narrative, EVENT_KEYWORDS[i].terms)) matched.push(EVENT_KEYWORDS[i].category);
  }
  if (matched.length > 1) return "multi_factor";
  if (matched.length === 1) return matched[0];
  if ((dc.wind_mph || 0) > 0 && (dc.wave_height_ft || 0) > 0) return "multi_factor";
  if ((dc.wind_mph || 0) > 0) return "wind";
  if ((dc.wave_height_ft || 0) > 0 || (dc.current_speed_kts || 0) > 0) return "wave_surge";
  if ((dc.rainfall_inches || 0) > 0 || (dc.flood_depth_ft || 0) > 0) return "rain_flood";
  if ((dc.high_temp_f || 0) > 110) return "extreme_heat";
  if ((dc.low_temp_f || 999) < 32) return "extreme_cold";
  if ((dc.hail_size_in || 0) > 0) return "hail_ice_snow";
  if ((dc.seismic_magnitude || 0) > 0) return "earthquake_ground_movement";
  if (dc.impact_object || (dc.impact_speed_mph || 0) > 0) return "impact";
  if (dc.fire_exposure) return "fire_blast";
  return "multi_factor";
}

/* ========================================================================
   DRE NORMALIZATION
   ======================================================================== */

function normalizeDRE(dc: any, asset: any): any {
  var sf: string[] = [];
  var ic: string[] = [];
  var hd: string[] = [];
  var az: string[] = [];
  var mi: string[] = [];
  var assumptions: string[] = [];
  var nv: any = {};
  var intake = dc.intake_path;
  var eventCat: string | null = null;
  var findingCat: string | null = null;
  var multi = false;

  if (intake === "event_driven") {
    eventCat = inferEventCategory(dc);
    multi = eventCat === "multi_factor";
    nv.event_category = eventCat;
    nv.wind_mph = dc.wind_mph; nv.wave_height_ft = dc.wave_height_ft;
    nv.flood_depth_ft = dc.flood_depth_ft; nv.seismic_magnitude = dc.seismic_magnitude;
    nv.impact_speed_mph = dc.impact_speed_mph; nv.debris_present = dc.debris_present === true;
    nv.fire_exposure = dc.fire_exposure === true;

    if (eventCat === "wind" || multi) {
      if (dc.wind_mph == null) mi.push("wind_mph");
      if ((dc.wind_mph || 0) >= 50) sf.push("elevated_wind_loading");
      if ((dc.wind_mph || 0) >= 74) sf.push("hurricane_force_loading");
      if (dc.debris_present) sf.push("wind_borne_debris");
      az.push("windward_side"); az.push("attachments"); az.push("connections");
      ic.push("lateral_loading");
      hd.push("connection_fatigue_beyond_visual");
    }
    if (eventCat === "wave_surge" || multi) {
      if (dc.wave_height_ft == null && dc.current_speed_kts == null) mi.push("wave_height_ft_or_current_speed_kts");
      if ((dc.wave_height_ft || 0) >= 10) sf.push("high_wave_loading");
      if ((dc.wave_height_ft || 0) >= 20) sf.push("extreme_wave_loading");
      az.push("splash_zone"); az.push("brace_nodes"); az.push("subsea_transitions");
      ic.push("cyclic_hydrodynamic_loading");
      hd.push("subsurface_or_obscured_joint_damage");
    }
    if (eventCat === "rain_flood" || multi) {
      if (dc.rainfall_inches == null && dc.flood_depth_ft == null) mi.push("rainfall_or_flood_depth");
      if ((dc.flood_depth_ft || 0) >= 1) sf.push("equipment_inundation");
      az.push("low_points"); az.push("supports"); az.push("skirt_bases");
      ic.push("water_intrusion"); hd.push("hidden_wetting_and_corrosion_progression");
    }
    if (eventCat === "extreme_heat") {
      if (dc.high_temp_f == null) mi.push("high_temp_f");
      az.push("restrained_areas"); ic.push("thermal_expansion_stress");
      hd.push("distortion_or_property_change");
    }
    if (eventCat === "extreme_cold") {
      if (dc.low_temp_f == null) mi.push("low_temp_f");
      az.push("weld_toes"); az.push("restraint_points");
      ic.push("thermal_contraction"); hd.push("brittle_fracture_initiation");
    }
    if (eventCat === "impact" || multi) {
      if (!dc.known_impact_point) mi.push("known_impact_point");
      az.push("direct_impact_zone"); az.push("adjacent_load_paths"); az.push("attachments_near_impact");
      ic.push("localized_yielding_possible"); hd.push("backside_or_secondary_load_path_damage");
    }
    if (eventCat === "earthquake_ground_movement") {
      az.push("anchors"); az.push("supports"); az.push("nozzles");
      hd.push("alignment_shift_beyond_obvious_visual");
    }
    if (eventCat === "fire_blast" || dc.fire_exposure) {
      az.push("thermally_exposed_surfaces"); az.push("pressure_boundary");
      hd.push("metallurgical_change"); hd.push("geometry_change");
    }
  }

  if (intake === "condition_driven") {
    findingCat = dc.finding_category || "unknown_condition";
    nv.finding_category = findingCat;
    nv.finding_source = dc.finding_source;
    nv.visibility_condition = dc.visibility_condition;

    if (!dc.finding_source) mi.push("finding_source");
    if (!dc.location_context) mi.push("location_context");

    if (dc.marine_growth_present) { sf.push("visual_obstruction_present"); hd.push("true_condition_may_be_worse_beneath_growth"); }
    if (dc.visibility_condition === "poor") { sf.push("low_visibility_observation"); hd.push("observation_confidence_reduced"); }
    if (!dc.cleaning_performed && (dc.marine_growth_present || findingCat === "corrosion")) {
      hd.push("surface_condition_not_fully_characterized");
    }

    if (findingCat === "corrosion") { sf.push("corrosion_finding"); ic.push("active_section_loss_possible"); hd.push("broader_metal_loss_than_visible"); az.push("primary_finding_location"); }
    if (findingCat === "crack_indication") { sf.push("crack_like_finding"); ic.push("fracture_or_fatigue_possible"); hd.push("crack_growth_under_service"); az.push("crack_origin_zone"); az.push("welded_transition_zone"); }
    if (findingCat === "dent_gouge_impact") { sf.push("local_deformation_finding"); hd.push("backside_damage_or_coating_disbondment"); az.push("deformed_zone"); }
    if (findingCat === "coating_failure") { sf.push("coating_barrier_loss"); hd.push("subfilm_corrosion"); az.push("coating_failure_zone"); }
    if (findingCat === "section_loss") { sf.push("wall_loss_finding"); hd.push("remaining_ligament_unknown"); az.push("thinned_region"); }
    if (findingCat === "leak_or_staining") { sf.push("leak_evidence"); hd.push("active_damage_not_bounded"); az.push("leak_origin_zone"); }
    if (findingCat === "support_distress") { sf.push("support_concern"); hd.push("secondary_member_overstress"); az.push("support_zone"); }
    if (findingCat === "marine_growth_obscured_condition") { sf.push("obscured_condition"); hd.push("critical_damage_may_be_hidden"); az.push("obscured_zone"); }
    if (findingCat === "cui_suspected") { sf.push("cui_risk"); hd.push("damage_extent_may_extend_beyond_visual"); az.push("insulated_zone"); }
    if (findingCat === "anode_or_cp_issue") { sf.push("cp_concern"); hd.push("accelerated_corrosion_progression"); az.push("cp_protected_zone"); }
    if (findingCat === "deformation") { sf.push("geometry_change"); hd.push("stress_redistribution"); az.push("deformed_geometry_zone"); }
  }

  if (asset.corrosion_history) sf.push("prior_corrosion_history");
  if (asset.fatigue_history) sf.push("prior_fatigue_history");
  if (asset.prior_repairs) sf.push("prior_repairs_present");
  if (asset.leak_history) sf.push("prior_leak_history");
  if (asset.coating_condition === "poor" || asset.coating_condition === "failed") sf.push("coating_degraded");
  if (asset.insulation_present) ic.push("hidden_damage_under_insulation_possible");

  return {
    intake_path: intake,
    event_category: eventCat,
    finding_category: findingCat,
    multi_factor: multi,
    severity_factors: sf,
    inferred_conditions: ic,
    hidden_damage_drivers: hd,
    affected_zones: az,
    missing_critical_inputs: mi,
    assumptions: assumptions,
    normalized_values: nv,
  };
}

/* ========================================================================
   DRE DAMAGE INFERENCE (mechanisms, failure modes, methods)
   ======================================================================== */

function inferDamage(dc: any, asset: any, norm: any): any {
  var mech: string[] = [];
  var fail: string[] = [];
  var comp: string[] = [];
  var zones: string[] = (norm.affected_zones || []).slice();
  var rat: string[] = [];
  var methods: Array<{ method: string; reason: string; priority: number }> = [];
  var addM = function(m: string, r: string, p: number) { methods.push({ method: m, reason: r, priority: p }); };

  if (norm.intake_path === "event_driven") {
    var ec = norm.event_category;
    if (ec === "wind" || ec === "multi_factor") {
      mech.push("lateral_overstress"); mech.push("vibration_fatigue");
      fail.push("connection_cracking"); comp.push("connections"); comp.push("attachments");
      rat.push("Wind events elevate lateral loading, vibration, and connection fatigue risk.");
      addM("VT", "Map visible damage and loose components.", 1);
      addM("Drone VT", "Quick review of exposed or inaccessible elevations.", 1);
      addM("MT", "Surface crack screening at ferromagnetic welded connections.", 2);
    }
    if (ec === "wave_surge" || (ec === "multi_factor" && (dc.wave_height_ft || 0) > 0)) {
      mech.push("cyclic_hydrodynamic_loading"); mech.push("debris_impact");
      fail.push("brace_fatigue_cracking"); comp.push("brace_nodes"); comp.push("splash_zone_members");
      rat.push("Wave and surge events concentrate risk in splash zone and cyclically loaded members.");
      addM("ROV VT", "Overview before direct subsea or diver access.", 1);
      addM("UT", "Assess suspect member wall or localized condition.", 2);
      addM("PAUT", "Characterize complex fatigue-sensitive welded joints.", 2);
    }
    if (ec === "rain_flood" || (ec === "multi_factor" && ((dc.flood_depth_ft || 0) > 0 || (dc.rainfall_inches || 0) > 0))) {
      mech.push("water_intrusion"); mech.push("corrosion_acceleration");
      if (asset.insulation_present) mech.push("cui_risk");
      fail.push("support_instability"); comp.push("supports"); comp.push("low_points");
      rat.push("Flooding increases hidden wetting, corrosion progression, and support risk.");
      addM("VT", "Identify wetting, staining, support distress, and coating damage.", 1);
      addM("UT", "Thickness screening in corrosion-prone areas.", 2);
      addM("CUI Screening", "Insulated systems may hide active damage.", 2);
    }
    if (ec === "extreme_heat") {
      mech.push("thermal_expansion_stress"); fail.push("distortion"); comp.push("restrained_areas");
      rat.push("Heat exposure can change geometry and damage coatings or materials.");
      addM("Geometry Survey", "Check for movement or distortion first.", 1);
      addM("VT", "Document obvious heat effects and coating breakdown.", 1);
      addM("PT", "Surface crack screening where appropriate.", 2);
    }
    if (ec === "extreme_cold") {
      mech.push("thermal_contraction"); mech.push("brittle_fracture_susceptibility");
      fail.push("weld_toe_cracking"); comp.push("welded_connections");
      rat.push("Extreme cold raises brittle fracture concern at notches and weld transitions.");
      addM("VT", "Map visible cracks or leakage indicators first.", 1);
      addM("MT", "Efficient crack screening at ferromagnetic weld zones.", 1);
      addM("PT", "Alternative surface crack screening.", 2);
      addM("UT", "Evaluate suspect sections beyond visual signs.", 2);
    }
    if (ec === "impact") {
      mech.push("localized_yielding"); mech.push("stress_redistribution");
      fail.push("denting"); fail.push("buckling"); fail.push("weld_toe_cracking");
      comp.push("direct_impact_zone"); comp.push("adjacent_members");
      rat.push("Impact damage often extends beyond the visible strike zone.");
      addM("VT", "Map strike pattern, denting, and visible deformation.", 1);
      addM("Geometry Survey", "Determine alignment change or displacement.", 1);
      addM("MT", "Screen welded zones adjacent to impact.", 2);
      addM("UT", "Check local wall or hidden damage suspicion.", 2);
    }
    if (ec === "earthquake_ground_movement") {
      mech.push("anchor_distress"); mech.push("support_misalignment");
      fail.push("support_cracking"); comp.push("anchors"); comp.push("supports"); comp.push("nozzles");
      rat.push("Ground movement often first appears in supports, anchors, and alignment.");
      addM("Geometry Survey", "Confirm displacement before localized testing.", 1);
      addM("VT", "Inspect anchors, supports, and nozzles.", 1);
      addM("MT", "Crack screening at welded support regions.", 2);
    }
    if (ec === "fire_blast") {
      mech.push("thermal_degradation"); mech.push("geometry_change"); mech.push("overpressure_loading");
      fail.push("connection_overstress"); comp.push("pressure_boundary"); comp.push("supports");
      rat.push("Fire and blast can change material behavior and geometry.");
      addM("Geometry Survey", "Confirm shape and alignment stability first.", 1);
      addM("VT", "Check discoloration, distortion, and obvious damage.", 1);
      addM("UT", "Assess suspect sections after triage.", 2);
      addM("PT", "Screen accessible surfaces for cracking.", 2);
    }
    if (ec === "lightning_electrical") {
      mech.push("localized_thermal_damage"); fail.push("burn_damage");
      comp.push("grounding_points");
      rat.push("Electrical events can damage strike paths and undermine sensor trustworthiness.");
      addM("VT", "Identify strike-path evidence and local damage.", 1);
      addM("PT", "Screen suspect local surfaces where appropriate.", 2);
    }
  }

  if (norm.intake_path === "condition_driven") {
    var fc = norm.finding_category;
    if (fc === "corrosion") {
      mech.push("active_corrosion"); mech.push("section_loss_progression");
      fail.push("remaining_strength_reduction"); comp.push("corroded_member");
      rat.push("Visible corrosion often underestimates the true affected area.");
      addM("VT", "Map visible corrosion extent and surrounding condition.", 1);
      addM("Thickness Mapping", "Determine actual metal loss over area.", 1);
      addM("UT", "Quantify remaining wall or thickness.", 2);
    }
    if (fc === "crack_indication") {
      mech.push("fatigue_cracking"); mech.push("fracture_propagation");
      fail.push("crack_growth_under_load"); comp.push("cracked_connection");
      rat.push("Crack indications in loaded welded regions require elevated urgency.");
      addM("VT", "Map location, orientation, and relation to weld geometry.", 1);
      addM("MT", "Best first crack screening for ferromagnetic surfaces.", 1);
      addM("PT", "Alternative crack screening for non-ferromagnetic materials.", 1);
      addM("PAUT", "Further characterize crack depth and extent.", 2);
    }
    if (fc === "dent_gouge_impact") {
      mech.push("local_plastic_deformation"); mech.push("coating_disbondment");
      fail.push("stress_concentration"); comp.push("deformed_member");
      rat.push("Dents and gouges are not cosmetic by default on structural or pressure-retaining assets.");
      addM("VT", "Map visible geometry changes and strike evidence.", 1);
      addM("Profile Measurement", "Measure depth and profile of dent or gouge.", 1);
      addM("Geometry Survey", "Assess misalignment or broader deformation.", 2);
      addM("UT", "Check local wall and adjacent suspect area.", 2);
    }
    if (fc === "coating_failure") {
      mech.push("barrier_loss"); mech.push("external_corrosion_acceleration");
      fail.push("subfilm_corrosion"); comp.push("coating_failed_area");
      rat.push("Coating failure is often a leading indicator, not the final condition state.");
      addM("VT", "Map coating breakdown and edges of spread.", 1);
      addM("Cleaning + Reinspect", "Expose true substrate condition.", 1);
      addM("UT", "Check for associated local loss if corrosion suspected.", 2);
    }
    if (fc === "section_loss") {
      mech.push("strength_reduction"); fail.push("overstress_of_thinned_section");
      comp.push("thinned_section");
      rat.push("Section loss findings must be bounded spatially before risk is trusted.");
      addM("Thickness Mapping", "Map extent and minimum remaining thickness.", 1);
      addM("UT", "Confirm remaining thickness values.", 1);
      addM("VT", "Correlate wall loss with nearby visual damage features.", 2);
    }
    if (fc === "leak_or_staining") {
      mech.push("through_wall_or_seal_failure"); fail.push("loss_of_containment");
      comp.push("leak_origin_zone");
      rat.push("Leak evidence means the condition may already be active.");
      addM("VT", "Locate source and surrounding damage indicators.", 1);
      addM("UT", "Check wall condition and adjacent damage zones.", 1);
      addM("PT", "Surface crack screening at source-related areas.", 2);
    }
    if (fc === "support_distress") {
      mech.push("load_path_change"); fail.push("misalignment"); fail.push("support_failure");
      comp.push("support_member");
      rat.push("Support distress changes system loading and can shift damage into nearby transitions.");
      addM("Geometry Survey", "Assess alignment and support displacement first.", 1);
      addM("VT", "Inspect connections, supports, and transitions.", 1);
      addM("MT", "Screen welded support regions for cracking.", 2);
    }
    if (fc === "marine_growth_obscured_condition") {
      mech.push("obscured_damage"); fail.push("missed_critical_damage");
      comp.push("obscured_subsea_surface");
      rat.push("Marine growth reduces visual reliability and can conceal significant damage.");
      addM("Cleaning + Reinspect", "Expose actual surface before confidence is granted.", 1);
      addM("ROV VT", "Overview of surrounding subsea area.", 1);
      addM("UT", "Check local condition if section loss suspected.", 2);
    }
    if (fc === "cui_suspected") {
      mech.push("hidden_external_corrosion"); fail.push("localized_wall_loss");
      comp.push("insulated_component");
      rat.push("CUI findings are often spatially larger than early visible clues suggest.");
      addM("CUI Screening", "Primary path for hidden under-insulation degradation.", 1);
      addM("UT", "Check suspect wall after screening identifies hotspots.", 2);
      addM("VT", "Correlate external clues near supports, saddles, and seams.", 2);
    }
    if (fc === "anode_or_cp_issue") {
      mech.push("protection_system_degradation"); fail.push("marine_corrosion_progression");
      comp.push("cp_protected_member");
      rat.push("Loss of CP effectiveness can change corrosion progression.");
      addM("ROV VT", "Review surrounding condition and CP-related components.", 1);
      addM("Thickness Mapping", "Determine whether corrosion progression already exists.", 2);
      addM("UT", "Quantify remaining wall in suspect areas.", 2);
    }
    if (fc === "deformation") {
      mech.push("geometry_change"); mech.push("yielding_or_overstress");
      fail.push("load_redistribution"); comp.push("deformed_component");
      rat.push("Deformation findings must be treated as load-path changes until proven otherwise.");
      addM("Geometry Survey", "Primary method to quantify shape and alignment change.", 1);
      addM("VT", "Map visible distortion and connected regions.", 1);
      addM("UT", "Assess suspect local wall or secondary impact areas.", 2);
    }
    if (fc === "unknown_condition") {
      mech.push("condition_not_fully_characterized"); fail.push("unknown_damage_progression");
      comp.push("reported_zone");
      rat.push("Unknown findings should not be treated as low-risk merely because they are not classified yet.");
      addM("VT", "Start with basic mapping and evidence collection.", 1);
    }
  }

  if (asset.corrosion_history) { mech.push("pre_existing_corrosion_amplification"); rat.push("Known corrosion history amplifies present damage concern."); }
  if (asset.fatigue_history) { mech.push("pre_existing_fatigue_amplification"); rat.push("Known fatigue history increases crack-related risk."); }
  if (asset.prior_repairs) { comp.push("repaired_areas"); rat.push("Repaired areas should be treated as priority review zones."); }

  /* dedup methods */
  var seen: Record<string, boolean> = {};
  var dedupMethods: Array<{ method: string; reason: string; priority: number }> = [];
  for (var i = 0; i < methods.length; i++) {
    var k = methods[i].method + "-" + methods[i].priority;
    if (!seen[k]) { seen[k] = true; dedupMethods.push(methods[i]); }
  }
  dedupMethods.sort(function(a, b) { return a.priority - b.priority; });

  return { mechanisms: mech, failureModes: fail, components: comp, zones: zones, methods: dedupMethods, rationale: rat };
}

/* ========================================================================
   DRE SCORING
   ======================================================================== */

function weightConsequence(cc: string): number {
  if (cc === "low") return 20;
  if (cc === "medium") return 45;
  if (cc === "high") return 70;
  if (cc === "critical") return 90;
  return 45;
}

function scoreDRE(dc: any, asset: any, norm: any, inferred: any): any {
  var evS = 0; var condS = 0; var hidS = 20; var dmgS = 20; var urgS = 20;
  var consS = weightConsequence(asset.consequence_class || "medium");

  if (norm.intake_path === "event_driven") {
    if ((dc.wind_mph || 0) >= 50) { evS += 12; dmgS += 8; }
    if ((dc.wind_mph || 0) >= 74) { evS += 16; urgS += 10; hidS += 6; }
    if ((dc.wave_height_ft || 0) >= 10) { evS += 12; dmgS += 10; hidS += 6; }
    if ((dc.wave_height_ft || 0) >= 20) { evS += 18; urgS += 12; hidS += 8; }
    if ((dc.current_speed_kts || 0) >= 3) { evS += 8; dmgS += 8; }
    if ((dc.flood_depth_ft || 0) >= 1) { evS += 10; dmgS += 8; hidS += 8; }
    if ((dc.flood_depth_ft || 0) >= 3) { evS += 16; urgS += 8; }
    if ((dc.high_temp_f || 0) >= 120) { evS += 12; dmgS += 8; hidS += 6; }
    if ((dc.low_temp_f || 999) <= 32) { evS += 12; dmgS += 10; }
    if ((dc.low_temp_f || 999) <= 0) { evS += 10; urgS += 10; hidS += 6; }
    if ((dc.seismic_magnitude || 0) >= 4) { evS += 18; dmgS += 12; urgS += 10; hidS += 6; }
    if ((dc.impact_speed_mph || 0) >= 10) { evS += 12; dmgS += 12; hidS += 10; }
    if ((dc.impact_speed_mph || 0) >= 25) { evS += 18; dmgS += 15; urgS += 12; hidS += 12; }
    if (dc.debris_present) { dmgS += 8; urgS += 6; hidS += 6; }
    if (dc.fire_exposure) { evS += 16; dmgS += 14; urgS += 12; hidS += 8; }
    if (dc.chemical_exposure) { dmgS += 8; hidS += 4; }
    if (dc.power_loss) { urgS += 6; }
    if (norm.multi_factor) { evS += 12; dmgS += 12; urgS += 10; hidS += 10; }
  }

  if (norm.intake_path === "condition_driven") {
    var fc = norm.finding_category;
    if (fc === "corrosion") { condS += 18; dmgS += 16; hidS += 14; }
    if (fc === "crack_indication") { condS += 28; dmgS += 22; urgS += 18; hidS += 12; }
    if (fc === "dent_gouge_impact") { condS += 20; dmgS += 18; hidS += 14; }
    if (fc === "coating_failure") { condS += 12; dmgS += 10; hidS += 12; }
    if (fc === "section_loss") { condS += 24; dmgS += 20; urgS += 12; hidS += 14; }
    if (fc === "leak_or_staining") { condS += 26; dmgS += 24; urgS += 18; hidS += 10; }
    if (fc === "support_distress") { condS += 24; dmgS += 20; urgS += 16; hidS += 12; }
    if (fc === "marine_growth_obscured_condition") { condS += 10; dmgS += 8; hidS += 20; }
    if (fc === "cui_suspected") { condS += 16; dmgS += 14; hidS += 20; }
    if (fc === "anode_or_cp_issue") { condS += 10; dmgS += 12; hidS += 14; }
    if (fc === "deformation") { condS += 22; dmgS += 18; urgS += 10; hidS += 12; }

    if (dc.marine_growth_present) hidS += 10;
    if (dc.visibility_condition === "poor") hidS += 10;
    if (!dc.cleaning_performed && (dc.marine_growth_present || fc === "corrosion")) hidS += 8;
    if (dc.crack_like_indication) urgS += 10;
    if (dc.leak_evidence_present) urgS += 12;
    if (dc.wall_loss_suspected) dmgS += 10;
    if (dc.support_distress_present) urgS += 10;
    if (dc.deformation_present) dmgS += 8;
  }

  if (asset.corrosion_history) dmgS += 8;
  if (asset.fatigue_history) dmgS += 10;
  if (asset.prior_repairs) dmgS += 6;
  if (asset.leak_history) urgS += 6;
  if (asset.coating_condition === "poor") dmgS += 6;
  if (asset.coating_condition === "failed") dmgS += 10;
  var env = asset.environment_type || "";
  if (env === "offshore" || env === "subsea" || env === "splash_zone") dmgS += 6;
  if (asset.insulation_present && norm.finding_category === "cui_suspected") hidS += 8;

  var overall = clamp(
    evS * 0.12 + condS * 0.20 + hidS * 0.18 + dmgS * 0.25 + urgS * 0.10 + consS * 0.15,
    0, 100
  );

  var confPenalty = (norm.missing_critical_inputs || []).length * 6
    + (dc.visibility_condition === "poor" ? 8 : 0)
    + (dc.photo_confidence === "low" ? 8 : 0);
  var confidence = clamp(92 - confPenalty, 0, 100);

  var disp = "continue_normal";
  if (overall >= 25) disp = "targeted_inspection";
  if (overall >= 50) disp = "priority_inspection_required";
  if (overall >= 70) disp = "restricted_operation";
  if (overall >= 80) disp = "inspection_before_return";
  if (overall >= 90) disp = "shutdown_consideration";

  if (norm.finding_category === "crack_indication" && asset.consequence_class !== "low" && overall >= 70) {
    disp = "inspection_before_return";
  }
  if (norm.finding_category === "leak_or_staining" && asset.consequence_class === "critical") {
    disp = "shutdown_consideration";
  }

  var fullRationale = (inferred.rationale || []).concat([
    "Hidden damage likelihood elevated when visibility poor, growth obscures surface, or event implies non-visible damage.",
    "Visual appearance alone cannot close out high-consequence scenarios.",
    "Disposition driven by combined severity, hidden risk, urgency, and consequence class."
  ]);

  return {
    intake_path: norm.intake_path,
    event_severity_score: clamp(evS, 0, 100),
    observed_condition_severity_score: clamp(condS, 0, 100),
    hidden_damage_likelihood_score: clamp(hidS, 0, 100),
    damage_likelihood_score: clamp(dmgS, 0, 100),
    inspection_urgency_score: clamp(urgS, 0, 100),
    consequence_score: clamp(consS, 0, 100),
    overall_damage_risk: clamp(overall, 0, 100),
    confidence_score: confidence,
    operational_disposition: disp,
    probable_damage_mechanisms: inferred.mechanisms,
    likely_failure_modes: inferred.failureModes,
    likely_affected_components: inferred.components,
    prioritized_inspection_zones: inferred.zones,
    recommended_methods: inferred.methods,
    rationale: fullRationale,
    missing_critical_inputs: norm.missing_critical_inputs || [],
    assumptions: norm.assumptions || [],
    engine_version: "damage_reality_engine_v1",
  };
}

/* ========================================================================
   UNDERWATER INTELLIGENCE EXTENSION
   Only runs when underwater_asset_profile exists for this asset
   ======================================================================== */

function classifyWaterType(wt: string): string {
  if (wt.indexOf("saltwater") === 0 || wt === "brackish") return "saltwater";
  if (wt.indexOf("freshwater") === 0 || wt === "potable_water") return "freshwater";
  if (wt.indexOf("nuclear") === 0) return "nuclear";
  return "hazardous";
}

function corrosionSeverity(uwp: any): string {
  var wt = uwp.water_type || "";
  var dz = uwp.primary_depth_zone || "";
  if (dz === "splash_zone") {
    if (wt.indexOf("saltwater") === 0 || wt === "brackish") return "extreme";
    if (wt.indexOf("nuclear") === 0) return "severe";
    return "high";
  }
  if (wt === "saltwater_open_ocean") {
    if (dz === "mudline") return "severe";
    if (dz === "shallow_submerged" || dz === "moderate_submerged") return "severe";
    return "high";
  }
  if (wt === "saltwater_coastal" || wt === "saltwater_harbor") return "high";
  if (wt === "brackish") return "high";
  if (wt === "nuclear_primary_coolant") return "severe";
  if (wt === "nuclear_spent_fuel_pool") return "high";
  if (wt === "hazardous_chemical" || wt === "hazardous_radioactive") return "severe";
  if (wt === "contaminated_industrial") return "high";
  if (wt === "freshwater_treated") return "low";
  if (uwp.stray_current_concern) return "high";
  if (uwp.erosion_zone) return "high";
  return "moderate";
}

function runUnderwaterExtension(baseDRE: any, uwp: any, diveP: any): any {
  var wtClass = classifyWaterType(uwp.water_type || "");
  var corrSev = corrosionSeverity(uwp);
  var dz = uwp.primary_depth_zone || "";

  /* Depth zone modifier */
  var dzMod = 0;
  if (dz === "splash_zone") dzMod = 15;
  else if (dz === "mudline") dzMod = 12;
  else if (dz === "buried") dzMod = 14;
  else if (dz === "deep_submerged") dzMod = 10;
  else if (dz === "deep_saturation") dzMod = 12;
  else if (dz === "moderate_submerged") dzMod = 8;
  else if (dz === "shallow_submerged") dzMod = 6;

  /* Water type corrosion modifier */
  var corrMod = 0;
  if (corrSev === "extreme") corrMod = 18;
  else if (corrSev === "severe") corrMod = 14;
  else if (corrSev === "high") corrMod = 10;
  else if (corrSev === "moderate") corrMod = 5;

  /* Visibility penalty */
  var visPen = 0;
  if (diveP) {
    if (diveP.visibility_rating === "zero") visPen = 20;
    else if (diveP.visibility_rating === "poor") visPen = 14;
    else if (diveP.visibility_rating === "fair") visPen = 8;
    else if (diveP.visibility_ft != null) {
      if (diveP.visibility_ft < 1) visPen = 20;
      else if (diveP.visibility_ft < 3) visPen = 14;
      else if (diveP.visibility_ft < 10) visPen = 8;
    }
  }

  /* Cleaning penalty */
  var cleanPen = 0;
  if (diveP) {
    if (!diveP.cleaning_performed) cleanPen = 14;
    else if (diveP.cleaning_grade === "brush_off" || diveP.cleaning_grade === "observation_only") cleanPen = 8;
    else if (diveP.cleaning_grade === "commercial" || diveP.cleaning_grade === "near_white") cleanPen = 3;
  }

  /* CP modifier */
  var cpMod = 0;
  if (wtClass === "saltwater" || wtClass === "freshwater") {
    var cpSt = uwp.cp_system_status || "unknown";
    if (cpSt === "failed") cpMod = 12;
    else if (cpSt === "degraded") cpMod = 8;
    else if (uwp.cp_system_type === "none") cpMod = 6;
    else if (cpSt === "unknown") cpMod = 10;
    else if (cpSt === "active") cpMod = -4;
  }

  /* Nuclear/hazard modifier */
  var nucMod = 0;
  if (wtClass === "nuclear") {
    nucMod = 10;
    if (uwp.radiation_zone === "hot") nucMod += 8;
    if (uwp.radiation_zone === "warm") nucMod += 4;
    if (uwp.boric_acid_exposure) nucMod += 6;
    if (uwp.irradiation_history) nucMod += 6;
  }
  if (wtClass === "hazardous") {
    nucMod = 8;
    if (uwp.chemical_environment === "acid" || uwp.chemical_environment === "caustic") nucMod += 6;
    if (uwp.chemical_environment === "radioactive_liquid") nucMod += 10;
    if (uwp.confined_space_classification) nucMod += 4;
  }

  /* Dive constraint penalty */
  var divePen = 0;
  if (diveP) {
    var score = 0;
    if (diveP.visibility_rating === "poor" || diveP.visibility_rating === "zero") score += 2;
    if ((diveP.current_speed_kts || 0) >= 1.5) score += 1;
    if ((diveP.current_speed_kts || 0) >= 3) score += 2;
    if ((diveP.bottom_time_minutes || 999) < 30) score += 2;
    if (diveP.coverage_limited_by && diveP.coverage_limited_by !== "none") score += 1;
    if ((diveP.coverage_percent || 100) < 50) score += 2;
    if (score >= 6) divePen = 12;
    else if (score >= 3) divePen = 8;
    else if (score >= 1) divePen = 4;
  }

  /* Adjusted scores */
  var adjHidden = clamp(
    baseDRE.hidden_damage_likelihood_score + dzMod + corrMod + visPen * 0.5 + cleanPen * 0.5 + cpMod + nucMod * 0.4,
    0, 100
  );
  var adjConf = clamp(
    baseDRE.confidence_score - visPen - cleanPen - divePen - (nucMod > 10 ? 5 : 0),
    0, 100
  );
  var adjRisk = clamp(
    baseDRE.overall_damage_risk + dzMod * 0.6 + corrMod * 0.5 + cpMod * 0.4 + nucMod * 0.3
      + (visPen > 10 ? 5 : 0) + (cleanPen > 10 ? 3 : 0),
    0, 100
  );

  /* Regulatory frameworks */
  var regs: string[] = [];
  var quals: string[] = [];
  if (wtClass === "saltwater") {
    regs.push("ADCI_Consensus_Standards"); regs.push("IMCA_D_010");
    quals.push("ADCI_certified_diver_or_ROV_pilot");
  }
  if (wtClass === "freshwater") {
    quals.push("ADCI_certified_diver_inland");
    if (uwp.ferc_regulated) regs.push("FERC_Dam_Safety_Regulations");
    if (uwp.usace_regulated) regs.push("USACE_Dam_Safety_Program");
    if (uwp.dam_classification === "high_hazard") regs.push("State_Dam_Safety_Program");
  }
  if (wtClass === "nuclear") {
    regs.push("10_CFR_50_Appendix_B"); regs.push("ASME_Section_XI"); regs.push("NRC_Regulatory_Guides");
    quals.push("Nuclear_qualified_NDE_per_ASME_XI"); quals.push("Radiation_Worker_qualified");
  }
  if (wtClass === "hazardous") {
    regs.push("OSHA_29_CFR_1910"); regs.push("EPA_RCRA");
    quals.push("HAZWOPER_40_hour_trained");
  }

  /* Rationale */
  var rat: string[] = [];
  rat.push("Underwater intelligence: " + wtClass + " environment, " + dz + " depth zone, corrosion severity " + corrSev + ".");
  if (visPen > 0) rat.push("Visibility penalty " + visPen + " applied: low visibility reduces confidence, not risk.");
  if (cleanPen > 0) rat.push("Cleaning penalty " + cleanPen + " applied: uncleaned surfaces conceal true condition.");
  if (cpMod > 0) rat.push("CP system not fully effective: corrosion risk elevated.");
  if (cpMod < 0) rat.push("CP system effective: small risk credit applied.");
  if (wtClass === "nuclear") rat.push("Nuclear context: ASME Section XI and NRC requirements apply.");
  if (wtClass === "hazardous") rat.push("Hazardous context: HAZWOPER and site-specific safety requirements apply.");
  rat.push("HARD RULE: Cleaning always precedes quantitative NDE subsea.");
  rat.push("HARD RULE: Splash zone is always the highest external corrosion risk zone.");
  rat.push("HARD RULE: Poor visibility reduces confidence but does NOT reduce risk.");

  /* NRC / FERC notification flags */
  var nrcNotify = false;
  var fercNotify = false;
  if (wtClass === "nuclear" && adjRisk >= 70) nrcNotify = true;
  if (wtClass === "freshwater" && uwp.ferc_regulated && uwp.dam_classification === "high_hazard" && adjRisk >= 50) fercNotify = true;

  return {
    depth_zone_risk_modifier: clamp(dzMod, 0, 20),
    water_type_corrosion_modifier: clamp(corrMod, 0, 20),
    visibility_confidence_penalty: clamp(visPen, 0, 25),
    cleaning_confidence_penalty: clamp(cleanPen, 0, 20),
    cp_effectiveness_modifier: clamp(cpMod, -5, 15),
    nuclear_hazard_modifier: clamp(nucMod, 0, 30),
    dive_constraint_penalty: clamp(divePen, 0, 15),
    adjusted_hidden_damage_score: adjHidden,
    adjusted_confidence_score: adjConf,
    adjusted_overall_risk: adjRisk,
    underwater_recommended_methods: [],
    cleaning_requirements: cleanPen > 0 ? ["Surface must be cleaned to at least commercial grade before any quantitative NDE."] : [],
    cp_recommendations: cpMod > 0 ? ["CP system requires engineering assessment."] : [],
    applicable_regulatory_framework: regs,
    required_qualifications: quals,
    reporting_requirements: [],
    alara_assessment: {},
    dose_projection: {},
    nrc_notification_required: nrcNotify,
    asme_xi_category: null,
    dam_safety_assessment: fercNotify ? { recommendation: "Notify dam safety officer." } : {},
    ferc_notification_required: fercNotify,
    underwater_rationale: rat,
    engine_version: "underwater_intelligence_v1",
  };
}

/* ========================================================================
   HANDLER
   ======================================================================== */

var handler: Handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var damageCaseId = body.damage_case_id;
    var orgId = body.org_id;
    if (!damageCaseId || !orgId) {
      return { statusCode: 400, body: JSON.stringify({ error: "damage_case_id and org_id required" }) };
    }

    var supabase = getSupabase();

    /* Fetch damage case */
    var dcRes = await supabase.from("damage_cases").select("*").eq("id", damageCaseId).eq("org_id", orgId).single();
    if (dcRes.error || !dcRes.data) {
      return { statusCode: 404, body: JSON.stringify({ error: "Damage case not found" }) };
    }
    var dc = dcRes.data;

    /* Fetch asset */
    var aRes = await supabase.from("assets").select("*").eq("id", dc.asset_id).eq("org_id", orgId).single();
    if (aRes.error || !aRes.data) {
      return { statusCode: 404, body: JSON.stringify({ error: "Asset not found" }) };
    }
    var asset = aRes.data;

    /* Run DRE */
    var norm = normalizeDRE(dc, asset);
    var inferred = inferDamage(dc, asset, norm);
    var scored = scoreDRE(dc, asset, norm, inferred);

    /* Store evaluation */
    var evalRes = await supabase.from("damage_evaluations").insert({
      org_id: orgId,
      damage_case_id: dc.id,
      asset_id: asset.id,
      intake_path: scored.intake_path,
      event_severity_score: scored.event_severity_score,
      observed_condition_severity_score: scored.observed_condition_severity_score,
      hidden_damage_likelihood_score: scored.hidden_damage_likelihood_score,
      damage_likelihood_score: scored.damage_likelihood_score,
      inspection_urgency_score: scored.inspection_urgency_score,
      consequence_score: scored.consequence_score,
      overall_damage_risk: scored.overall_damage_risk,
      confidence_score: scored.confidence_score,
      operational_disposition: scored.operational_disposition,
      probable_damage_mechanisms: scored.probable_damage_mechanisms,
      likely_failure_modes: scored.likely_failure_modes,
      likely_affected_components: scored.likely_affected_components,
      prioritized_inspection_zones: scored.prioritized_inspection_zones,
      recommended_methods: scored.recommended_methods,
      rationale: scored.rationale,
      missing_critical_inputs: scored.missing_critical_inputs,
      assumptions: scored.assumptions,
      engine_version: scored.engine_version,
    }).select("*").single();

    if (evalRes.error) {
      return { statusCode: 500, body: JSON.stringify({ error: evalRes.error.message }) };
    }

    /* Update case with normalized payload */
    await supabase.from("damage_cases").update({ normalized_payload: norm }).eq("id", dc.id);

    /* Check for underwater profile */
    var uwExt: any = null;
    try {
      var uwpRes = await supabase.from("underwater_asset_profiles").select("*").eq("asset_id", asset.id).single();
      if (uwpRes.data) {
        var uwp = uwpRes.data;
        /* Optionally fetch dive profile */
        var diveP: any = null;
        try {
          var dpRes = await supabase.from("dive_operation_profiles").select("*").eq("damage_case_id", dc.id).single();
          if (dpRes.data) diveP = dpRes.data;
        } catch (e) { /* no dive profile is fine */ }

        /* Run underwater extension */
        uwExt = runUnderwaterExtension(scored, uwp, diveP);

        /* Store extension */
        await supabase.from("underwater_evaluation_extensions").insert({
          damage_evaluation_id: evalRes.data.id,
          org_id: orgId,
          depth_zone_risk_modifier: uwExt.depth_zone_risk_modifier,
          water_type_corrosion_modifier: uwExt.water_type_corrosion_modifier,
          visibility_confidence_penalty: uwExt.visibility_confidence_penalty,
          cleaning_confidence_penalty: uwExt.cleaning_confidence_penalty,
          cp_effectiveness_modifier: uwExt.cp_effectiveness_modifier,
          nuclear_hazard_modifier: uwExt.nuclear_hazard_modifier,
          dive_constraint_penalty: uwExt.dive_constraint_penalty,
          adjusted_hidden_damage_score: uwExt.adjusted_hidden_damage_score,
          adjusted_confidence_score: uwExt.adjusted_confidence_score,
          adjusted_overall_risk: uwExt.adjusted_overall_risk,
          underwater_recommended_methods: uwExt.underwater_recommended_methods,
          cleaning_requirements: uwExt.cleaning_requirements,
          cp_recommendations: uwExt.cp_recommendations,
          applicable_regulatory_framework: uwExt.applicable_regulatory_framework,
          required_qualifications: uwExt.required_qualifications,
          reporting_requirements: uwExt.reporting_requirements,
          alara_assessment: uwExt.alara_assessment,
          dose_projection: uwExt.dose_projection,
          nrc_notification_required: uwExt.nrc_notification_required,
          asme_xi_category: uwExt.asme_xi_category,
          dam_safety_assessment: uwExt.dam_safety_assessment,
          ferc_notification_required: uwExt.ferc_notification_required,
          underwater_rationale: uwExt.underwater_rationale,
          engine_version: uwExt.engine_version,
        });
      }
    } catch (e) { /* no underwater profile — skip extension */ }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        evaluation: evalRes.data,
        normalized_payload: norm,
        underwater_extension: uwExt,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" }),
    };
  }
};

export { handler };
