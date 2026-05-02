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
var ENGINE_VERSION = "v1.0.0";
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
      porosity: { accept: "conditional", clause: "4.3.2",
        conditions: "Quality level B per ISO 5817 — individual pore max 0.3s (s=weld size), max 0.3 x weld area aggregate" },
      undercut: { accept: "conditional", max_depth_mm: 0.5, clause: "4.3.2",
        conditions: "Max 0.5mm for quality level B" }
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
  if (baseType.indexOf("crack") !== -1 && baseType !== "crater_crack") baseType = "crack";
  if (baseType.indexOf("porosity") !== -1) baseType = "porosity";
  if (baseType.indexOf("slag") !== -1) baseType = "slag_inclusion";
  if (baseType.indexOf("lack_of_fusion") !== -1 || baseType === "lof") baseType = "lack_of_fusion";
  if (baseType.indexOf("lack_of_penetration") !== -1 || baseType === "lop") baseType = "lack_of_penetration";
  if (baseType.indexOf("undercut") !== -1) baseType = "undercut";

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
      if (disc.discontinuity_type === "stress_corrosion_cracking") {
        consequence.physics_impact = "CRITICAL";
        consequence.failure_mode = "rapid_through_wall_propagation";
        consequence.remaining_life_impact = "urgent_assessment_required";
        overallRisk = "CRITICAL";
      } else {
        consequence.physics_impact = "MODERATE";
        consequence.failure_mode = "progressive_wall_loss";
        consequence.remaining_life_impact = "calculable_from_corrosion_rate";
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
