// @ts-nocheck
/**
 * DEPLOY280 - NDE Image Analysis Engine v1.0.0
 * netlify/functions/nde-image-analysis.ts
 *
 * 3-AI PIPELINE: Vision AI → Code Authority Router → Physics Consequence Engine
 *
 * The brain that looks at NDE images and THINKS like a CWI.
 * Phone camera weld photo? Radiograph film scan? PAUT sector scan?
 * This engine classifies what it sees, routes to the governing code,
 * and computes physics consequence — all deterministically gated.
 *
 * TIERED PRODUCT ARCHITECTURE:
 *   BASIC  — Welding students. Phone camera weld photos. Educational feedback.
 *   PRO    — CWI / Level II-III inspectors. RT, PAUT, TOFD, MT, PT, ET.
 *            Full code authority routing + acceptance criteria.
 *   MAIN   — Enterprise. All 144+ engines. Fleet analytics. Proof traces.
 *            Survival model integration. Authority lock disposition.
 *
 * 12 actions:
 *   get_registry              — engine capabilities and tier matrix
 *   analyze_image             — full 3-AI pipeline (tier-aware)
 *   classify_discontinuities  — vision-only discontinuity detection
 *   get_acceptance_criteria    — code-specific accept/reject thresholds
 *   evaluate_indication       — single indication vs code criteria
 *   get_modality_guide        — what a specific NDE method can/cannot detect
 *   get_educational_feedback  — Basic tier teaching response
 *   get_tier_capabilities     — what features each tier unlocks
 *   batch_analyze             — multi-image analysis (Pro/Main only)
 *   get_analysis_history      — past analyses for a case
 *   compare_scans             — temporal comparison (Main only)
 *   get_roi_detail            — detailed region-of-interest breakdown
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "nde-image-analysis";
var ENGINE_VERSION = "v2.0.0";
var DEPLOY_TAG = "DEPLOY280";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ================================================================
// HELPERS
// ================================================================

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}
function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function round3(n) {
  return Math.round(n * 1000) / 1000;
}
function nowISO() {
  return new Date().toISOString();
}
function getOrg(event) {
  try {
    var auth = event.headers["authorization"] || "";
    if (!auth) return null;
    var token = auth.replace("Bearer ", "");
    var payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_metadata && payload.app_metadata.org_id ? payload.app_metadata.org_id : null;
  } catch (e) {
    return null;
  }
}

// ================================================================
// TIER DEFINITIONS
// ================================================================

var TIER_MATRIX = {
  basic: {
    tier_name: "Basic",
    target_user: "Welding students, apprentices, hobbyists",
    image_sources: ["phone_camera", "tablet_camera", "webcam"],
    supported_modalities: ["VT"],
    max_images_per_analysis: 3,
    features: [
      "visual_discontinuity_detection",
      "basic_code_lookup",
      "educational_feedback",
      "accept_reject_guidance",
      "study_tips",
      "weld_profile_assessment"
    ],
    code_access: ["aws_d1_1", "aws_d1_3", "api_1104"],
    survival_model: false,
    fleet_analytics: false,
    proof_trace: false,
    authority_lock: false,
    ai_model: "gpt-4o-mini",
    output_style: "educational"
  },
  pro: {
    tier_name: "Pro",
    target_user: "CWI, Level II/III inspectors, NDE technicians",
    image_sources: ["phone_camera", "scanner", "digital_detector", "film_digitizer", "paut_instrument", "tofd_instrument", "industrial_camera"],
    supported_modalities: ["VT", "RT", "PAUT", "TOFD", "MT", "PT", "ET", "ACFM"],
    max_images_per_analysis: 20,
    features: [
      "visual_discontinuity_detection",
      "radiographic_interpretation",
      "paut_sector_scan_analysis",
      "tofd_interpretation",
      "surface_method_analysis",
      "full_code_authority_routing",
      "acceptance_criteria_evaluation",
      "indication_sizing",
      "multi_indication_interaction",
      "code_clause_citation",
      "repair_recommendation",
      "report_generation"
    ],
    code_access: "all",
    survival_model: false,
    fleet_analytics: false,
    proof_trace: true,
    authority_lock: false,
    ai_model: "gpt-4o",
    output_style: "professional"
  },
  main: {
    tier_name: "Main Platform",
    target_user: "Enterprise — asset owners, integrity engineers, fleet managers",
    image_sources: "all",
    supported_modalities: ["VT", "RT", "PAUT", "TOFD", "MT", "PT", "ET", "ACFM", "PEC", "GWT", "IRIS", "ADVANCED_UT"],
    max_images_per_analysis: 100,
    features: [
      "all_pro_features",
      "survival_model_integration",
      "fleet_analytics",
      "temporal_scan_comparison",
      "authority_lock_disposition",
      "physics_sufficiency_gate",
      "multimodal_fusion",
      "contradiction_detection",
      "damage_mechanism_correlation",
      "risk_based_inspection_link",
      "batch_processing",
      "api_access"
    ],
    code_access: "all",
    survival_model: true,
    fleet_analytics: true,
    proof_trace: true,
    authority_lock: true,
    ai_model: "gpt-4o",
    output_style: "enterprise"
  }
};

// ================================================================
// NDE MODALITY KNOWLEDGE BASE
// What each method CAN and CANNOT detect — physics-based truth
// ================================================================

var MODALITY_KB = {
  VT: {
    name: "Visual Testing",
    iso_code: "ISO 17637",
    detectable: [
      "surface_porosity", "crater_crack", "undercut", "overlap", "excess_reinforcement",
      "incomplete_fill", "arc_strike", "spatter", "misalignment", "angular_distortion",
      "burn_through", "surface_crack", "toe_crack", "face_crack", "root_concavity",
      "excessive_root_penetration", "incomplete_root_penetration", "weld_profile_deviation",
      "surface_oxidation", "discoloration", "general_corrosion", "pitting_corrosion",
      "coating_failure", "mechanical_damage", "deformation"
    ],
    not_detectable: [
      "subsurface_porosity", "slag_inclusion", "lack_of_fusion", "lamination",
      "internal_crack", "hic", "sohic", "htha", "subsurface_lack_of_penetration"
    ],
    sizing_capability: "surface_length_only",
    min_detectable_size_mm: 0.5,
    confidence_base: 0.70,
    lighting_dependent: true,
    requires_surface_prep: false,
    image_types: ["overview", "closeup", "profile", "root_side", "macro_section"]
  },
  RT: {
    name: "Radiographic Testing",
    iso_code: "ISO 17636",
    detectable: [
      "porosity", "cluster_porosity", "linear_porosity", "wormhole_porosity",
      "slag_inclusion", "tungsten_inclusion", "copper_inclusion",
      "lack_of_fusion", "lack_of_sidewall_fusion", "lack_of_root_fusion",
      "lack_of_penetration", "incomplete_root_penetration",
      "internal_undercut", "burn_through", "concavity",
      "crack", "longitudinal_crack", "transverse_crack",
      "internal_corrosion", "wall_thinning", "erosion"
    ],
    not_detectable: [
      "tight_crack_parallel_to_beam", "lamination", "planar_flaws_parallel_to_beam",
      "surface_breaking_tight_cracks", "htha_early_stage"
    ],
    sizing_capability: "length_and_projected_width",
    min_detectable_size_mm: 0.3,
    confidence_base: 0.92,
    lighting_dependent: false,
    requires_surface_prep: false,
    image_types: ["film_scan", "digital_detector", "computed_radiography"]
  },
  PAUT: {
    name: "Phased Array Ultrasonic Testing",
    iso_code: "ISO 13588",
    detectable: [
      "lack_of_fusion", "lack_of_sidewall_fusion", "lack_of_root_fusion",
      "lack_of_penetration", "crack", "longitudinal_crack", "transverse_crack",
      "toe_crack", "root_crack", "heat_affected_zone_crack",
      "porosity", "slag_inclusion", "lamination", "delamination",
      "hic", "sohic", "htha", "wall_thinning", "corrosion_mapping",
      "stress_corrosion_cracking", "fatigue_crack", "creep_damage"
    ],
    not_detectable: [
      "surface_porosity_only", "arc_strike", "spatter",
      "coating_condition", "surface_oxidation"
    ],
    sizing_capability: "length_depth_and_height",
    min_detectable_size_mm: 0.5,
    confidence_base: 0.93,
    lighting_dependent: false,
    requires_surface_prep: true,
    image_types: ["sector_scan", "linear_scan", "compound_scan", "topcal_view", "strip_chart"]
  },
  TOFD: {
    name: "Time of Flight Diffraction",
    iso_code: "ISO 10863",
    detectable: [
      "crack", "lack_of_fusion", "lack_of_penetration",
      "longitudinal_crack", "transverse_crack", "toe_crack", "root_crack",
      "porosity", "slag_inclusion",
      "hic", "sohic", "stress_corrosion_cracking",
      "fatigue_crack", "creep_crack"
    ],
    not_detectable: [
      "surface_breaking_only_small", "coating_condition", "surface_oxidation",
      "arc_strike", "spatter", "overlap"
    ],
    sizing_capability: "through_wall_height_precise",
    min_detectable_size_mm: 1.0,
    confidence_base: 0.90,
    lighting_dependent: false,
    requires_surface_prep: true,
    image_types: ["d_scan", "b_scan", "tofd_strip"]
  },
  MT: {
    name: "Magnetic Particle Testing",
    iso_code: "ISO 17638",
    detectable: [
      "surface_crack", "near_surface_crack", "toe_crack", "face_crack",
      "crater_crack", "longitudinal_crack", "transverse_crack",
      "lack_of_fusion_surface_breaking", "lap", "seam"
    ],
    not_detectable: [
      "subsurface_porosity", "deep_internal_crack", "lamination",
      "internal_lack_of_fusion", "wall_thinning", "corrosion_mapping"
    ],
    sizing_capability: "surface_length_only",
    min_detectable_size_mm: 0.25,
    confidence_base: 0.85,
    lighting_dependent: true,
    requires_surface_prep: true,
    image_types: ["uv_photo", "white_light_photo", "macro_photo"]
  },
  PT: {
    name: "Liquid Penetrant Testing",
    iso_code: "ISO 3452",
    detectable: [
      "surface_crack", "toe_crack", "face_crack", "crater_crack",
      "porosity_surface_breaking", "lack_of_fusion_surface_breaking",
      "lap", "seam", "micro_crack"
    ],
    not_detectable: [
      "subsurface_anything", "internal_crack", "slag_inclusion",
      "lack_of_fusion_internal", "wall_thinning", "lamination"
    ],
    sizing_capability: "surface_length_only",
    min_detectable_size_mm: 0.1,
    confidence_base: 0.82,
    lighting_dependent: true,
    requires_surface_prep: true,
    image_types: ["fluorescent_photo", "visible_dye_photo"]
  },
  ET: {
    name: "Eddy Current Testing",
    iso_code: "ISO 15549",
    detectable: [
      "surface_crack", "near_surface_crack", "pitting",
      "wall_thinning", "coating_thickness_variation",
      "conductivity_change", "heat_treatment_variation"
    ],
    not_detectable: [
      "deep_internal_flaw", "lack_of_fusion_deep", "slag_inclusion",
      "lamination_deep", "porosity_internal"
    ],
    sizing_capability: "depth_estimate_surface_length",
    min_detectable_size_mm: 0.2,
    confidence_base: 0.82,
    lighting_dependent: false,
    requires_surface_prep: false,
    image_types: ["impedance_plot", "strip_chart", "c_scan"]
  },
  ACFM: {
    name: "Alternating Current Field Measurement",
    iso_code: "BS 7706",
    detectable: [
      "surface_crack", "toe_crack", "fatigue_crack",
      "stress_corrosion_cracking", "near_surface_crack"
    ],
    not_detectable: [
      "internal_flaw", "porosity", "slag_inclusion",
      "lack_of_fusion_internal", "wall_thinning"
    ],
    sizing_capability: "length_and_depth",
    min_detectable_size_mm: 1.0,
    confidence_base: 0.88,
    lighting_dependent: false,
    requires_surface_prep: false,
    image_types: ["bx_bz_plot", "butterfly_plot", "strip_chart"]
  },
  PEC: {
    name: "Pulsed Eddy Current",
    iso_code: "ISO 20669",
    detectable: [
      "wall_thinning", "general_corrosion", "cui_wall_loss",
      "erosion", "flow_accelerated_corrosion", "insulation_wet_areas"
    ],
    not_detectable: [
      "crack", "porosity", "slag_inclusion", "lack_of_fusion",
      "pitting_small", "surface_crack", "arc_strike"
    ],
    sizing_capability: "average_wall_thickness_over_footprint",
    min_detectable_size_mm: 2.0,
    confidence_base: 0.78,
    lighting_dependent: false,
    requires_surface_prep: false,
    image_types: ["thickness_grid", "color_map", "trend_plot"]
  },
  GWT: {
    name: "Guided Wave Testing",
    iso_code: "ISO 18211",
    detectable: [
      "wall_thinning", "general_corrosion", "pitting_corrosion",
      "erosion", "circumferential_crack", "girth_weld_defect",
      "coating_disbondment", "cui_wall_loss"
    ],
    not_detectable: [
      "small_isolated_pit", "surface_crack_axial", "porosity",
      "slag_inclusion", "lack_of_fusion", "arc_strike"
    ],
    sizing_capability: "cross_section_loss_percentage",
    min_detectable_size_mm: 5.0,
    confidence_base: 0.75,
    lighting_dependent: false,
    requires_surface_prep: false,
    image_types: ["a_scan_envelope", "distance_amplitude_plot", "focus_map"]
  },
  IRIS: {
    name: "Internal Rotating Inspection System",
    iso_code: "ASTM E2905",
    detectable: [
      "wall_thinning", "pitting_corrosion", "general_corrosion",
      "erosion", "internal_grooving", "tube_denting",
      "tube_ovality", "baffle_wear", "mic_pitting"
    ],
    not_detectable: [
      "external_surface_crack", "coating_condition",
      "lack_of_fusion", "porosity_weld", "arc_strike"
    ],
    sizing_capability: "wall_thickness_360_degree_profile",
    min_detectable_size_mm: 0.2,
    confidence_base: 0.90,
    lighting_dependent: false,
    requires_surface_prep: true,
    image_types: ["b_scan_strip", "c_scan_map", "thickness_profile"]
  },
  ADVANCED_UT: {
    name: "Advanced Ultrasonic Testing (FMC/TFM)",
    iso_code: "ISO 23864",
    detectable: [
      "crack", "fatigue_crack", "stress_corrosion_cracking",
      "lack_of_fusion", "lack_of_penetration", "porosity",
      "slag_inclusion", "hic", "sohic", "htha",
      "lamination", "delamination", "creep_damage",
      "hydrogen_flaking", "disbonding"
    ],
    not_detectable: [
      "surface_oxidation", "coating_condition", "arc_strike",
      "spatter", "surface_only_cosmetic"
    ],
    sizing_capability: "length_depth_height_characterization",
    min_detectable_size_mm: 0.3,
    confidence_base: 0.95,
    lighting_dependent: false,
    requires_surface_prep: true,
    image_types: ["tfm_image", "fmc_dataset", "sectorial_scan", "compound_image"]
  }
};

// ================================================================
// DISCONTINUITY KNOWLEDGE BASE — ISO 6520 Taxonomy
// ================================================================

var DISCONTINUITY_KB = {
  // -- CRACKS (ISO 6520-1 Group 1) --
  longitudinal_crack: {
    iso_ref: "1011", group: "crack", severity: "critical",
    description: "Crack parallel to weld axis",
    visual_indicators: ["linear dark line parallel to weld", "oxide-stained fracture surface"],
    rt_indicators: ["dark linear indication parallel to weld axis", "sharp edges"],
    paut_indicators: ["high amplitude reflection", "tip diffraction signal", "through-wall extent measurable"],
    common_causes: ["high restraint", "hydrogen", "hot cracking", "centerline solidification"],
    teaching_note: "Longitudinal cracks are almost always rejectable. Look for linear indications running along the weld direction."
  },
  transverse_crack: {
    iso_ref: "1021", group: "crack", severity: "critical",
    description: "Crack perpendicular to weld axis",
    visual_indicators: ["linear indication crossing weld transversely", "may extend into HAZ"],
    rt_indicators: ["dark line perpendicular to weld axis"],
    paut_indicators: ["high amplitude at specific angle", "orientation-dependent response"],
    common_causes: ["transverse shrinkage stress", "hydrogen in high-strength steel", "restraint"],
    teaching_note: "Transverse cracks cross the weld. They indicate severe stress or hydrogen issues."
  },
  crater_crack: {
    iso_ref: "1041", group: "crack", severity: "major",
    description: "Crack in the weld crater at stop point",
    visual_indicators: ["star-shaped or linear crack in crater", "shrinkage pattern at weld termination"],
    rt_indicators: ["small dark star pattern at weld stop"],
    paut_indicators: ["localized reflection at weld termination"],
    common_causes: ["improper crater fill", "too-rapid arc extinction", "shrinkage"],
    teaching_note: "Crater cracks form when the welder stops too quickly. Always fill the crater before breaking the arc."
  },
  toe_crack: {
    iso_ref: "1012", group: "crack", severity: "critical",
    description: "Crack at the weld toe in base metal or HAZ",
    visual_indicators: ["linear indication at weld-to-base-metal interface", "may show slight opening"],
    rt_indicators: ["faint dark line at weld toe boundary"],
    paut_indicators: ["corner echo from toe region", "diffraction signal at toe"],
    common_causes: ["high residual stress", "hydrogen", "fatigue", "poor weld profile"],
    teaching_note: "Toe cracks start where the weld meets the base metal. Sharp weld toes and high stress concentrate cracking here."
  },
  root_crack: {
    iso_ref: "1013", group: "crack", severity: "critical",
    description: "Crack originating from the weld root",
    visual_indicators: ["crack visible from root side", "root bead separation"],
    rt_indicators: ["dark line at root region"],
    paut_indicators: ["reflection from root region", "corner echo at root"],
    common_causes: ["inadequate root gap", "hydrogen", "high dilution", "restraint"],
    teaching_note: "Root cracks start at the bottom of the weld. Root access for inspection is critical."
  },

  // -- POROSITY (ISO 6520-1 Group 2) --
  porosity: {
    iso_ref: "2011", group: "gas_inclusion", severity: "minor_to_major",
    description: "Scattered gas pores in weld metal",
    visual_indicators: ["small round holes on weld surface", "may appear as surface pits"],
    rt_indicators: ["round or slightly elongated dark spots", "well-defined edges", "random distribution"],
    paut_indicators: ["small amplitude reflections", "scattered pattern", "typically low severity"],
    common_causes: ["contamination", "moisture", "inadequate gas shielding", "wrong electrode"],
    teaching_note: "Porosity looks like tiny bubbles frozen in the weld. Clean your base metal and check your shielding gas!"
  },
  cluster_porosity: {
    iso_ref: "2013", group: "gas_inclusion", severity: "major",
    description: "Localized grouping of gas pores",
    visual_indicators: ["group of surface pits in one area"],
    rt_indicators: ["cluster of round dark spots in localized area"],
    paut_indicators: ["grouped small reflections in localized zone"],
    common_causes: ["localized contamination", "arc blow", "improper restart"],
    teaching_note: "Cluster porosity means something went wrong in one spot — contamination, arc blow, or a bad restart."
  },
  linear_porosity: {
    iso_ref: "2014", group: "gas_inclusion", severity: "major",
    description: "Gas pores aligned in a row, typically along weld centerline",
    visual_indicators: ["row of pores along weld bead"],
    rt_indicators: ["line of round dark spots along weld axis"],
    paut_indicators: ["regularly spaced small reflections along weld axis"],
    common_causes: ["contamination along joint line", "inadequate interpass cleaning"],
    teaching_note: "When pores line up, it usually means contamination along the joint fit-up or poor interpass cleaning."
  },
  wormhole_porosity: {
    iso_ref: "2016", group: "gas_inclusion", severity: "major",
    description: "Elongated tubular gas cavity (herringbone/piping)",
    visual_indicators: ["elongated surface hole", "may show directional pattern"],
    rt_indicators: ["elongated dark indication", "may show herringbone pattern"],
    paut_indicators: ["elongated reflection with directional character"],
    common_causes: ["high gas evolution rate", "damp electrodes", "organic contamination"],
    teaching_note: "Wormholes are elongated gas tunnels. Usually caused by severe moisture or contamination."
  },

  // -- SOLID INCLUSIONS (ISO 6520-1 Group 3) --
  slag_inclusion: {
    iso_ref: "3011", group: "solid_inclusion", severity: "minor_to_major",
    description: "Slag trapped in weld metal",
    visual_indicators: ["dark glassy material visible on surface or fractured weld"],
    rt_indicators: ["irregular dark spots or lines", "less defined edges than porosity", "often elongated"],
    paut_indicators: ["moderate amplitude irregular reflection", "often at interpass boundaries"],
    common_causes: ["inadequate interpass cleaning", "improper technique", "too narrow groove"],
    teaching_note: "Slag gets trapped when you don't clean between passes. Always chip and wire brush before the next pass."
  },
  tungsten_inclusion: {
    iso_ref: "3041", group: "solid_inclusion", severity: "minor",
    description: "Tungsten particle embedded in weld (GTAW only)",
    visual_indicators: ["bright metallic particle in weld"],
    rt_indicators: ["bright (light) spot on radiograph — denser than weld metal"],
    paut_indicators: ["point reflection"],
    common_causes: ["electrode dipping into weld pool", "excessive current", "wrong polarity"],
    teaching_note: "Tungsten inclusions show as BRIGHT spots on RT — opposite of porosity. They mean the electrode touched the pool."
  },

  // -- LACK OF FUSION (ISO 6520-1 Group 4) --
  lack_of_fusion: {
    iso_ref: "4011", group: "fusion_defect", severity: "critical",
    description: "Lack of union between weld metal and base metal or between passes",
    visual_indicators: ["visible gap at weld interface", "may show cold lap appearance"],
    rt_indicators: ["dark linear indication along fusion line", "straight edge on one side"],
    paut_indicators: ["strong reflection from sidewall region", "orientation-dependent", "smooth reflector"],
    common_causes: ["insufficient heat input", "improper technique", "wrong electrode angle", "magnetic arc blow"],
    teaching_note: "LOF means the weld didn't melt into the base metal. It's like glue that didn't stick — always rejectable."
  },
  lack_of_penetration: {
    iso_ref: "4021", group: "fusion_defect", severity: "critical",
    description: "Root of joint not reached by weld metal",
    visual_indicators: ["unfused root visible from root side", "gap at root"],
    rt_indicators: ["continuous or intermittent dark line at root centerline", "well-defined edges"],
    paut_indicators: ["strong root reflection", "linear at root depth"],
    common_causes: ["root gap too small", "electrode too large", "travel speed too fast", "insufficient heat"],
    teaching_note: "LOP means the weld didn't reach the bottom of the joint. Check your root opening and heat input."
  },

  // -- SHAPE DEFECTS (ISO 6520-1 Group 5) --
  undercut: {
    iso_ref: "5011", group: "shape_defect", severity: "minor_to_major",
    description: "Groove melted into base metal at weld toe, unfilled by weld metal",
    visual_indicators: ["groove or channel at weld toe", "sharp notch at weld-to-base interface"],
    rt_indicators: ["dark line along weld toe", "more visible on one side"],
    paut_indicators: ["surface indication at toe location"],
    common_causes: ["excessive current", "wrong electrode angle", "travel speed too fast", "excessive weaving"],
    teaching_note: "Undercut is a groove at the weld toe. Reduce your current or slow down. It creates a stress riser."
  },
  excess_reinforcement: {
    iso_ref: "5021", group: "shape_defect", severity: "minor",
    description: "Weld face too high above base metal surface",
    visual_indicators: ["weld bead significantly higher than base metal", "steep weld angle"],
    rt_indicators: ["lighter (brighter) weld area — thicker section absorbs more radiation"],
    paut_indicators: ["not typically significant for PAUT"],
    common_causes: ["excessive filler metal", "slow travel speed", "too many passes"],
    teaching_note: "Too much reinforcement creates stress concentration. Most codes limit it to 1/8 inch (3.2mm)."
  },
  incomplete_fill: {
    iso_ref: "5022", group: "shape_defect", severity: "major",
    description: "Weld face below base metal surface — underfill",
    visual_indicators: ["weld surface depressed below base metal plane"],
    rt_indicators: ["darker region at weld face — thinner section"],
    paut_indicators: ["surface depression indication"],
    common_causes: ["insufficient filler metal", "excessive travel speed", "low deposition rate"],
    teaching_note: "Underfill means not enough weld metal was deposited. Add another pass or slow down."
  },
  overlap: {
    iso_ref: "5061", group: "shape_defect", severity: "major",
    description: "Weld metal rolls over base metal surface without fusing",
    visual_indicators: ["weld metal overlapping base metal edge", "cold lap visible"],
    rt_indicators: ["subtle dark line where overlap meets base metal"],
    paut_indicators: ["surface/near-surface reflection at toe"],
    common_causes: ["too slow travel speed", "wrong electrode angle", "excessive deposition"],
    teaching_note: "Overlap is weld metal that rolled over without fusing — it's a crack starter. Fix your travel speed and angle."
  },
  burn_through: {
    iso_ref: "5101", group: "shape_defect", severity: "critical",
    description: "Weld metal melted through creating a hole",
    visual_indicators: ["hole or depression on root side", "excessive penetration with metal loss"],
    rt_indicators: ["very dark localized spot — complete void"],
    paut_indicators: ["complete loss of backwall signal at location"],
    common_causes: ["excessive heat input", "root gap too large", "thin material", "too slow travel"],
    teaching_note: "Burn-through means you melted right through. Reduce heat input or increase travel speed."
  },
  misalignment: {
    iso_ref: "5072", group: "shape_defect", severity: "minor_to_major",
    description: "Axial misalignment (hi-lo) of joint members",
    visual_indicators: ["step or offset at weld joint", "uneven surfaces across joint"],
    rt_indicators: ["density change across weld — one side lighter than other"],
    paut_indicators: ["asymmetric root geometry"],
    common_causes: ["poor fit-up", "inadequate tacking", "clamp release during welding"],
    teaching_note: "Hi-lo means the pieces aren't lined up. Good fit-up is essential — you can't weld your way out of bad alignment."
  },
  arc_strike: {
    iso_ref: "6011", group: "miscellaneous", severity: "minor_to_major",
    description: "Localized damage from inadvertent arc contact outside weld zone",
    visual_indicators: ["small pit or discolored spot on base metal outside weld", "may show micro-cracking"],
    rt_indicators: ["typically not visible on RT"],
    paut_indicators: ["typically not detectable"],
    common_causes: ["careless electrode handling", "ground clamp too close", "stray arc"],
    teaching_note: "Arc strikes create hardened spots that can crack. Never strike the arc on the base metal outside the joint."
  },

  // -- CORROSION / IN-SERVICE (Non-ISO 6520 but critical for NDE) --
  general_corrosion: {
    iso_ref: "N/A", group: "in_service", severity: "varies",
    description: "Uniform wall loss from corrosive environment",
    visual_indicators: ["uniform surface roughening", "scale", "oxide layer", "pitting"],
    rt_indicators: ["general density increase (thinner wall)"],
    paut_indicators: ["reduced wall thickness readings", "rough ID surface echo"],
    common_causes: ["chemical exposure", "inadequate coating", "wrong material selection"],
    teaching_note: "General corrosion eats the wall evenly. Measure remaining thickness and compare to minimum required."
  },
  pitting_corrosion: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Localized deep corrosion pits",
    visual_indicators: ["isolated deep pits", "may be hidden under scale or deposits"],
    rt_indicators: ["localized dark spots — deeper than surrounding wall"],
    paut_indicators: ["localized wall thickness reduction", "sharp depth transitions"],
    common_causes: ["chloride environment", "stagnant conditions", "MIC", "crevice conditions"],
    teaching_note: "Pitting is sneaky — small on the surface but can go deep. Always probe the depth of pits."
  },
  stress_corrosion_cracking: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "Cracking from combined stress + corrosive environment",
    visual_indicators: ["branching crack pattern", "may appear as surface staining first"],
    rt_indicators: ["faint branching dark lines — difficult to detect"],
    paut_indicators: ["crack-like reflections", "branching pattern", "may require multiple angles"],
    common_causes: ["caustic environment", "chloride + temperature", "polythionic acid", "amine service"],
    teaching_note: "SCC needs three things: stress + corrosion + susceptible material. Remove any one and cracking stops."
  },

  // -- ADDITIONAL CRACKING MECHANISMS --
  hydrogen_crack: {
    iso_ref: "1031", group: "crack", severity: "critical",
    description: "Cold cracking from hydrogen diffusion into HAZ or weld metal",
    visual_indicators: ["delayed crack appearing hours after welding", "transverse or underbead orientation"],
    rt_indicators: ["fine dark line in HAZ region", "may not be visible until 48hr post-weld"],
    paut_indicators: ["reflection in HAZ zone", "often transverse to weld axis"],
    common_causes: ["hydrogen from moisture/contamination", "high restraint", "susceptible microstructure", "insufficient preheat"],
    teaching_note: "Hydrogen cracking is delayed — it can appear hours or days after welding. Always preheat high-strength steels and use low-hydrogen electrodes."
  },
  hot_crack: {
    iso_ref: "1001", group: "crack", severity: "critical",
    description: "Cracking during solidification while weld metal is still semi-molten",
    visual_indicators: ["centerline crack", "crater star crack", "liquation crack in HAZ"],
    rt_indicators: ["dark centerline indication", "star pattern at stops"],
    paut_indicators: ["centerline reflection", "typically shallow"],
    common_causes: ["high sulfur or phosphorus", "high depth-to-width ratio", "high restraint during solidification"],
    teaching_note: "Hot cracks form while the weld is still cooling. Control your bead shape — avoid deep narrow welds."
  },
  reheat_crack: {
    iso_ref: "1032", group: "crack", severity: "critical",
    description: "Cracking during PWHT or high-temperature service in HAZ",
    visual_indicators: ["intergranular crack in coarse-grained HAZ", "often at weld toe"],
    rt_indicators: ["faint dark line in HAZ — difficult to detect"],
    paut_indicators: ["HAZ reflection", "intergranular character"],
    common_causes: ["Cr-Mo-V steels", "coarse grain HAZ", "stress relief heat treatment", "creep-range temperatures"],
    teaching_note: "Reheat cracking occurs in certain alloy steels during PWHT. It is a metallurgical problem, not a welder skill issue."
  },
  lamellar_tear: {
    iso_ref: "1033", group: "crack", severity: "critical",
    description: "Step-like tearing in base metal parallel to rolling direction from through-thickness stress",
    visual_indicators: ["step-shaped crack parallel to plate surface", "terrace fracture appearance"],
    rt_indicators: ["step pattern parallel to plate surface — difficult to detect"],
    paut_indicators: ["planar reflector parallel to plate surface", "step pattern"],
    common_causes: ["high through-thickness stress", "sulfide inclusions in plate", "T-joints and corner joints", "thick restrained joints"],
    teaching_note: "Lamellar tearing is a base metal problem, not a weld defect. Use Z-grade (through-thickness tested) steel for critical joints."
  },

  // -- ADDITIONAL IN-SERVICE DEGRADATION --
  erosion: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Material loss from fluid flow impingement, particles, or droplets",
    visual_indicators: ["directional material loss pattern", "smooth polished surface in flow direction", "horseshoe pattern at elbows"],
    rt_indicators: ["localized thinning with directional pattern"],
    paut_indicators: ["reduced wall thickness", "directional thinning profile"],
    common_causes: ["high velocity flow", "entrained particles", "droplet impingement", "cavitation at restrictions"],
    teaching_note: "Erosion follows the flow. Look for directional patterns, especially at elbows, tees, and reducers."
  },
  cavitation: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Material loss from collapsing vapor bubbles in liquid flow",
    visual_indicators: ["rough pitted surface", "sponge-like appearance", "localized at pressure drop zones"],
    rt_indicators: ["localized thinning at flow restrictions"],
    paut_indicators: ["rough ID surface with irregular wall loss"],
    common_causes: ["pressure drops below vapor pressure", "pump impellers", "control valves", "orifice plates"],
    teaching_note: "Cavitation creates a rough, spongy surface. It happens where pressure drops cause bubbles to form and collapse."
  },
  galvanic_corrosion: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Accelerated corrosion at junction of dissimilar metals",
    visual_indicators: ["preferential attack on anodic (less noble) metal", "corrosion concentrated at joint interface"],
    rt_indicators: ["wall loss concentrated at dissimilar metal joint"],
    paut_indicators: ["localized thinning at DMW interface"],
    common_causes: ["carbon steel to stainless connection", "copper alloy to steel", "aluminum to steel", "inadequate insulation between metals"],
    teaching_note: "Galvanic corrosion occurs when two different metals are connected in a conductive fluid. The less noble metal corrodes faster."
  },
  crevice_corrosion: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Localized corrosion in confined spaces where stagnant solution chemistry changes",
    visual_indicators: ["corrosion under gaskets", "attack at lap joints", "pitting under deposits"],
    rt_indicators: ["localized thinning at joint overlaps"],
    paut_indicators: ["wall loss at crevice locations"],
    common_causes: ["lap joints", "gasket surfaces", "under bolt heads", "deposit accumulation", "stagnant areas"],
    teaching_note: "Crevice corrosion hides in tight spaces. Eliminate crevices in design or ensure proper drainage and cleaning access."
  },
  intergranular_corrosion: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "Preferential attack along grain boundaries in sensitized material",
    visual_indicators: ["sugary fracture surface", "grain dropping", "weld decay zone in HAZ"],
    rt_indicators: ["diffuse thinning in HAZ band"],
    paut_indicators: ["scattering increase in sensitized zone", "wall loss in HAZ"],
    common_causes: ["sensitization of austenitic stainless", "weld decay (HAZ)", "polythionic acid exposure", "wrong grade selection"],
    teaching_note: "Intergranular corrosion attacks grain boundaries in sensitized stainless steel. Use L-grades (304L, 316L) or stabilized grades (321, 347)."
  },
  htha: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "High Temperature Hydrogen Attack — internal decarburization and fissuring from hydrogen at elevated temperature",
    visual_indicators: ["surface blistering in advanced stages", "may show no external indication in early stages"],
    rt_indicators: ["difficult to detect — requires specialized techniques"],
    paut_indicators: ["increased backscatter", "velocity ratio change", "backwall attenuation", "requires advanced UT techniques"],
    common_causes: ["hydrogen partial pressure + temperature above Nelson curve", "carbon steel in hydrogen service", "inadequate material selection"],
    teaching_note: "HTHA is invisible from the outside until it is too late. It requires specialized PAUT or advanced UT per API 941."
  },
  creep_damage: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "Time-dependent deformation and void formation at elevated temperatures",
    visual_indicators: ["bulging", "dimensional changes", "oxide scale cracking", "surface micro-cracking in late stages"],
    rt_indicators: ["may show alignment of voids in advanced creep"],
    paut_indicators: ["scattered micro-reflections from void coalescence", "wall strain measurement"],
    common_causes: ["service above creep range (>750F for carbon steel)", "stress + temperature + time", "weldments in creep service"],
    teaching_note: "Creep is slow permanent deformation at high temperature. It progresses through void formation to crack to rupture."
  },
  sigma_phase_embrittlement: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "Formation of brittle sigma phase in austenitic/duplex stainless steels at elevated temperature",
    visual_indicators: ["no visual indication until fracture", "brittle fracture surface"],
    rt_indicators: ["not detectable by RT"],
    paut_indicators: ["velocity change in affected zone", "not reliably detectable"],
    common_causes: ["long exposure 565-925C", "high chromium content", "duplex/super duplex stainless", "cast austenitic materials"],
    teaching_note: "Sigma phase makes stainless steel brittle. It forms during long exposure to certain temperatures and cannot be seen until failure."
  },
  temper_embrittlement: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "Loss of toughness from segregation of impurities to grain boundaries during heat treatment or service",
    visual_indicators: ["no visible indication until brittle fracture occurs"],
    rt_indicators: ["not detectable"],
    paut_indicators: ["not directly detectable — requires hardness or Charpy testing"],
    common_causes: ["Cr-Mo steels held at 375-575C", "impurity elements P, Sn, As, Sb", "slow cooling through embrittlement range"],
    teaching_note: "Temper embrittlement reduces toughness without any visible change. It is detected by Charpy impact testing, not NDE."
  },
  carburization: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Carbon absorption into metal surface at high temperature, causing hardening and embrittlement",
    visual_indicators: ["surface hardening", "magnetic response change in austenitic steel", "scale pattern change"],
    rt_indicators: ["density change at carburized layer"],
    paut_indicators: ["velocity change at carburized surface", "increased hardness by portable tester"],
    common_causes: ["carbon-rich atmosphere at high temperature", "ethylene cracking furnaces", "reformer tubes"],
    teaching_note: "Carburization hardens the surface and makes it brittle. It is common in high-temperature carbon-rich environments."
  },
  metal_dusting: {
    iso_ref: "N/A", group: "in_service", severity: "critical",
    description: "Catastrophic carburization — rapid metal wastage in high-temperature carbon-rich gases",
    visual_indicators: ["pitting with metallic dust", "rapid localized wall loss", "shiny graphite deposits"],
    rt_indicators: ["localized sharp wall loss"],
    paut_indicators: ["localized wall thinning with sharp boundaries"],
    common_causes: ["syngas environments", "high CO activity", "temperatures 400-800C", "nickel alloys and stainless steels"],
    teaching_note: "Metal dusting is aggressive localized attack. The metal literally turns to dust. Requires alloy upgrade or process modification."
  },
  graphitization: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Decomposition of pearlite to ferrite and graphite nodules at elevated temperature",
    visual_indicators: ["no visible external indication", "dark graphite nodules on polished cross-section"],
    rt_indicators: ["not reliably detectable"],
    paut_indicators: ["localized attenuation increase", "scattering from graphite nodules"],
    common_causes: ["carbon steel above 800F for extended time", "carbon-0.5Mo steel", "HAZ of welds in old carbon steel equipment"],
    teaching_note: "Graphitization weakens steel by replacing strong pearlite with soft graphite. Common in old carbon steel equipment in high-temp service."
  },
  disbonding: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Separation of weld overlay, cladding, or lining from base metal",
    visual_indicators: ["bulging or lifting of overlay", "edge separation visible"],
    rt_indicators: ["density change at bond line"],
    paut_indicators: ["strong reflection at bond interface", "loss of bond line signal"],
    common_causes: ["hydrogen accumulation at interface", "thermal cycling", "inadequate bonding during application", "corrosion under lining"],
    teaching_note: "Disbonding separates the protective layer from the base metal. In hydrogen service, hydrogen collects at the interface and pushes the overlay away."
  },
  delamination: {
    iso_ref: "N/A", group: "in_service", severity: "major",
    description: "Internal separation of base metal along rolling plane from inclusions or hydrogen",
    visual_indicators: ["blistering on surface (HIC-related)", "no external indication if internal"],
    rt_indicators: ["laminar dark indication parallel to surface"],
    paut_indicators: ["strong planar reflection at mid-wall", "parallel to plate surface"],
    common_causes: ["hydrogen induced cracking (HIC)", "sulfide inclusions along rolling direction", "poor steel cleanliness"],
    teaching_note: "Delamination is internal separation along the steel rolling plane. It is detected by UT scanning and is often hydrogen-related."
  },

  // -- COATING DISCONTINUITIES --
  coating_blistering: {
    iso_ref: "ISO 4628-2", group: "coating", severity: "major",
    description: "Dome-shaped elevations in coating film from loss of adhesion",
    visual_indicators: ["rounded raised areas in coating", "may contain fluid"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["osmotic pressure", "soluble salts under coating", "cathodic disbondment", "moisture ingress"],
    teaching_note: "Blistering means moisture got under the coating. Check surface preparation and contamination before recoating."
  },
  coating_peeling: {
    iso_ref: "ISO 4628-5", group: "coating", severity: "major",
    description: "Spontaneous loss of adhesion and detachment of coating from substrate",
    visual_indicators: ["coating lifting and curling away from surface", "exposed substrate"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["inadequate surface preparation", "incompatible coating system", "exceeding overcoat window", "contamination"],
    teaching_note: "Peeling means the coating never bonded properly. Surface prep is 80% of a good coating job."
  },
  coating_chalking: {
    iso_ref: "ISO 4628-6", group: "coating", severity: "minor",
    description: "Powdery residue on coating surface from UV degradation of binder",
    visual_indicators: ["white powder on surface", "color fading", "rubs off on contact"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["UV exposure", "aged coating", "wrong coating type for UV exposure", "exceeded service life"],
    teaching_note: "Chalking is normal aging from sun exposure. Light chalking is cosmetic; heavy chalking means the coating needs maintenance."
  },
  coating_rust_creepage: {
    iso_ref: "ISO 4628-3", group: "coating", severity: "major",
    description: "Rust spreading under intact coating from a break or edge",
    visual_indicators: ["rust staining extending from scratch or damaged area", "coating lifting at rust front"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["coating damage exposing steel", "inadequate edge preparation", "thin film at edges", "salt contamination under coating"],
    teaching_note: "Rust creepage spreads under the coating from any break. Proper edge preparation and film thickness at edges are critical."
  },
  coating_holiday: {
    iso_ref: "NACE SP0188", group: "coating", severity: "major",
    description: "Pinhole or discontinuity in coating exposing substrate to environment",
    visual_indicators: ["may not be visible — requires holiday detection testing"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["insufficient film thickness", "contamination during application", "air entrapment", "rough surface profile peaks"],
    teaching_note: "Holidays are invisible holes in the coating. Every coating should be holiday tested with a spark or wet sponge tester before service."
  },
  coating_dft_variance: {
    iso_ref: "SSPC-PA 2", group: "coating", severity: "minor_to_major",
    description: "Dry film thickness outside specified range (too thin or too thick)",
    visual_indicators: ["sags/runs indicate too thick", "visible substrate may indicate too thin"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["improper spray technique", "wrong tip size", "incorrect material viscosity", "environmental conditions"],
    teaching_note: "DFT must be within spec. Too thin provides insufficient protection. Too thick risks cracking and poor adhesion."
  },
  coating_adhesion_failure: {
    iso_ref: "ASTM D4541", group: "coating", severity: "critical",
    description: "Coating fails to meet minimum pull-off adhesion strength",
    visual_indicators: ["coating removable with scraping or tape test", "delamination between coats"],
    rt_indicators: ["not applicable"],
    paut_indicators: ["not applicable"],
    common_causes: ["contaminated surface", "incompatible coating layers", "exceeded recoat window", "moisture during application"],
    teaching_note: "If the coating won't stick, nothing else matters. Adhesion testing (pull-off or cross-cut) verifies the bond is adequate."
  }
};

// ================================================================
// VISION AI — Stage 1: Image Classification & Discontinuity Detection
// Deterministic classifier that maps visual features to discontinuities
// AI vision model provides the raw observations, this engine classifies
// ================================================================

function classifyDiscontinuities(observations, modality, tier) {
  var detected = [];
  var obs = observations || {};
  var obsFeatures = obs.features || [];
  var obsRegions = obs.regions || [];
  var modalityData = MODALITY_KB[modality] || MODALITY_KB["VT"];

  // Build feature set for matching
  var featureSet = {};
  for (var fi = 0; fi < obsFeatures.length; fi++) {
    featureSet[obsFeatures[fi].toLowerCase()] = true;
  }

  // Check each discontinuity against observed features
  var discKeys = Object.keys(DISCONTINUITY_KB);
  for (var di = 0; di < discKeys.length; di++) {
    var discKey = discKeys[di];
    var disc = DISCONTINUITY_KB[discKey];

    // Get modality-specific indicators
    var indicators = [];
    if (modality === "VT") indicators = disc.visual_indicators || [];
    else if (modality === "RT") indicators = disc.rt_indicators || [];
    else if (modality === "PAUT" || modality === "TOFD") indicators = disc.paut_indicators || [];
    else indicators = disc.visual_indicators || [];

    // Check if this discontinuity is physically detectable by this modality
    var detectableByMethod = false;
    var detectableList = modalityData.detectable || [];
    for (var dli = 0; dli < detectableList.length; dli++) {
      if (detectableList[dli].indexOf(discKey) !== -1 || discKey.indexOf(detectableList[dli]) !== -1) {
        detectableByMethod = true;
        break;
      }
    }
    // Also check by group
    if (!detectableByMethod) {
      for (var dli2 = 0; dli2 < detectableList.length; dli2++) {
        if (detectableList[dli2].indexOf(disc.group) !== -1) {
          detectableByMethod = true;
          break;
        }
      }
    }

    // Match features against indicators
    var matchScore = 0;
    var matchedIndicators = [];
    for (var ii = 0; ii < indicators.length; ii++) {
      var indicatorWords = indicators[ii].toLowerCase().split(" ");
      var wordsMatched = 0;
      for (var w = 0; w < indicatorWords.length; w++) {
        if (featureSet[indicatorWords[w]] || obs.raw_description && obs.raw_description.toLowerCase().indexOf(indicatorWords[w]) !== -1) {
          wordsMatched++;
        }
      }
      if (indicatorWords.length > 0 && wordsMatched / indicatorWords.length > 0.4) {
        matchScore += wordsMatched / indicatorWords.length;
        matchedIndicators.push(indicators[ii]);
      }
    }

    // Also match on direct feature naming
    if (featureSet[discKey] || featureSet[discKey.replace(/_/g, " ")]) {
      matchScore += 1.0;
    }
    // Partial key matching
    var keyParts = discKey.split("_");
    var keyPartMatches = 0;
    for (var kp = 0; kp < keyParts.length; kp++) {
      if (featureSet[keyParts[kp]]) keyPartMatches++;
    }
    if (keyParts.length > 0 && keyPartMatches / keyParts.length > 0.5) {
      matchScore += 0.5 * (keyPartMatches / keyParts.length);
    }

    if (matchScore > 0.3) {
      var confidence = round3(Math.min(0.99, modalityData.confidence_base * (matchScore / Math.max(1, indicators.length)) * (detectableByMethod ? 1.0 : 0.4)));

      // Region-of-interest mapping
      var associatedRegions = [];
      for (var ri = 0; ri < obsRegions.length; ri++) {
        var region = obsRegions[ri];
        if (region.label && (region.label.toLowerCase().indexOf(discKey) !== -1 || discKey.indexOf(region.label.toLowerCase().replace(/ /g, "_")) !== -1)) {
          associatedRegions.push(region);
        }
      }

      detected.push({
        discontinuity_type: discKey,
        iso_ref: disc.iso_ref,
        group: disc.group,
        severity: disc.severity,
        confidence: confidence,
        match_score: round3(matchScore),
        matched_indicators: matchedIndicators,
        detectable_by_method: detectableByMethod,
        description: disc.description,
        regions: associatedRegions,
        teaching_note: tier === "basic" ? disc.teaching_note : null
      });
    }
  }

  // Sort by confidence descending
  detected.sort(function(a, b) { return b.confidence - a.confidence; });

  return detected;
}

// ================================================================
// CODE AUTHORITY ROUTER — Stage 2: Route to governing code + criteria
// ================================================================

var ACCEPTANCE_CRITERIA = {
  aws_d1_1: {
    code_name: "AWS D1.1",
    edition: "2025 (26th Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "Table 8.9 / 8.10 / 8.11", note: "No cracks permitted regardless of size or location" },
      lack_of_fusion: { accept: false, max_length_mm: 0, clause: "Table 8.9 / 8.10 / 8.11", note: "No lack of fusion permitted" },
      lack_of_penetration: { accept: false, max_length_mm: 0, clause: "Table 8.9", note: "Complete joint penetration required where specified" },
      porosity: { accept: "conditional", max_diameter_mm: null, max_aggregate_per_inch: null, clause: "Table 8.9",
        conditions: "Static: sum of diameters shall not exceed 3/8 in. (10mm) in any linear inch. Cyclic: 1/8 in. (3mm) max individual" },
      slag_inclusion: { accept: "conditional", clause: "Table 8.9",
        conditions: "Static: max 3/4 in. (19mm) length in 12 in., clearance >= 2L. Cyclic: max 3/8 in. (10mm)" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "Table 8.9",
        conditions: "Max 1/32 in. (0.8mm) depth for material <= 3/4 in.; 1/16 in. for thicker if intermittent" },
      excess_reinforcement: { accept: "conditional", clause: "5.9.1.4",
        conditions: "Max 1/8 in. (3mm) for butt joints" },
      burn_through: { accept: false, clause: "Table 8.9", note: "Not permitted" },
      overlap: { accept: false, clause: "Table 8.9", note: "Not permitted" }
    }
  },
  api_1104: {
    code_name: "API 1104",
    edition: "22nd Edition (2021)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "9.3.1", note: "No cracks permitted" },
      lack_of_fusion: { accept: "conditional", clause: "9.3.3",
        conditions: "IF <= 1 in. individual, <= 1 in. aggregate in 12 in., and <= 8% of weld length" },
      lack_of_penetration: { accept: "conditional", clause: "9.3.2",
        conditions: "IF <= 1 in. individual, <= 1 in. aggregate in 12 in., and <= 8% of weld length" },
      porosity: { accept: "conditional", clause: "9.3.5",
        conditions: "Individual pore max 1/8 in. (3mm); distribution per Table 3" },
      slag_inclusion: { accept: "conditional", clause: "9.3.4",
        conditions: "Elongated: max 2 in. individual, 3 in. aggregate per 12 in." },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "9.3.9",
        conditions: "Max 1/32 in. (0.8mm) or 12.5% of wall, whichever is smaller" },
      burn_through: { accept: "conditional", clause: "9.3.7",
        conditions: "Max 1/4 in. (6mm) and adequately fused" }
    }
  },
  asme_bpvc_ix: {
    code_name: "ASME BPVC Section IX / Section VIII Div.1",
    edition: "2023 Edition",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "UW-51(a)", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, max_length_mm: 0, clause: "UW-51(a)", note: "Not permitted for full penetration joints" },
      lack_of_penetration: { accept: false, max_length_mm: 0, clause: "UW-51(a)", note: "Not permitted for full penetration joints" },
      porosity: { accept: "conditional", clause: "Appendix 4",
        conditions: "Per acceptance chart — depends on thickness and porosity size" },
      slag_inclusion: { accept: "conditional", clause: "Appendix 4",
        conditions: "Max 2/3t in length, aligned slag min clearance 3L, max aggregate per 12L = t" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "UW-35",
        conditions: "Max 1/32 in. (0.8mm)" }
    }
  },
  aws_d1_3: {
    code_name: "AWS D1.3 Sheet Steel",
    edition: "2018",
    criteria: {
      crack: { accept: false, clause: "4.3", note: "No cracks permitted" },
      porosity: { accept: "conditional", clause: "4.3",
        conditions: "Max 3/8 in. aggregate in 1 in. length" },
      undercut: { accept: "conditional", max_depth_mm: 0.5, clause: "4.3",
        conditions: "Max 1/64 in. (0.4mm) in sheet steel" }
    }
  },
  dnv_os_c401: {
    code_name: "DNV-OS-C401 Fabrication and Testing of Offshore Structures",
    edition: "2020",
    criteria: {
      crack: { accept: false, clause: "4.3.2", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "4.3.2", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "4.3.2", note: "Not permitted for full penetration joints" },
      porosity: { accept: "conditional", clause: "4.3.2",
        conditions: "Quality level B per ISO 5817 — individual pore max 0.3s (s=weld size), max 0.3 x weld area aggregate" },
      slag_inclusion: { accept: "conditional", clause: "4.3.2",
        conditions: "Per ISO 5817 level B — max length = 0.3s or 2mm whichever is greater" },
      undercut: { accept: "conditional", max_depth_mm: 0.5, clause: "4.3.2",
        conditions: "Max 0.5mm for quality level B" },
      excess_reinforcement: { accept: "conditional", clause: "4.3.2",
        conditions: "Per ISO 5817 level B — max 1mm + 0.1b (b=weld width)" },
      burn_through: { accept: false, clause: "4.3.2", note: "Not permitted" },
      misalignment: { accept: "conditional", clause: "4.3.2",
        conditions: "Max 0.1t or 3mm whichever is smaller" }
    }
  },
  // ---- PIPELINE CODES ----
  asme_b31_1: {
    code_name: "ASME B31.1 Power Piping",
    edition: "2024 Edition",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "136.4", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "136.4", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "136.4", note: "Not permitted for full penetration joints" },
      porosity: { accept: "conditional", clause: "136.4.2",
        conditions: "Per ASME Section VIII Appendix 4 charts — thickness-dependent" },
      slag_inclusion: { accept: "conditional", clause: "136.4.2",
        conditions: "Per ASME Section VIII Appendix 4 — max 2/3t individual" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "136.4.2",
        conditions: "Max 1/32 in. (0.8mm)" },
      excess_reinforcement: { accept: "conditional", clause: "127.4.2",
        conditions: "Per Table 127.4.2 — max 3/32 in. for wall <= 3/4 in." }
    }
  },
  asme_b31_3: {
    code_name: "ASME B31.3 Process Piping",
    edition: "2024 Edition",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "341.3.2", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "341.3.2", note: "Not permitted" },
      lack_of_penetration: { accept: "conditional", clause: "341.3.2",
        conditions: "Normal: max 1/32 in. or 25% of thinner wall. Severe cyclic: not permitted" },
      porosity: { accept: "conditional", clause: "341.3.2",
        conditions: "Per ASME Section VIII Appendix 4 charts" },
      slag_inclusion: { accept: "conditional", clause: "341.3.2",
        conditions: "Max 2/3t individual, max t aggregate per 12t weld length" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "341.3.2",
        conditions: "Normal: max 1/32 in. (0.8mm). Severe cyclic: max 0.4mm" },
      excess_reinforcement: { accept: "conditional", clause: "328.4.2",
        conditions: "Max 1/16 in. (1.6mm) for wall <= 3/4 in." }
    }
  },
  asme_b31_4: {
    code_name: "ASME B31.4 Pipeline Transportation Systems for Liquids",
    edition: "2022 Edition",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "434.8.5", note: "No cracks permitted" },
      lack_of_fusion: { accept: "conditional", clause: "434.8.5",
        conditions: "Per API 1104 Section 9 criteria — max 1 in. individual, 1 in. aggregate per 12 in." },
      lack_of_penetration: { accept: "conditional", clause: "434.8.5",
        conditions: "Per API 1104 Section 9 criteria" },
      porosity: { accept: "conditional", clause: "434.8.5",
        conditions: "Per API 1104 Table 3 distribution limits" },
      slag_inclusion: { accept: "conditional", clause: "434.8.5",
        conditions: "Per API 1104 Section 9.3.4 — max 2 in. individual" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "434.8.5",
        conditions: "Max 1/32 in. (0.8mm) or 12.5% of wall thickness" },
      burn_through: { accept: "conditional", clause: "434.8.5",
        conditions: "Per API 1104 — max 1/4 in. (6mm) if adequately fused" }
    }
  },
  asme_b31_8: {
    code_name: "ASME B31.8 Gas Transmission and Distribution Piping",
    edition: "2022 Edition",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "826.4", note: "No cracks permitted" },
      lack_of_fusion: { accept: "conditional", clause: "826.4",
        conditions: "Per API 1104 Section 9 criteria" },
      lack_of_penetration: { accept: "conditional", clause: "826.4",
        conditions: "Per API 1104 Section 9 criteria" },
      porosity: { accept: "conditional", clause: "826.4",
        conditions: "Per API 1104 Table 3" },
      slag_inclusion: { accept: "conditional", clause: "826.4",
        conditions: "Per API 1104 Section 9.3.4" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "826.4",
        conditions: "Max 1/32 in. (0.8mm) or 12.5% of wall" }
    }
  },
  // ---- STORAGE TANK ----
  api_650: {
    code_name: "API 650 Welded Tanks for Oil Storage",
    edition: "13th Edition (2020, Addendum 4 2023)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "8.5.2", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "8.5.2", note: "Not permitted in shell-to-bottom and shell joints" },
      lack_of_penetration: { accept: false, clause: "8.5.2", note: "Not permitted in full penetration joints" },
      porosity: { accept: "conditional", clause: "8.5.3",
        conditions: "Individual pore max 1/4t or 3/16 in. whichever is less. Cluster: max 1 in. in any 6 in. length" },
      slag_inclusion: { accept: "conditional", clause: "8.5.3",
        conditions: "Individual max 1/3t or 3/4 in. whichever is less. Aggregate max t in 12t weld length" },
      undercut: { accept: "conditional", max_depth_mm: 0.4, clause: "8.5.3",
        conditions: "Max 1/64 in. (0.4mm) in shell courses with design stress > 2/3 allowable. Max 1/32 in. in others" },
      burn_through: { accept: false, clause: "8.5.2", note: "Not permitted" },
      excess_reinforcement: { accept: "conditional", clause: "8.5.3",
        conditions: "Max 3/32 in. (2.4mm) for wall <= 1/2 in.; max 1/8 in. for thicker" },
      misalignment: { accept: "conditional", clause: "7.5.2",
        conditions: "Vertical joints: max 1/16t or 1/8 in. whichever is greater. Horizontal: max 1/16 in." }
    }
  },
  // ---- STRUCTURAL CODES ----
  aws_d1_2: {
    code_name: "AWS D1.2/D1.2M Structural Welding Code - Aluminum",
    edition: "2014 (5th Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "Table 8.1", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "Table 8.1", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "Table 8.1", note: "Not permitted where CJP required" },
      porosity: { accept: "conditional", clause: "Table 8.1",
        conditions: "Static: aggregate max 3/8 in. per linear inch. Cyclic: max 1/8 in. individual" },
      slag_inclusion: { accept: "conditional", clause: "Table 8.1",
        conditions: "Static: max 3/4 in. individual, clearance >= 2L" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "Table 8.1",
        conditions: "Max 1/32 in. (0.8mm) for static loads" },
      burn_through: { accept: false, clause: "Table 8.1", note: "Not permitted" },
      excess_reinforcement: { accept: "conditional", clause: "5.5.1",
        conditions: "Max 1/8 in. (3mm) for butt joints" }
    }
  },
  aws_d1_4: {
    code_name: "AWS D1.4/D1.4M Structural Welding Code - Reinforcing Steel",
    edition: "2011 (2nd Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "6.5.1", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "6.5.1", note: "Not permitted" },
      porosity: { accept: "conditional", clause: "6.5.3",
        conditions: "Max 1/8 in. (3mm) individual for direct butt splice; per AWS D1.1 Table 8.9 for flare-bevel" },
      slag_inclusion: { accept: "conditional", clause: "6.5.3",
        conditions: "Max 3/4 in. (19mm) in 12 in. weld length" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "6.5.3",
        conditions: "Max 1/32 in. (0.8mm)" },
      excess_reinforcement: { accept: "conditional", clause: "6.5.3",
        conditions: "Max 1/8 in. (3mm)" }
    }
  },
  aws_d1_5: {
    code_name: "AWS D1.5M/D1.5 Bridge Welding Code",
    edition: "2020 (8th Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "6.26.1", note: "No cracks permitted — all bridge welds treated as fatigue-loaded" },
      lack_of_fusion: { accept: false, clause: "6.26.1", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "6.26.1", note: "Not permitted for CJP joints" },
      porosity: { accept: "conditional", clause: "6.26.2",
        conditions: "Cyclic criteria always apply: individual max 1/8 in. (3mm); aggregate limited by cluster rules" },
      slag_inclusion: { accept: "conditional", clause: "6.26.2",
        conditions: "Cyclic: max 3/8 in. (10mm) individual length" },
      undercut: { accept: "conditional", max_depth_mm: 0.25, clause: "6.26.2",
        conditions: "Max 0.25mm (0.01 in.) for fracture-critical members; 0.8mm for non-FCM" },
      excess_reinforcement: { accept: "conditional", clause: "6.26.2",
        conditions: "Max 1/8 in. (3mm) flush ground for FCM" },
      overlap: { accept: false, clause: "6.26.1", note: "Not permitted" }
    }
  },
  aws_d1_6: {
    code_name: "AWS D1.6/D1.6M Structural Welding Code - Stainless Steel",
    edition: "2017 (2nd Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "6.28", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "6.28", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "6.28", note: "Not permitted for CJP joints" },
      porosity: { accept: "conditional", clause: "6.28.1",
        conditions: "Static: aggregate max 3/8 in. per linear inch. Cyclic: 1/8 in. max individual" },
      slag_inclusion: { accept: "conditional", clause: "6.28.1",
        conditions: "Per AWS D1.1 criteria adapted for stainless properties" },
      undercut: { accept: "conditional", max_depth_mm: 0.8, clause: "6.28.1",
        conditions: "Max 1/32 in. (0.8mm) for static loads" },
      excess_reinforcement: { accept: "conditional", clause: "6.28.1",
        conditions: "Max 1/8 in. (3mm) for butt joints" },
      overlap: { accept: false, clause: "6.28", note: "Not permitted" }
    }
  },
  aws_d1_8: {
    code_name: "AWS D1.8/D1.8M Structural Welding Code - Seismic Supplement",
    edition: "2016 (2nd Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "6.3", note: "No cracks permitted in demand-critical connections" },
      lack_of_fusion: { accept: false, clause: "6.3", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "6.3", note: "Not permitted" },
      porosity: { accept: "conditional", clause: "6.3.1",
        conditions: "Demand-critical: max 1/16 in. (1.6mm) individual; aggregate max 3/16 in. per inch" },
      slag_inclusion: { accept: "conditional", clause: "6.3.1",
        conditions: "Max 1/4 in. (6mm) individual length in demand-critical" },
      undercut: { accept: "conditional", max_depth_mm: 0.25, clause: "6.3.1",
        conditions: "Max 0.25mm (0.01 in.) for demand-critical connections" },
      excess_reinforcement: { accept: "conditional", clause: "6.3.1",
        conditions: "Max 1/16 in. (1.6mm) for demand-critical butt joints — flush grinding may be required" }
    }
  },
  // ---- AEROSPACE ----
  aws_d17_1: {
    code_name: "AWS D17.1/D17.1M Specification for Fusion Welding for Aerospace Applications",
    edition: "2017 (2nd Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "7.4", note: "No cracks permitted — Class A, B, or C" },
      lack_of_fusion: { accept: false, clause: "7.4", note: "Not permitted in any class" },
      lack_of_penetration: { accept: false, clause: "7.4", note: "Not permitted — full penetration required where specified" },
      porosity: { accept: "conditional", clause: "7.4 Table 4",
        conditions: "Class A: max 0.25t or 0.76mm individual. Class B: max 0.33t or 1.5mm. Cumulative per inch varies by class" },
      slag_inclusion: { accept: "conditional", clause: "7.4 Table 4",
        conditions: "Class A: max 0.5t or 1.5mm. Class B: max 0.75t or 2.5mm" },
      undercut: { accept: "conditional", max_depth_mm: 0.13, clause: "7.4 Table 5",
        conditions: "Class A: max 0.05t or 0.13mm (0.005 in.) whichever is less. Class B: max 0.07t or 0.25mm" },
      excess_reinforcement: { accept: "conditional", clause: "7.4 Table 5",
        conditions: "Class A: max 0.03 in. (0.76mm). Class B: max 0.06 in. (1.5mm)" },
      burn_through: { accept: false, clause: "7.4", note: "Not permitted in any class" },
      misalignment: { accept: "conditional", clause: "7.4 Table 5",
        conditions: "Class A: max 0.1t. Class B: max 0.15t" }
    }
  },
  // ---- NUCLEAR ----
  asme_section_iii: {
    code_name: "ASME BPVC Section III Rules for Nuclear Facility Components",
    edition: "2023 Edition",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "NB-5330", note: "No cracks permitted — Class 1 components" },
      lack_of_fusion: { accept: false, clause: "NB-5330", note: "Not permitted" },
      lack_of_penetration: { accept: false, clause: "NB-5330", note: "Not permitted" },
      porosity: { accept: "conditional", clause: "NB-5330, T-283",
        conditions: "Per ASME Section V Article 2 acceptance charts — more restrictive than Section VIII" },
      slag_inclusion: { accept: "conditional", clause: "NB-5330, T-283",
        conditions: "Linear: max 1/6t for t <= 2 in.; max 1/3 in. for t > 2 in. Aligned: clearance >= 3L" },
      undercut: { accept: "conditional", max_depth_mm: 0.4, clause: "NB-5330",
        conditions: "Max 1/64 in. (0.4mm) — more restrictive than Section VIII" },
      excess_reinforcement: { accept: "conditional", clause: "NB-4426",
        conditions: "Max 3/32 in. (2.4mm) for wall <= 5/8 in.; flush for Class 1 austenitic" },
      burn_through: { accept: false, clause: "NB-5330", note: "Not permitted" },
      overlap: { accept: false, clause: "NB-5330", note: "Not permitted" }
    }
  },
  // ---- RAILROAD ----
  arema: {
    code_name: "AREMA Manual for Railway Engineering — Chapter 4 Rail",
    edition: "2023",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "4.2.9", note: "No cracks permitted in rail welds" },
      lack_of_fusion: { accept: false, clause: "4.2.9", note: "Not permitted — full fusion required in thermite and flash butt welds" },
      porosity: { accept: "conditional", clause: "4.2.9",
        conditions: "Individual max 1/16 in. (1.6mm) diameter; max 3 pores per inch" },
      slag_inclusion: { accept: "conditional", clause: "4.2.9",
        conditions: "Max 1/4 in. (6mm) individual length" },
      undercut: { accept: "conditional", max_depth_mm: 0.4, clause: "4.2.9",
        conditions: "Max 1/64 in. (0.4mm)" },
      excess_reinforcement: { accept: "conditional", clause: "4.2.9",
        conditions: "Must be ground flush to running surface profile" },
      misalignment: { accept: "conditional", clause: "4.2.9",
        conditions: "Rail end alignment max 1/32 in. (0.8mm) vertical, 1/16 in. (1.6mm) lateral" },
      burn_through: { accept: false, clause: "4.2.9", note: "Not permitted" }
    }
  },
  // ---- ISO QUALITY LEVELS ----
  iso_5817: {
    code_name: "ISO 5817 Welding — Fusion-welded Joints in Steel, Nickel, Titanium — Quality Levels",
    edition: "2023 (4th Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "Table 1 Ref 1.x", note: "No cracks permitted at any quality level (B, C, or D)" },
      lack_of_fusion: { accept: false, clause: "Table 1 Ref 4.x", note: "Not permitted at level B or C" },
      lack_of_penetration: { accept: "conditional", clause: "Table 1 Ref 4.x",
        conditions: "Level B: not permitted. Level C: max 0.2s or 2mm. Level D: max 0.3s or 3mm" },
      porosity: { accept: "conditional", clause: "Table 1 Ref 2.x",
        conditions: "Level B: max 0.2s individual, 1% area. Level C: max 0.3s, 1.5% area. Level D: max 0.4s, 2.5% area" },
      slag_inclusion: { accept: "conditional", clause: "Table 1 Ref 3.x",
        conditions: "Level B: max 0.3s or 2mm. Level C: max 0.4s or 3mm. Level D: max 0.5s or 4mm" },
      undercut: { accept: "conditional", max_depth_mm: 0.5, clause: "Table 1 Ref 5.x",
        conditions: "Level B: max 0.5mm. Level C: max 0.5mm intermittent, 1mm short. Level D: max 1mm" },
      excess_reinforcement: { accept: "conditional", clause: "Table 1 Ref 5.x",
        conditions: "Level B: max 1mm + 0.1b. Level C: max 1mm + 0.15b. Level D: max 1mm + 0.25b" },
      misalignment: { accept: "conditional", clause: "Table 1 Ref 5.x",
        conditions: "Level B: max 0.1t or 2mm. Level C: max 0.15t or 3mm. Level D: max 0.25t or 5mm" },
      overlap: { accept: false, clause: "Table 1 Ref 5.x", note: "Not permitted at level B" }
    }
  },
  // ---- SHEET STEEL EXPANDED ----
  aws_d1_3_expanded: {
    code_name: "AWS D1.3/D1.3M Structural Welding Code - Sheet Steel",
    edition: "2018 (2nd Edition)",
    criteria: {
      crack: { accept: false, max_length_mm: 0, clause: "4.3.1", note: "No cracks permitted" },
      lack_of_fusion: { accept: false, clause: "4.3.1", note: "Not permitted" },
      porosity: { accept: "conditional", clause: "4.3.2",
        conditions: "Max 3/8 in. (10mm) aggregate in any 1 in. of weld" },
      slag_inclusion: { accept: "conditional", clause: "4.3.2",
        conditions: "Per AWS D1.1 criteria proportioned for sheet steel thickness" },
      undercut: { accept: "conditional", max_depth_mm: 0.4, clause: "4.3.2",
        conditions: "Max 1/64 in. (0.4mm) — more restrictive than D1.1 due to thin material" },
      burn_through: { accept: "conditional", clause: "4.3.2",
        conditions: "Permissible if repaired and resulting joint meets strength requirements" },
      excess_reinforcement: { accept: "conditional", clause: "4.3.2",
        conditions: "Max 1/16 in. (1.6mm) for sheet metal fillet welds" },
      overlap: { accept: false, clause: "4.3.1", note: "Not permitted" }
    }
  },
  // ---- COATINGS STANDARDS ----
  sspc_pa_2: {
    code_name: "SSPC-PA 2 Measurement of DFT with Magnetic Gages",
    edition: "2020",
    criteria: {
      coating_dft_variance: { accept: "conditional", clause: "Section 4.3",
        conditions: "No single reading below 80% of specified DFT. Average of all readings must meet or exceed specified DFT" },
      coating_holiday: { accept: false, clause: "Referenced by SSPC-PA 2 + NACE SP0188",
        note: "Any holiday (bare spot) is rejectable — must be repaired and retested" }
    }
  },
  nace_sp0188: {
    code_name: "NACE SP0188 (AMPP SP21478) Discontinuity (Holiday) Testing of New Protective Coatings on Conductive Substrates",
    edition: "2022",
    criteria: {
      coating_holiday: { accept: false, clause: "Section 4",
        note: "Any holiday detected by low-voltage wet sponge or high-voltage spark test requires repair" },
      coating_blistering: { accept: "conditional", clause: "Section 4",
        conditions: "Any blistering indicates coating failure at that location — investigate root cause" }
    }
  },
  iso_12944: {
    code_name: "ISO 12944 Paints and Varnishes — Corrosion Protection of Steel Structures by Protective Paint Systems",
    edition: "2018 (Parts 1-9)",
    criteria: {
      coating_blistering: { accept: "conditional", clause: "Part 6 Table 5",
        conditions: "Size 2 density 2 max acceptable for category C3-C5. Any blistering rejectable for CX (immersion)" },
      coating_peeling: { accept: false, clause: "Part 6",
        note: "Any spontaneous peeling or flaking is rejectable" },
      coating_rust_creepage: { accept: "conditional", clause: "Part 6 Table 5",
        conditions: "Max 1mm creepage from scribe for C5 and CX categories. Max 3mm for C3" },
      coating_chalking: { accept: "conditional", clause: "Part 6",
        conditions: "Degree 1 (trace) acceptable. Degree 3+ (heavy) requires maintenance" },
      coating_adhesion_failure: { accept: "conditional", clause: "Part 6",
        conditions: "Pull-off adhesion min 5 MPa for most systems. Min 3 MPa for some primers" },
      coating_dft_variance: { accept: "conditional", clause: "Part 7",
        conditions: "DFT within system manufacturer specification. No measurement below 80% of nominal" }
    }
  },
  iso_8501: {
    code_name: "ISO 8501 Preparation of Steel Substrates — Visual Assessment of Surface Cleanliness",
    edition: "2007 (Part 1), 2017 (Part 4)",
    criteria: {
      surface_preparation: { accept: "conditional", clause: "Part 1",
        conditions: "Sa 2.5 (near-white) minimum for most protective coatings. Sa 3 (white metal) for immersion service" },
      rust_grade: { accept: "conditional", clause: "Part 1",
        conditions: "Grade A: steel covered with mill scale. Grade B: rusting, mill scale flaking. Grade C: mill scale rusted off. Grade D: pitted" }
    }
  },
  // ---- ARCHITECTURAL / STRUCTURAL ENGINEERING ----
  aisc_360: {
    code_name: "AISC 360 Specification for Structural Steel Buildings",
    edition: "2022 (16th Edition)",
    criteria: {
      crack: { accept: false, clause: "J2.6 + AWS D1.1", note: "No cracks permitted per AWS D1.1 Table 8.9" },
      lack_of_fusion: { accept: false, clause: "J2.6 + AWS D1.1", note: "Per AWS D1.1 — references D1.1 for all weld quality" },
      undercut: { accept: "conditional", clause: "J2.6 + AWS D1.1 Table 8.9",
        conditions: "Per AWS D1.1: max 1/32 in. for material <= 3/4 in." },
      porosity: { accept: "conditional", clause: "J2.6 + AWS D1.1",
        conditions: "Per AWS D1.1 Table 8.9 static or cyclic criteria depending on connection type" },
      misalignment: { accept: "conditional", clause: "M2.5",
        conditions: "Column splice: max 1/4 in. offset. Beam: per erection tolerances AISC Code of Standard Practice" }
    }
  },
  ibc_welding: {
    code_name: "IBC International Building Code — Structural Welding Requirements",
    edition: "2024",
    criteria: {
      crack: { accept: false, clause: "IBC 2204 references AWS D1.1",
        note: "All structural welding per AWS D1.1 or applicable AWS code. No cracks permitted." },
      lack_of_fusion: { accept: false, clause: "IBC 2204",
        note: "Per referenced AWS D1.x standard" },
      undercut: { accept: "conditional", clause: "IBC 2204 references AWS D1.1",
        conditions: "Per applicable AWS D1.x code criteria" },
      porosity: { accept: "conditional", clause: "IBC 2204",
        conditions: "Per applicable AWS D1.x code criteria — static or cyclic as designated by engineer of record" }
    }
  },
  // ---- IN-SERVICE INSPECTION CODES ----
  api_510: {
    code_name: "API 510 Pressure Vessel Inspection Code",
    edition: "11th Edition (2023)",
    criteria: {
      crack: { accept: false, clause: "7.4.2", note: "Cracks require engineering evaluation per API 579-1" },
      general_corrosion: { accept: "conditional", clause: "7.4.3",
        conditions: "Acceptable if remaining thickness > tmin + corrosion allowance. Calculate remaining life per 7.4.3.2" },
      pitting_corrosion: { accept: "conditional", clause: "7.4.3.4",
        conditions: "Evaluate per API 579-1 Part 6. Remaining strength depends on pit density and depth" },
      stress_corrosion_cracking: { accept: false, clause: "7.4.2",
        note: "Requires FFS evaluation per API 579-1 Part 9" },
      htha: { accept: false, clause: "7.4.2",
        note: "Requires immediate engineering evaluation per API 941 and API 579-1" },
      erosion: { accept: "conditional", clause: "7.4.3",
        conditions: "Same as general corrosion — remaining life based on measured thinning rate" }
    }
  },
  api_570: {
    code_name: "API 570 Piping Inspection Code",
    edition: "4th Edition (2016, Addendum 2020)",
    criteria: {
      crack: { accept: false, clause: "7.3.1", note: "Cracks require engineering evaluation per API 579-1" },
      general_corrosion: { accept: "conditional", clause: "7.3.2",
        conditions: "Acceptable if remaining wall > tmin. Remaining life = (t_actual - t_min) / corrosion_rate" },
      pitting_corrosion: { accept: "conditional", clause: "7.3.2",
        conditions: "Evaluate per API 579-1 Part 6" },
      erosion: { accept: "conditional", clause: "7.3.2",
        conditions: "Same as corrosion — remaining life based on measured loss rate" },
      stress_corrosion_cracking: { accept: false, clause: "7.3.1",
        note: "Requires FFS evaluation" }
    }
  },
  api_653: {
    code_name: "API 653 Tank Inspection, Repair, Alteration, and Reconstruction",
    edition: "5th Edition (2014, Addendum 3 2018)",
    criteria: {
      crack: { accept: false, clause: "6.3.1", note: "Shell cracks require engineering evaluation or repair" },
      general_corrosion: { accept: "conditional", clause: "6.3.2",
        conditions: "Shell: remaining thickness > tmin per API 653 Appendix B formula. Bottom: min 0.1 in. (2.5mm) remaining" },
      pitting_corrosion: { accept: "conditional", clause: "6.3.3",
        conditions: "Evaluate per API 579-1 Part 6 or API 653 simplified assessment" },
      undercut: { accept: "conditional", clause: "6.3.4",
        conditions: "Per original construction code (typically API 650)" },
      settlement: { accept: "conditional", clause: "6.3.7",
        conditions: "Evaluate per API 653 Appendix B settlement criteria — differential settlement limits" }
    }
  }
};

function routeToCode(codeKey, discontinuityType) {
  var codeData = ACCEPTANCE_CRITERIA[codeKey];
  if (!codeData) {
    return { error: "Code not found: " + codeKey, available_codes: Object.keys(ACCEPTANCE_CRITERIA) };
  }

  // Normalize discontinuity type to base type for criteria lookup
  var baseType = discontinuityType;
  if (baseType.indexOf("crack") !== -1 && baseType !== "crater_crack" && baseType.indexOf("coating") === -1) baseType = "crack";
  if (baseType.indexOf("porosity") !== -1) baseType = "porosity";
  if (baseType.indexOf("slag") !== -1 || baseType.indexOf("tungsten_inclusion") !== -1) baseType = "slag_inclusion";
  if (baseType.indexOf("lack_of_fusion") !== -1 || baseType === "lof") baseType = "lack_of_fusion";
  if (baseType.indexOf("lack_of_penetration") !== -1 || baseType === "lop") baseType = "lack_of_penetration";
  if (baseType.indexOf("undercut") !== -1) baseType = "undercut";
  if (baseType.indexOf("misalignment") !== -1 || baseType === "hi_lo") baseType = "misalignment";
  if (baseType.indexOf("reinforcement") !== -1 || baseType === "underfill") baseType = "excess_reinforcement";
  if (baseType.indexOf("burn_through") !== -1 || baseType === "melt_through") baseType = "burn_through";
  if (baseType.indexOf("overlap") !== -1 || baseType === "cold_lap") baseType = "overlap";
  if (baseType.indexOf("erosion") !== -1 && baseType.indexOf("coating") === -1) baseType = "erosion";
  if (baseType.indexOf("general_corrosion") !== -1) baseType = "general_corrosion";
  if (baseType.indexOf("pitting") !== -1 && baseType.indexOf("coating") === -1) baseType = "pitting_corrosion";
  if (baseType.indexOf("blistering") !== -1) baseType = "coating_blistering";
  if (baseType.indexOf("peeling") !== -1) baseType = "coating_peeling";
  if (baseType.indexOf("holiday") !== -1) baseType = "coating_holiday";
  if (baseType.indexOf("dft") !== -1) baseType = "coating_dft_variance";
  if (baseType.indexOf("adhesion") !== -1) baseType = "coating_adhesion_failure";
  if (baseType.indexOf("chalking") !== -1) baseType = "coating_chalking";
  if (baseType.indexOf("rust_creepage") !== -1) baseType = "coating_rust_creepage";

  var criteria = codeData.criteria[baseType];
  if (!criteria) {
    return {
      code: codeData.code_name,
      edition: codeData.edition,
      discontinuity: discontinuityType,
      result: "NO_SPECIFIC_CRITERIA",
      note: "No specific acceptance criteria found for this discontinuity type in this code. Refer to engineer of record."
    };
  }

  return {
    code: codeData.code_name,
    edition: codeData.edition,
    discontinuity: discontinuityType,
    base_type: baseType,
    accept: criteria.accept,
    clause: criteria.clause,
    conditions: criteria.conditions || null,
    note: criteria.note || null,
    max_length_mm: criteria.max_length_mm || null,
    max_depth_mm: criteria.max_depth_mm || null
  };
}

// ================================================================
// PHYSICS CONSEQUENCE ENGINE — Stage 3: Impact assessment
// ================================================================

function assessPhysicsConsequence(discontinuities, context) {
  var wallThickness = context.wall_thickness_mm || null;
  var designPressure = context.design_pressure_psi || null;
  var material = context.material || null;
  var service = context.service_condition || null;
  var temperature = context.temperature_f || null;

  var consequences = [];
  var overallRisk = "LOW";
  var escalationFactors = [];

  for (var di = 0; di < discontinuities.length; di++) {
    var disc = discontinuities[di];
    var consequence = {
      discontinuity: disc.discontinuity_type,
      severity: disc.severity,
      physics_impact: null,
      failure_mode: null,
      remaining_life_impact: null,
      interaction_risk: null
    };

    // Crack-type discontinuities — fracture mechanics impact
    if (disc.group === "crack") {
      consequence.physics_impact = "HIGH";
      consequence.failure_mode = "brittle_fracture_or_fatigue_propagation";
      consequence.remaining_life_impact = "significant_reduction";

      // Service condition escalation
      if (service === "sour" || service === "h2s") {
        consequence.physics_impact = "CRITICAL";
        consequence.failure_mode = "environmentally_assisted_cracking_propagation";
        escalationFactors.push("Crack in sour/H2S service — accelerated propagation risk");
      }
      if (service === "cyclic" || service === "fatigue") {
        consequence.physics_impact = "CRITICAL";
        consequence.failure_mode = "fatigue_crack_growth";
        escalationFactors.push("Crack under cyclic loading — fatigue propagation inevitable");
      }
      if (service === "cryogenic" && temperature !== null && temperature < -20) {
        consequence.physics_impact = "CRITICAL";
        consequence.failure_mode = "low_temperature_brittle_fracture";
        escalationFactors.push("Crack at cryogenic temperature — brittle fracture risk");
      }

      overallRisk = "HIGH";
    }

    // Fusion defects — structural integrity impact
    if (disc.group === "fusion_defect") {
      consequence.physics_impact = "HIGH";
      consequence.failure_mode = "load_path_discontinuity";
      consequence.remaining_life_impact = "moderate_to_significant_reduction";

      // LOF acts as crack initiator under fatigue
      if (service === "cyclic" || service === "fatigue") {
        consequence.physics_impact = "CRITICAL";
        escalationFactors.push("Fusion defect acts as fatigue crack initiator");
      }

      if (overallRisk !== "CRITICAL") overallRisk = "HIGH";
    }

    // Gas/solid inclusions — stress concentration
    if (disc.group === "gas_inclusion" || disc.group === "solid_inclusion") {
      consequence.physics_impact = "LOW_TO_MODERATE";
      consequence.failure_mode = "stress_concentration_and_possible_crack_initiation";
      consequence.remaining_life_impact = "minor_unless_clustered_or_aligned";

      // Clustered or aligned porosity acts differently
      if (disc.discontinuity_type === "cluster_porosity" || disc.discontinuity_type === "linear_porosity") {
        consequence.physics_impact = "MODERATE";
        consequence.remaining_life_impact = "moderate_reduction_net_section_loss";
      }
    }

    // Shape defects — stress risers
    if (disc.group === "shape_defect") {
      consequence.physics_impact = "LOW_TO_MODERATE";
      consequence.failure_mode = "stress_concentration_at_geometric_discontinuity";
      consequence.remaining_life_impact = "minor_unless_combined_with_fatigue";

      if (disc.discontinuity_type === "burn_through") {
        consequence.physics_impact = "HIGH";
        consequence.failure_mode = "through_wall_breach";
        consequence.remaining_life_impact = "immediate_repair_required";
      }
    }

    // In-service degradation
    if (disc.group === "in_service") {
      if (disc.discontinuity_type === "stress_corrosion_cracking" || disc.discontinuity_type === "htha" ||
          disc.discontinuity_type === "metal_dusting" || disc.discontinuity_type === "sigma_phase_embrittlement" ||
          disc.discontinuity_type === "temper_embrittlement") {
        consequence.physics_impact = "CRITICAL";
        consequence.failure_mode = disc.discontinuity_type === "htha" ? "internal_decarburization_and_fissuring" :
          disc.discontinuity_type === "metal_dusting" ? "catastrophic_localized_wastage" :
          disc.discontinuity_type.indexOf("embrittlement") !== -1 ? "sudden_brittle_fracture_risk" :
          "rapid_through_wall_propagation";
        consequence.remaining_life_impact = "urgent_assessment_required";
        overallRisk = "CRITICAL";
      } else if (disc.discontinuity_type === "creep_damage") {
        consequence.physics_impact = "HIGH";
        consequence.failure_mode = "time_dependent_void_coalescence_to_rupture";
        consequence.remaining_life_impact = "requires_remaining_life_fraction_assessment";
        if (overallRisk !== "CRITICAL") overallRisk = "HIGH";
      } else if (disc.discontinuity_type === "intergranular_corrosion" || disc.discontinuity_type === "galvanic_corrosion") {
        consequence.physics_impact = "MODERATE_TO_HIGH";
        consequence.failure_mode = "preferential_attack_with_potential_through_wall";
        consequence.remaining_life_impact = "depends_on_attack_rate_and_remaining_wall";
      } else {
        consequence.physics_impact = "MODERATE";
        consequence.failure_mode = "progressive_wall_loss";
        consequence.remaining_life_impact = "calculable_from_corrosion_rate";
      }
    }

    // Coating defects — protection system compromise
    if (disc.group === "coating") {
      consequence.physics_impact = "LOW_TO_MODERATE";
      consequence.failure_mode = "corrosion_protection_compromised";
      consequence.remaining_life_impact = "accelerated_corrosion_if_not_repaired";
      if (disc.discontinuity_type === "coating_adhesion_failure" || disc.discontinuity_type === "coating_peeling") {
        consequence.physics_impact = "MODERATE";
        consequence.failure_mode = "widespread_coating_system_failure";
        escalationFactors.push("Coating adhesion failure exposes substrate to corrosive environment");
      }
      if (disc.discontinuity_type === "coating_holiday" && (service === "immersion" || service === "buried" || service === "offshore")) {
        consequence.physics_impact = "HIGH";
        consequence.failure_mode = "localized_corrosion_at_holiday_in_aggressive_environment";
        escalationFactors.push("Coating holiday in immersion/buried/offshore service — rapid localized attack expected");
        if (overallRisk !== "CRITICAL") overallRisk = "HIGH";
      }
    }

    // Interaction risk — multiple discontinuities compound
    if (discontinuities.length > 1) {
      var hasCreck = false;
      var hasFusion = false;
      var hasInclusion = false;
      for (var ci = 0; ci < discontinuities.length; ci++) {
        if (discontinuities[ci].group === "crack") hasCreck = true;
        if (discontinuities[ci].group === "fusion_defect") hasFusion = true;
        if (discontinuities[ci].group === "solid_inclusion" || discontinuities[ci].group === "gas_inclusion") hasInclusion = true;
      }
      if (hasCreck && hasFusion) {
        consequence.interaction_risk = "CRITICAL — crack at fusion defect creates compound flaw";
        overallRisk = "CRITICAL";
      } else if (hasFusion && hasInclusion) {
        consequence.interaction_risk = "HIGH — inclusion at fusion boundary promotes crack initiation";
        if (overallRisk !== "CRITICAL") overallRisk = "HIGH";
      } else if (hasCreck && hasInclusion) {
        consequence.interaction_risk = "HIGH — inclusion may have initiated crack";
      }
    }

    consequences.push(consequence);
  }

  return {
    overall_risk: overallRisk,
    consequence_details: consequences,
    escalation_factors: escalationFactors,
    recommendation: overallRisk === "CRITICAL" ? "IMMEDIATE_ENGINEERING_REVIEW" :
                     overallRisk === "HIGH" ? "ENGINEERING_ASSESSMENT_REQUIRED" :
                     overallRisk === "MODERATE" ? "MONITOR_AND_REASSESS" : "ROUTINE_MONITORING"
  };
}

// ================================================================
// EDUCATIONAL FEEDBACK ENGINE — Basic Tier
// ================================================================

function generateEducationalFeedback(discontinuities, codeResults, modality) {
  var feedback = {
    summary: "",
    discontinuities_found: [],
    code_guidance: [],
    study_tips: [],
    skill_assessment: null,
    next_steps: []
  };

  if (discontinuities.length === 0) {
    feedback.summary = "No discontinuities detected in this image. However, always verify with proper lighting, angle, and magnification. What you don't see matters as much as what you do.";
    feedback.study_tips.push("Practice identifying discontinuities by studying reference radiographs and weld samples.");
    feedback.study_tips.push("Compare your weld photos to AWS acceptance criteria visual aids.");
    return feedback;
  }

  // Summary
  var criticalCount = 0;
  var majorCount = 0;
  var minorCount = 0;
  for (var di = 0; di < discontinuities.length; di++) {
    if (discontinuities[di].severity === "critical") criticalCount++;
    else if (discontinuities[di].severity === "major") majorCount++;
    else minorCount++;
  }

  feedback.summary = "Found " + discontinuities.length + " indication(s): " +
    (criticalCount > 0 ? criticalCount + " critical, " : "") +
    (majorCount > 0 ? majorCount + " major, " : "") +
    (minorCount > 0 ? minorCount + " minor" : "") + ". ";

  if (criticalCount > 0) {
    feedback.summary += "This weld would be REJECTED under most codes. Study the critical findings carefully.";
  } else if (majorCount > 0) {
    feedback.summary += "Some indications may exceed acceptance criteria. Check against your governing code.";
  } else {
    feedback.summary += "Minor indications detected. Likely acceptable but verify against code limits.";
  }

  // Per-discontinuity educational content
  for (var di2 = 0; di2 < discontinuities.length; di2++) {
    var disc = discontinuities[di2];
    var discInfo = DISCONTINUITY_KB[disc.discontinuity_type];
    feedback.discontinuities_found.push({
      name: disc.discontinuity_type.replace(/_/g, " "),
      severity: disc.severity,
      what_it_is: discInfo ? discInfo.description : disc.description,
      why_it_matters: disc.severity === "critical" ?
        "This is a rejectable discontinuity under virtually all welding codes. Cracks and fusion defects create direct failure paths." :
        disc.severity === "major" ?
        "This may or may not be acceptable depending on size, location, and code requirements." :
        "Typically acceptable if within code limits, but indicates room for technique improvement.",
      common_causes: discInfo ? discInfo.common_causes : [],
      teaching_note: discInfo ? discInfo.teaching_note : null
    });
  }

  // Code guidance
  for (var ci = 0; ci < codeResults.length; ci++) {
    var cr = codeResults[ci];
    feedback.code_guidance.push({
      discontinuity: cr.discontinuity,
      code: cr.code,
      accept_reject: cr.accept === false ? "REJECT" : cr.accept === true ? "ACCEPT" : "CONDITIONAL — check measurements against criteria",
      clause: cr.clause,
      key_condition: cr.conditions || cr.note || "See code for details"
    });
  }

  // Study tips based on what was found
  if (criticalCount > 0) {
    feedback.study_tips.push("Focus on welding technique fundamentals: heat input control, proper electrode angles, and interpass cleaning.");
    feedback.study_tips.push("Review AWS Welding Handbook Chapter on Weld Quality for root cause analysis.");
  }
  for (var di3 = 0; di3 < discontinuities.length; di3++) {
    var discType = discontinuities[di3].discontinuity_type;
    if (discType.indexOf("porosity") !== -1) {
      feedback.study_tips.push("Porosity prevention: clean base metal, check shielding gas flow (35-50 CFH typical), verify electrode storage conditions.");
    }
    if (discType.indexOf("undercut") !== -1) {
      feedback.study_tips.push("Undercut prevention: reduce amperage 5-10%, slow travel speed slightly, adjust electrode angle toward the undercut side.");
    }
    if (discType.indexOf("lack_of_fusion") !== -1 || discType.indexOf("lack_of_penetration") !== -1) {
      feedback.study_tips.push("Fusion/penetration improvement: increase heat input, ensure proper groove angle (minimum 60 degrees V-groove), check root opening.");
    }
    if (discType.indexOf("slag") !== -1) {
      feedback.study_tips.push("Slag prevention: thorough interpass cleaning with chipping hammer + wire brush. Clean until you see bright metal.");
    }
  }

  // Skill assessment
  if (criticalCount === 0 && majorCount === 0) {
    feedback.skill_assessment = "GOOD — your weld shows only minor indications. Focus on consistency and you are on track.";
  } else if (criticalCount === 0 && majorCount <= 2) {
    feedback.skill_assessment = "DEVELOPING — some issues to address but fundamentals are there. Review the specific feedback above.";
  } else {
    feedback.skill_assessment = "NEEDS PRACTICE — review your technique fundamentals. Focus on the critical items first.";
  }

  // Next steps
  feedback.next_steps.push("Take another photo after making technique adjustments to track your improvement.");
  feedback.next_steps.push("Practice on scrap material with the same joint configuration before your next test.");
  if (modality === "VT") {
    feedback.next_steps.push("For better analysis: use consistent lighting, include a ruler for scale, and photograph from multiple angles (face, root, profile).");
  }

  return feedback;
}

// ================================================================
// FULL 3-AI PIPELINE
// ================================================================

function runFullPipeline(input, tier) {
  var tierConfig = TIER_MATRIX[tier] || TIER_MATRIX["basic"];
  var modality = input.modality || "VT";
  var observations = input.observations || {};
  var codeKey = input.governing_code || "aws_d1_1";
  var context = input.context || {};

  // Validate modality for tier
  var modalityAllowed = false;
  var supportedMods = tierConfig.supported_modalities;
  for (var mi = 0; mi < supportedMods.length; mi++) {
    if (supportedMods[mi] === modality) {
      modalityAllowed = true;
      break;
    }
  }
  if (!modalityAllowed) {
    return {
      error: "MODALITY_NOT_AVAILABLE_IN_TIER",
      message: modality + " is not available in the " + tierConfig.tier_name + " tier. Available modalities: " + supportedMods.join(", "),
      upgrade_to: tier === "basic" ? "pro" : "main"
    };
  }

  // Stage 1: Vision AI — Classify discontinuities
  var discontinuities = classifyDiscontinuities(observations, modality, tier);

  // Stage 2: Code Authority Router — Get acceptance criteria for each finding
  var codeResults = [];
  for (var di = 0; di < discontinuities.length; di++) {
    var result = routeToCode(codeKey, discontinuities[di].discontinuity_type);
    result.confidence = discontinuities[di].confidence;
    codeResults.push(result);
  }

  // Stage 3: Physics Consequence (Pro and Main only)
  var physicsResult = null;
  if (tier === "pro" || tier === "main") {
    physicsResult = assessPhysicsConsequence(discontinuities, context);
  }

  // Educational feedback (Basic tier)
  var educationalFeedback = null;
  if (tier === "basic") {
    educationalFeedback = generateEducationalFeedback(discontinuities, codeResults, modality);
  }

  // Disposition
  var disposition = "ACCEPT";
  var rejectionReasons = [];
  for (var cri = 0; cri < codeResults.length; cri++) {
    if (codeResults[cri].accept === false) {
      disposition = "REJECT";
      rejectionReasons.push(codeResults[cri].discontinuity + " — " + (codeResults[cri].note || codeResults[cri].clause));
    }
  }
  if (physicsResult && physicsResult.overall_risk === "CRITICAL") {
    if (disposition !== "REJECT") disposition = "ENGINEERING_REVIEW_REQUIRED";
  }

  // Build response
  var response = {
    engine: ENGINE_NAME,
    version: ENGINE_VERSION,
    deploy: DEPLOY_TAG,
    tier: tier,
    tier_name: tierConfig.tier_name,
    timestamp: nowISO(),
    modality: modality,
    modality_name: (MODALITY_KB[modality] || {}).name || modality,
    governing_code: codeKey,

    // Stage 1 output
    vision: {
      discontinuities_detected: discontinuities.length,
      discontinuities: discontinuities,
      modality_confidence_base: (MODALITY_KB[modality] || {}).confidence_base || 0.70
    },

    // Stage 2 output
    code_authority: {
      code: (ACCEPTANCE_CRITERIA[codeKey] || {}).code_name || codeKey,
      edition: (ACCEPTANCE_CRITERIA[codeKey] || {}).edition || "unknown",
      evaluations: codeResults
    },

    // Stage 3 output (Pro/Main)
    physics_consequence: physicsResult,

    // Disposition
    disposition: {
      result: disposition,
      rejection_reasons: rejectionReasons,
      confidence: discontinuities.length > 0 ? round3(discontinuities[0].confidence) : 1.0
    },

    // Educational (Basic)
    educational_feedback: educationalFeedback,

    // Proof trace (Pro/Main)
    proof_trace: (tier === "pro" || tier === "main") ? {
      pipeline_stages: ["vision_classification", "code_authority_routing", "physics_consequence"],
      deterministic: true,
      ai_model_used: tierConfig.ai_model,
      modality_physics: MODALITY_KB[modality] ? {
        detectable_count: (MODALITY_KB[modality].detectable || []).length,
        not_detectable_count: (MODALITY_KB[modality].not_detectable || []).length,
        sizing: MODALITY_KB[modality].sizing_capability,
        min_size_mm: MODALITY_KB[modality].min_detectable_size_mm
      } : null
    } : null
  };

  return response;
}

// ================================================================
// HANDLER — 12 Actions
// ================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return fail(405, "POST only");
  }

  var body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return fail(400, "Invalid JSON");
  }

  var action = body.action || "";
  var orgId = getOrg(event);

  // ---- get_registry ----
  if (action === "get_registry") {
    return ok({
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      deploy: DEPLOY_TAG,
      description: "3-AI NDE Image Analysis Pipeline: Vision AI -> Code Authority Router -> Physics Consequence Engine",
      tier_matrix: TIER_MATRIX,
      supported_modalities: Object.keys(MODALITY_KB),
      supported_codes: Object.keys(ACCEPTANCE_CRITERIA),
      discontinuity_count: Object.keys(DISCONTINUITY_KB).length,
      actions: [
        "get_registry", "analyze_image", "classify_discontinuities", "get_acceptance_criteria",
        "evaluate_indication", "get_modality_guide", "get_educational_feedback",
        "get_tier_capabilities", "batch_analyze", "get_analysis_history",
        "compare_scans", "get_roi_detail"
      ]
    });
  }

  // ---- analyze_image (MAIN PIPELINE) ----
  if (action === "analyze_image") {
    var tier = body.tier || "basic";
    if (!TIER_MATRIX[tier]) {
      return fail(400, "Invalid tier. Use: basic, pro, or main");
    }
    var result = runFullPipeline(body, tier);
    if (result.error) {
      return fail(400, JSON.stringify(result));
    }

    // Persist analysis to DB if case_id provided
    if (body.case_id) {
      try {
        await supabase.from("evidence").insert({
          case_id: body.case_id,
          evidence_type: "nde_image_analysis",
          nde_method: body.modality || "VT",
          metadata_json: {
            engine: ENGINE_NAME,
            version: ENGINE_VERSION,
            tier: tier,
            disposition: result.disposition,
            discontinuities_count: result.vision.discontinuities_detected,
            overall_risk: result.physics_consequence ? result.physics_consequence.overall_risk : null,
            analysis_result: result
          },
          uploaded_by: body.analyst_id || "system",
          capture_source: "nde_image_analysis_engine"
        });
      } catch (dbErr) {
        // Don't fail the analysis if DB write fails
      }
    }

    return ok(result);
  }

  // ---- classify_discontinuities ----
  if (action === "classify_discontinuities") {
    var modality = body.modality || "VT";
    var tier2 = body.tier || "basic";
    var observations = body.observations || {};
    var classified = classifyDiscontinuities(observations, modality, tier2);
    return ok({
      engine: ENGINE_NAME,
      action: "classify_discontinuities",
      modality: modality,
      results: classified,
      count: classified.length
    });
  }

  // ---- get_acceptance_criteria ----
  if (action === "get_acceptance_criteria") {
    var codeKey = body.code || body.governing_code;
    if (!codeKey) {
      return fail(400, "code required");
    }
    var codeData = ACCEPTANCE_CRITERIA[codeKey];
    if (!codeData) {
      return ok({
        error: "Code not found",
        available_codes: Object.keys(ACCEPTANCE_CRITERIA)
      });
    }
    return ok({
      engine: ENGINE_NAME,
      action: "get_acceptance_criteria",
      code: codeData.code_name,
      edition: codeData.edition,
      criteria: codeData.criteria
    });
  }

  // ---- evaluate_indication ----
  if (action === "evaluate_indication") {
    var codeKey2 = body.code || body.governing_code || "aws_d1_1";
    var discType = body.discontinuity_type;
    if (!discType) {
      return fail(400, "discontinuity_type required");
    }
    var evalResult = routeToCode(codeKey2, discType);

    // Add measurement comparison if provided
    if (body.measured_length_mm || body.measured_depth_mm) {
      evalResult.measured = {};
      if (body.measured_length_mm) evalResult.measured.length_mm = body.measured_length_mm;
      if (body.measured_depth_mm) evalResult.measured.depth_mm = body.measured_depth_mm;

      if (evalResult.max_length_mm !== null && body.measured_length_mm > evalResult.max_length_mm) {
        evalResult.measurement_verdict = "EXCEEDS_LIMIT";
      } else if (evalResult.max_depth_mm !== null && body.measured_depth_mm > evalResult.max_depth_mm) {
        evalResult.measurement_verdict = "EXCEEDS_LIMIT";
      } else if (evalResult.accept === false) {
        evalResult.measurement_verdict = "REJECTED_REGARDLESS_OF_SIZE";
      } else {
        evalResult.measurement_verdict = "WITHIN_LIMITS";
      }
    }

    return ok({
      engine: ENGINE_NAME,
      action: "evaluate_indication",
      result: evalResult
    });
  }

  // ---- get_modality_guide ----
  if (action === "get_modality_guide") {
    var mod = body.modality;
    if (!mod) {
      return ok({
        engine: ENGINE_NAME,
        action: "get_modality_guide",
        available_modalities: Object.keys(MODALITY_KB)
      });
    }
    var modData = MODALITY_KB[mod];
    if (!modData) {
      return fail(400, "Unknown modality: " + mod + ". Available: " + Object.keys(MODALITY_KB).join(", "));
    }
    return ok({
      engine: ENGINE_NAME,
      action: "get_modality_guide",
      modality: mod,
      guide: modData
    });
  }

  // ---- get_educational_feedback ----
  if (action === "get_educational_feedback") {
    var discontinuities3 = body.discontinuities || [];
    var codeResults3 = body.code_results || [];
    var mod3 = body.modality || "VT";
    var fb = generateEducationalFeedback(discontinuities3, codeResults3, mod3);
    return ok({
      engine: ENGINE_NAME,
      action: "get_educational_feedback",
      feedback: fb
    });
  }

  // ---- get_tier_capabilities ----
  if (action === "get_tier_capabilities") {
    var requestedTier = body.tier;
    if (requestedTier && TIER_MATRIX[requestedTier]) {
      return ok({
        engine: ENGINE_NAME,
        action: "get_tier_capabilities",
        tier: TIER_MATRIX[requestedTier]
      });
    }
    return ok({
      engine: ENGINE_NAME,
      action: "get_tier_capabilities",
      tiers: TIER_MATRIX
    });
  }

  // ---- batch_analyze (Pro/Main only) ----
  if (action === "batch_analyze") {
    var batchTier = body.tier || "pro";
    if (batchTier === "basic") {
      return fail(403, "Batch analysis not available in Basic tier. Upgrade to Pro or Main.");
    }
    var images = body.images || [];
    if (images.length === 0) {
      return fail(400, "images array required");
    }
    var maxImages = (TIER_MATRIX[batchTier] || {}).max_images_per_analysis || 20;
    if (images.length > maxImages) {
      return fail(400, "Maximum " + maxImages + " images per batch for " + batchTier + " tier");
    }

    var batchResults = [];
    for (var bi = 0; bi < images.length; bi++) {
      var imgInput = images[bi];
      imgInput.tier = batchTier;
      var imgResult = runFullPipeline(imgInput, batchTier);
      imgResult.image_index = bi;
      imgResult.image_id = imgInput.image_id || ("img_" + bi);
      batchResults.push(imgResult);
    }

    // Aggregate stats
    var totalDisc = 0;
    var totalReject = 0;
    var highestRisk = "LOW";
    for (var bri = 0; bri < batchResults.length; bri++) {
      totalDisc += batchResults[bri].vision.discontinuities_detected;
      if (batchResults[bri].disposition.result === "REJECT") totalReject++;
      if (batchResults[bri].physics_consequence) {
        var risk = batchResults[bri].physics_consequence.overall_risk;
        if (risk === "CRITICAL" || (risk === "HIGH" && highestRisk !== "CRITICAL")) {
          highestRisk = risk;
        }
      }
    }

    return ok({
      engine: ENGINE_NAME,
      action: "batch_analyze",
      tier: batchTier,
      images_analyzed: batchResults.length,
      total_discontinuities: totalDisc,
      total_rejections: totalReject,
      highest_risk: highestRisk,
      results: batchResults
    });
  }

  // ---- get_analysis_history ----
  if (action === "get_analysis_history") {
    var caseId = body.case_id;
    if (!caseId) {
      return fail(400, "case_id required");
    }
    try {
      var historyResult = await supabase
        .from("evidence")
        .select("*")
        .eq("case_id", caseId)
        .eq("evidence_type", "nde_image_analysis")
        .order("created_at", { ascending: false });

      return ok({
        engine: ENGINE_NAME,
        action: "get_analysis_history",
        case_id: caseId,
        analyses: historyResult.data || [],
        count: (historyResult.data || []).length
      });
    } catch (dbErr) {
      return fail(500, "Database error retrieving history");
    }
  }

  // ---- compare_scans (Main only) ----
  if (action === "compare_scans") {
    var compTier = body.tier || "main";
    if (compTier !== "main") {
      return fail(403, "Scan comparison only available in Main Platform tier");
    }

    var scanA = body.scan_a || {};
    var scanB = body.scan_b || {};
    var modComp = body.modality || "PAUT";

    var discA = classifyDiscontinuities(scanA.observations || {}, modComp, "main");
    var discB = classifyDiscontinuities(scanB.observations || {}, modComp, "main");

    // Compare
    var newFindings = [];
    var resolvedFindings = [];
    var changedFindings = [];
    var unchangedFindings = [];

    // Simple comparison by type
    var aTypes = {};
    var bTypes = {};
    for (var ai = 0; ai < discA.length; ai++) aTypes[discA[ai].discontinuity_type] = discA[ai];
    for (var bbi = 0; bbi < discB.length; bbi++) bTypes[discB[bbi].discontinuity_type] = discB[bbi];

    var allTypes = {};
    var aKeys = Object.keys(aTypes);
    var bKeys = Object.keys(bTypes);
    for (var aki = 0; aki < aKeys.length; aki++) allTypes[aKeys[aki]] = true;
    for (var bki = 0; bki < bKeys.length; bki++) allTypes[bKeys[bki]] = true;

    var allTypeKeys = Object.keys(allTypes);
    for (var ti = 0; ti < allTypeKeys.length; ti++) {
      var tKey = allTypeKeys[ti];
      if (aTypes[tKey] && !bTypes[tKey]) {
        resolvedFindings.push({ type: tKey, status: "RESOLVED", was: aTypes[tKey].severity });
      } else if (!aTypes[tKey] && bTypes[tKey]) {
        newFindings.push({ type: tKey, status: "NEW", is: bTypes[tKey].severity });
      } else if (aTypes[tKey] && bTypes[tKey]) {
        if (Math.abs(aTypes[tKey].confidence - bTypes[tKey].confidence) > 0.1) {
          changedFindings.push({
            type: tKey,
            status: "CHANGED",
            confidence_delta: round3(bTypes[tKey].confidence - aTypes[tKey].confidence),
            trending: bTypes[tKey].confidence > aTypes[tKey].confidence ? "WORSENING" : "IMPROVING"
          });
        } else {
          unchangedFindings.push({ type: tKey, status: "STABLE" });
        }
      }
    }

    return ok({
      engine: ENGINE_NAME,
      action: "compare_scans",
      scan_a_date: scanA.date || "unknown",
      scan_b_date: scanB.date || "unknown",
      modality: modComp,
      comparison: {
        new_findings: newFindings,
        resolved_findings: resolvedFindings,
        changed_findings: changedFindings,
        unchanged_findings: unchangedFindings,
        trend: newFindings.length > resolvedFindings.length ? "DEGRADING" :
               resolvedFindings.length > newFindings.length ? "IMPROVING" : "STABLE"
      }
    });
  }

  // ---- get_roi_detail ----
  if (action === "get_roi_detail") {
    var roiDisc = body.discontinuity_type;
    if (!roiDisc) {
      return fail(400, "discontinuity_type required");
    }
    var roiData = DISCONTINUITY_KB[roiDisc];
    if (!roiData) {
      return ok({
        error: "Unknown discontinuity type",
        available: Object.keys(DISCONTINUITY_KB)
      });
    }
    return ok({
      engine: ENGINE_NAME,
      action: "get_roi_detail",
      discontinuity_type: roiDisc,
      detail: roiData,
      detectable_by: (function() {
        var methods = [];
        var modKeys = Object.keys(MODALITY_KB);
        for (var mki = 0; mki < modKeys.length; mki++) {
          var modCheck = MODALITY_KB[modKeys[mki]];
          for (var dci = 0; dci < modCheck.detectable.length; dci++) {
            if (modCheck.detectable[dci].indexOf(roiDisc) !== -1 || roiDisc.indexOf(modCheck.detectable[dci]) !== -1) {
              methods.push({
                method: modKeys[mki],
                name: modCheck.name,
                confidence: modCheck.confidence_base,
                sizing: modCheck.sizing_capability
              });
              break;
            }
          }
        }
        return methods;
      })()
    });
  }

  return fail(400, "Unknown action: " + action + ". Use get_registry for available actions.");
};
