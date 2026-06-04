// @ts-nocheck
/**
 * DEPLOY285 - marine-growth-engine.ts
 * netlify/functions/marine-growth-engine.ts
 *
 * MARINE GROWTH & FOULING ENGINE
 *
 * Fouling assessment, inspection obstruction, under-deposit corrosion,
 * hydrodynamic loading effects, cleaning requirements.
 *
 * Klein Bottle: marine growth is not just on the surface — it changes
 * the hydrodynamic profile, traps moisture, shields CP, masks defects,
 * adds weight, and creates crevice environments. The growth IS part
 * of the asset's condition, not something separate from it.
 *
 * POST /api/marine-growth-engine
 *
 * Actions:
 *   evaluate_fouling        — full fouling assessment
 *   assess_inspection_impact — how fouling affects inspection confidence
 *   assess_loading_impact    — hydrodynamic loading from marine growth
 *   get_cleaning_requirements — cleaning method recommendations
 *   get_fouling_profiles     — regional fouling data
 *   get_registry             — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "marine-growth-engine";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY285";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// FOULING CLASSIFICATION
// ============================================================

var FOULING_LEVELS = {
  none: {
    level: "none",
    thickness_mm: { min: 0, max: 0 },
    coverage_percent: 0,
    description: "No marine growth present. Clean surface.",
    inspection_impact: "none",
    confidence_modifier: 1.0,
    hydrodynamic_factor: 1.0,
    weight_addition_kg_m2: 0,
    cleaning_required: false
  },
  light: {
    level: "light",
    thickness_mm: { min: 1, max: 25 },
    coverage_percent: 30,
    description: "Thin biofilm or light soft fouling. Surface features still visible.",
    inspection_impact: "minor",
    confidence_modifier: 0.95,
    hydrodynamic_factor: 1.05,
    weight_addition_kg_m2: 5,
    cleaning_required: false
  },
  moderate: {
    level: "moderate",
    thickness_mm: { min: 25, max: 75 },
    coverage_percent: 60,
    description: "Established fouling community. Surface partially obscured. Some hard fouling.",
    inspection_impact: "significant",
    confidence_modifier: 0.75,
    hydrodynamic_factor: 1.15,
    weight_addition_kg_m2: 25,
    cleaning_required: true
  },
  heavy: {
    level: "heavy",
    thickness_mm: { min: 75, max: 150 },
    coverage_percent: 85,
    description: "Dense fouling with hard organisms (mussels, barnacles, coral). Surface fully obscured.",
    inspection_impact: "severe",
    confidence_modifier: 0.45,
    hydrodynamic_factor: 1.35,
    weight_addition_kg_m2: 75,
    cleaning_required: true
  },
  extreme: {
    level: "extreme",
    thickness_mm: { min: 150, max: 300 },
    coverage_percent: 100,
    description: "Massive fouling growth. Member diameter effectively doubled. All surface detail hidden.",
    inspection_impact: "prohibitive",
    confidence_modifier: 0.20,
    hydrodynamic_factor: 1.60,
    weight_addition_kg_m2: 150,
    cleaning_required: true
  }
};

// ============================================================
// FOULING SPECIES EFFECTS
// ============================================================

var FOULING_SPECIES = {
  soft_fouling: {
    name: "Soft Fouling (algae, hydroids, sea squirts)",
    hardness: "soft",
    attachment: "weak",
    corrosion_risk: "low",
    cp_shielding: "minimal",
    cleaning_difficulty: "easy",
    regrowth_rate: "fast",
    under_deposit_risk: "low"
  },
  mussels: {
    name: "Mussels (Mytilus spp.)",
    hardness: "moderate",
    attachment: "moderate_byssal_threads",
    corrosion_risk: "moderate",
    cp_shielding: "moderate",
    cleaning_difficulty: "moderate",
    regrowth_rate: "moderate",
    under_deposit_risk: "moderate_creates_crevice"
  },
  barnacles: {
    name: "Barnacles (Balanus spp.)",
    hardness: "hard",
    attachment: "strong_cemented",
    corrosion_risk: "high",
    cp_shielding: "significant",
    cleaning_difficulty: "difficult",
    regrowth_rate: "moderate",
    under_deposit_risk: "high_calcareous_base_traps_moisture"
  },
  tubeworms: {
    name: "Tubeworms (Serpulidae)",
    hardness: "hard",
    attachment: "strong_cemented",
    corrosion_risk: "moderate",
    cp_shielding: "moderate",
    cleaning_difficulty: "difficult",
    regrowth_rate: "slow",
    under_deposit_risk: "moderate"
  },
  coral: {
    name: "Coral Growth",
    hardness: "very_hard",
    attachment: "permanent",
    corrosion_risk: "moderate",
    cp_shielding: "high",
    cleaning_difficulty: "very_difficult",
    regrowth_rate: "very_slow",
    under_deposit_risk: "high"
  },
  anemones: {
    name: "Anemones",
    hardness: "soft",
    attachment: "moderate",
    corrosion_risk: "low",
    cp_shielding: "minimal",
    cleaning_difficulty: "easy",
    regrowth_rate: "moderate",
    under_deposit_risk: "low"
  },
  kelp_seaweed: {
    name: "Kelp / Seaweed",
    hardness: "soft",
    attachment: "moderate_holdfast",
    corrosion_risk: "low",
    cp_shielding: "minimal",
    cleaning_difficulty: "easy",
    regrowth_rate: "fast_seasonal",
    under_deposit_risk: "low_but_increases_drag"
  }
};

// ============================================================
// CLEANING METHODS
// ============================================================

var CLEANING_METHODS = {
  water_jetting: {
    name: "High Pressure Water Jetting",
    pressure_bar: { min: 200, max: 700 },
    effectiveness: { soft: "excellent", moderate: "good", hard: "moderate", very_hard: "poor" },
    coating_damage_risk: "moderate",
    deployment: "diver_or_ROV",
    notes: "Most common method. Risk of coating damage at high pressures. Adjust pressure to fouling type."
  },
  mechanical_scraping: {
    name: "Mechanical Scraping / Brushing",
    effectiveness: { soft: "good", moderate: "good", hard: "good", very_hard: "moderate" },
    coating_damage_risk: "high",
    deployment: "diver",
    notes: "Effective but high risk of coating damage. Use with caution on coated surfaces."
  },
  cavitation_jetting: {
    name: "Cavitation Water Jetting",
    effectiveness: { soft: "excellent", moderate: "excellent", hard: "excellent", very_hard: "good" },
    coating_damage_risk: "low",
    deployment: "ROV_mounted",
    notes: "Advanced method with lower coating damage risk. Effective on hard fouling."
  },
  rotary_brush: {
    name: "Rotary Brush Tool",
    effectiveness: { soft: "excellent", moderate: "excellent", hard: "moderate", very_hard: "poor" },
    coating_damage_risk: "moderate",
    deployment: "ROV_mounted",
    notes: "Good for pipeline and cylindrical member cleaning. Controlled coating contact."
  }
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

function evaluateFouling(input) {
  var level = input.fouling_level || "moderate";
  var species = input.species || [];
  var zone = input.zone || "submerged";
  var memberDiameter = input.member_diameter_mm || 500;
  var depth = input.depth_m || 20;

  var foulingDef = FOULING_LEVELS[level];
  if (!foulingDef) {
    return { error: "Unknown fouling level. Options: " + Object.keys(FOULING_LEVELS).join(", ") };
  }

  var speciesAnalysis = [];
  var worstCorrosionRisk = "low";
  var worstCPShielding = "minimal";
  var worstUnderDeposit = "low";

  for (var i = 0; i < species.length; i++) {
    var sp = FOULING_SPECIES[species[i]];
    if (sp) {
      speciesAnalysis.push(sp);
      if (sp.corrosion_risk === "high" || (sp.corrosion_risk === "moderate" && worstCorrosionRisk === "low")) {
        worstCorrosionRisk = sp.corrosion_risk;
      }
      if (sp.cp_shielding === "high" || sp.cp_shielding === "significant") {
        worstCPShielding = sp.cp_shielding;
      }
      if (sp.under_deposit_risk === "high" || (sp.under_deposit_risk === "moderate" && worstUnderDeposit === "low")) {
        worstUnderDeposit = sp.under_deposit_risk;
      }
    }
  }

  var growthThickness = foulingDef.thickness_mm ? (foulingDef.thickness_mm.min + foulingDef.thickness_mm.max) / 2 : 0;
  var effectiveDiameter = memberDiameter + (2 * growthThickness);
  var diameterIncrease = Math.round(((effectiveDiameter - memberDiameter) / memberDiameter) * 100);

  var depthFactor = 1.0;
  if (depth > 100) depthFactor = 0.6;
  else if (depth > 50) depthFactor = 0.8;

  return {
    fouling_level: level,
    fouling_description: foulingDef.description,
    thickness_range_mm: foulingDef.thickness_mm,
    coverage_percent: foulingDef.coverage_percent,
    inspection_impact: foulingDef.inspection_impact,
    confidence_modifier: foulingDef.confidence_modifier,
    hydrodynamic_factor: foulingDef.hydrodynamic_factor,
    weight_addition_kg_m2: foulingDef.weight_addition_kg_m2,
    cleaning_required: foulingDef.cleaning_required,
    member_diameter_mm: memberDiameter,
    effective_diameter_mm: Math.round(effectiveDiameter),
    diameter_increase_percent: diameterIncrease,
    depth_m: depth,
    depth_factor: depthFactor,
    species_analysis: speciesAnalysis,
    worst_case: {
      corrosion_risk: worstCorrosionRisk,
      cp_shielding: worstCPShielding,
      under_deposit_risk: worstUnderDeposit
    },
    assumptions_for_mesh: {
      inspection_coverage: foulingDef.confidence_modifier < 0.5 ? "visual_only" : (foulingDef.confidence_modifier < 0.8 ? "limited" : "adequate"),
      coating_condition: foulingDef.confidence_modifier < 0.5 ? "unknown" : "assumed_from_limited_observation",
      cp_effectiveness: worstCPShielding === "high" || worstCPShielding === "significant" ? "possibly_shielded" : "assumed_effective"
    },
    klein_bottle_note: "Marine growth changes the asset's hydrodynamic profile, masks its coating condition, shields its CP, creates crevice corrosion environments, and reduces inspection confidence. It is not separate from the asset — it is part of the asset's current state."
  };
}

function assessInspectionImpact(foulingLevel, inspectionMethod) {
  var fouling = FOULING_LEVELS[foulingLevel] || FOULING_LEVELS.moderate;
  var method = inspectionMethod || "visual";

  var impact = {
    fouling_level: foulingLevel,
    inspection_method: method,
    base_confidence: fouling.confidence_modifier,
    cleaning_required: fouling.cleaning_required
  };

  if (method === "visual") {
    impact.adjusted_confidence = fouling.confidence_modifier;
    impact.limitation = fouling.confidence_modifier < 0.5 ? "Cannot perform meaningful visual inspection without cleaning" : "Visual inspection possible but detail obscured";
    impact.recommendation = fouling.cleaning_required ? "Clean before visual inspection" : "Visual inspection acceptable";
  } else if (method === "UT" || method === "MPI" || method === "ACFM") {
    impact.adjusted_confidence = fouling.cleaning_required ? 0.0 : fouling.confidence_modifier;
    impact.limitation = "Contact-based NDT requires clean surface. Cannot perform through marine growth.";
    impact.recommendation = "MUST clean before " + method + " inspection";
    impact.cleaning_mandatory = true;
  } else if (method === "CP_survey") {
    impact.adjusted_confidence = fouling.confidence_modifier * 0.8;
    impact.limitation = "Marine growth may affect CP readings. Heavy growth shields reference electrode.";
    impact.recommendation = fouling.cleaning_required ? "Clean local area around measurement point" : "Proceed with caution";
  } else if (method === "FMD") {
    impact.adjusted_confidence = 0.9;
    impact.limitation = "FMD (flooded member detection) works through marine growth";
    impact.recommendation = "FMD not affected by marine growth — proceed";
  }

  return impact;
}

function assessLoadingImpact(foulingLevel, memberDiameter, depth, currentVelocity) {
  var fouling = FOULING_LEVELS[foulingLevel] || FOULING_LEVELS.moderate;
  var diameter = memberDiameter || 500;
  var vel = currentVelocity || 1.0;

  var growthThickness = fouling.thickness_mm ? (fouling.thickness_mm.min + fouling.thickness_mm.max) / 2 : 0;
  var effectiveDiameter = diameter + (2 * growthThickness);

  var dragIncrease = Math.round(((effectiveDiameter / diameter) - 1) * 100);

  var addedWeight = fouling.weight_addition_kg_m2 * Math.PI * (effectiveDiameter / 1000);

  var cdClean = 0.65;
  var cdFouled = cdClean * fouling.hydrodynamic_factor;

  var totalDragFactor = (effectiveDiameter / diameter) * (cdFouled / cdClean);
  var totalDragIncrease = Math.round((totalDragFactor - 1) * 100);

  return {
    fouling_level: foulingLevel,
    member_diameter_mm: diameter,
    effective_diameter_mm: Math.round(effectiveDiameter),
    diameter_increase_percent: dragIncrease,
    drag_coefficient_clean: cdClean,
    drag_coefficient_fouled: Math.round(cdFouled * 100) / 100,
    total_drag_increase_percent: totalDragIncrease,
    added_weight_kg_per_m: Math.round(addedWeight * 10) / 10,
    fatigue_impact: totalDragIncrease > 50 ? "significant — recalculate fatigue life with fouled hydrodynamic profile" :
                    totalDragIncrease > 20 ? "moderate — verify fatigue life includes marine growth allowance" :
                    "minor — within typical design allowance",
    viv_impact: effectiveDiameter > diameter * 1.3 ? "Effective diameter change may alter VIV response. Check natural frequency." : "Unlikely to significantly change VIV behavior."
  };
}

function getCleaningRecommendations(foulingLevel, species, surfaceType) {
  var fouling = FOULING_LEVELS[foulingLevel] || FOULING_LEVELS.moderate;
  var surface = surfaceType || "coated_steel";

  var recommendations = [];
  var methods = Object.keys(CLEANING_METHODS);

  var hardness = "soft";
  if (species && species.length > 0) {
    for (var i = 0; i < species.length; i++) {
      var sp = FOULING_SPECIES[species[i]];
      if (sp) {
        if (sp.hardness === "very_hard") { hardness = "very_hard"; break; }
        if (sp.hardness === "hard" && hardness !== "very_hard") hardness = "hard";
        if (sp.hardness === "moderate" && hardness === "soft") hardness = "moderate";
      }
    }
  }

  for (var m = 0; m < methods.length; m++) {
    var method = CLEANING_METHODS[methods[m]];
    var eff = method.effectiveness[hardness] || "unknown";
    var suitable = eff === "excellent" || eff === "good";
    var coatingRisk = method.coating_damage_risk;

    if (surface === "bare_steel") coatingRisk = "not_applicable";

    recommendations.push({
      method: method.name,
      effectiveness_for_fouling: eff,
      coating_damage_risk: coatingRisk,
      suitable: suitable,
      deployment: method.deployment,
      notes: method.notes
    });
  }

  recommendations.sort(function(a, b) {
    if (a.suitable && !b.suitable) return -1;
    if (!a.suitable && b.suitable) return 1;
    return 0;
  });

  return {
    fouling_level: foulingLevel,
    fouling_hardness: hardness,
    surface_type: surface,
    cleaning_required: fouling.cleaning_required,
    recommended_methods: recommendations,
    warning: surface === "coated_steel" ? "All cleaning methods carry some coating damage risk on coated surfaces. Minimize pressure and use appropriate tooling." : null
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
          purpose: "Marine Growth & Fouling Engine — fouling assessment, inspection obstruction, hydrodynamic loading, cleaning",
          fouling_levels: Object.keys(FOULING_LEVELS).length,
          species_database: Object.keys(FOULING_SPECIES).length,
          cleaning_methods: Object.keys(CLEANING_METHODS).length,
          actions: [
            "evaluate_fouling — full fouling assessment",
            "assess_inspection_impact — how fouling affects inspection confidence",
            "assess_loading_impact — hydrodynamic loading from marine growth",
            "get_cleaning_requirements — cleaning method recommendations",
            "get_fouling_profiles — species and fouling databases",
            "get_registry — engine metadata"
          ]
        })
      };
    }

    if (action === "evaluate_fouling") {
      var foulingResult = evaluateFouling(body);
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("marine_growth_assessments").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          fouling_level: body.fouling_level || "unknown",
          confidence_modifier: foulingResult.confidence_modifier || null,
          result_json: foulingResult
        });
      } catch (dbErr) { /* non-fatal */ }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: foulingResult }, null, 2) };
    }

    if (action === "assess_inspection_impact") {
      var inspResult = assessInspectionImpact(body.fouling_level || "moderate", body.inspection_method || "visual");
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: inspResult }, null, 2) };
    }

    if (action === "assess_loading_impact") {
      var loadResult = assessLoadingImpact(body.fouling_level || "moderate", body.member_diameter_mm || 500, body.depth_m || 20, body.current_velocity_ms || 1.0);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: loadResult }, null, 2) };
    }

    if (action === "get_cleaning_requirements") {
      var cleanResult = getCleaningRecommendations(body.fouling_level || "moderate", body.species || [], body.surface_type || "coated_steel");
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: cleanResult }, null, 2) };
    }

    if (action === "get_fouling_profiles") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, fouling_levels: FOULING_LEVELS, species: FOULING_SPECIES, cleaning_methods: CLEANING_METHODS }, null, 2) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
