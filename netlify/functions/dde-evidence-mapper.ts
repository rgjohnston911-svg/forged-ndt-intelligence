// @ts-nocheck
// ══════════════════════════════════════════════════════════════════════════════
// DDE EVIDENCE MAPPER
// Maps decision-core structured output → DDE evidence vector
//
// This module translates the grammar bridge's structured evidence fields
// into the categorical dimensions the DDE engine's indicator tables expect.
//
// The mapper is domain-aware: fixed equipment, subsea, and marine each have
// different evidence dimensions. The mapper only emits dimensions that the
// relevant KB actually uses.
//
// Design principle: if a field can't be mapped cleanly, it's OMITTED —
// never guessed. The DDE engine handles missing dimensions by skipping them
// in the likelihood calculation.
// ══════════════════════════════════════════════════════════════════════════════

// ── TEMPERATURE BUCKETING ──────────────────────────────────────────────
function bucketTemperature(temp_f: any): string | null {
  if (temp_f === null || temp_f === undefined) return null;
  var t = Number(temp_f);
  if (isNaN(t)) return null;
  if (t < 150) return "below_150";
  if (t < 300) return "150_to_300";
  if (t < 500) return "300_to_500";
  return "above_500";
}

// ── WALL LOSS BUCKETING ────────────────────────────────────────────────
function bucketWallLoss(pct: any): string | null {
  if (pct === null || pct === undefined) return null;
  var p = Number(pct);
  if (isNaN(p)) return null;
  if (p < 10) return "lt_10";
  if (p < 25) return "10_to_25";
  if (p < 50) return "25_to_50";
  return "gt_50";
}

// ── CRACK DEPTH BUCKETING ──────────────────────────────────────────────
function bucketCrackDepth(ratio: any): string | null {
  if (ratio === null || ratio === undefined) return null;
  var r = Number(ratio);
  if (isNaN(r)) return null;
  if (r < 0.25) return "shallow_lt_25pct";
  if (r < 0.50) return "moderate_25_50pct";
  return "deep_gt_50pct";
}

// ── WATER DEPTH BUCKETING ──────────────────────────────────────────────
function bucketWaterDepth(depth_m: any): string | null {
  if (depth_m === null || depth_m === undefined) return null;
  var d = Number(depth_m);
  if (isNaN(d)) return null;
  if (d < 30) return "shallow_lt_30m";
  if (d < 100) return "moderate_30_100m";
  if (d < 500) return "deep_100_500m";
  return "ultra_deep_gt_500m";
}

// ── MAIN MAPPER ────────────────────────────────────────────────────────
// Takes the raw observed_evidence + asset_context and produces a clean
// evidence vector with only categorical values matching KB indicator keys.
function mapEvidence(observed: any, assetContext: any): any {
  if (!observed) return {};
  var evidence: any = {};

  // ── Direct pass-through fields (already categorical) ──────────
  var directFields = [
    "crack_orientation",
    "crack_location",
    "morphology",
    "wall_loss_pattern",
    "surface_condition",
    "weld_proximity",
    "cp_status",
    "marine_growth_grade",
    "zone_depth",
    "coating_condition",
    "current_exposure",
    "structural_zone",
    "slamming_exposure",
    "free_surface_state",
    "ballast_history",
    "ph_environment",
    "inspection_effectiveness",
    "platform_type",
    "service_age_bracket",
    "production_component",
    "mooring_component",
    "service_fluid",
    "h2s_presence"
  ];

  for (var i = 0; i < directFields.length; i++) {
    var field = directFields[i];
    if (observed[field] !== null && observed[field] !== undefined && observed[field] !== "") {
      evidence[field] = observed[field];
    }
  }

  // ── Bucketed fields (numeric → categorical) ───────────────────

  // Service temperature: from asset_context or observed_evidence
  var tempSource = observed.service_temperature_f !== undefined
    ? observed.service_temperature_f
    : (assetContext && assetContext.service_temp_f !== undefined ? assetContext.service_temp_f : null);
  var tempBucket = bucketTemperature(tempSource);
  if (tempBucket !== null) {
    evidence.service_temperature_f = tempBucket;
  }

  // Wall loss percentage
  var wallLossBucket = bucketWallLoss(observed.wall_loss_percent);
  if (wallLossBucket !== null) {
    evidence.wall_loss_percent_range = wallLossBucket;
  }

  // Crack depth ratio
  var crackDepthBucket = bucketCrackDepth(observed.crack_depth_ratio);
  if (crackDepthBucket !== null) {
    evidence.crack_depth_ratio = crackDepthBucket;
  }

  // Water depth (subsea, floating, production)
  var waterDomain = assetContext && assetContext.domain;
  if (waterDomain === "subsea" || waterDomain === "floating" || waterDomain === "production") {
    var waterDepthBucket = bucketWaterDepth(observed.water_depth_m || (assetContext && assetContext.water_depth_m));
    if (waterDepthBucket !== null) {
      evidence.water_depth_range = waterDepthBucket;
    }
  }

  return evidence;
}

// ── EVIDENCE COMPLETENESS REPORT ───────────────────────────────────────
// Returns a summary of how much evidence was provided vs available dimensions
function assessCompleteness(evidence: any, domain: string): any {
  var dimensionsByDomain: any = {
    fixed: [
      "crack_orientation", "crack_location", "morphology",
      "service_temperature_f", "wall_loss_pattern", "wall_loss_percent_range",
      "surface_condition", "weld_proximity", "crack_depth_ratio"
    ],
    subsea: [
      "crack_orientation", "crack_location", "morphology",
      "zone_depth", "cp_status", "marine_growth_grade",
      "wall_loss_pattern", "coating_condition", "current_exposure",
      "water_depth_range", "crack_depth_ratio"
    ],
    marine: [
      "crack_orientation", "crack_location", "morphology",
      "wall_loss_pattern", "structural_zone", "coating_condition",
      "slamming_exposure", "free_surface_state", "ballast_history",
      "service_temperature_f", "crack_depth_ratio"
    ],
    floating: [
      "crack_orientation", "crack_location", "morphology",
      "wall_loss_pattern", "structural_zone", "coating_condition",
      "platform_type", "service_age_bracket", "cp_status",
      "current_exposure", "zone_depth"
    ],
    production: [
      "production_component", "mooring_component", "service_fluid",
      "h2s_presence", "service_age_bracket", "water_depth_range",
      "wall_loss_pattern", "coating_condition", "cp_status",
      "current_exposure", "marine_growth_grade", "zone_depth"
    ]
  };

  var dims = dimensionsByDomain[domain] || dimensionsByDomain.fixed;
  var provided = 0;
  var missing: string[] = [];

  for (var i = 0; i < dims.length; i++) {
    if (evidence[dims[i]] !== undefined && evidence[dims[i]] !== null) {
      provided++;
    } else {
      missing.push(dims[i]);
    }
  }

  return {
    total_dimensions: dims.length,
    provided: provided,
    missing_count: dims.length - provided,
    missing_dimensions: missing,
    completeness_ratio: dims.length > 0 ? provided / dims.length : 0
  };
}

export { mapEvidence, assessCompleteness, bucketTemperature, bucketWallLoss, bucketCrackDepth, bucketWaterDepth };
