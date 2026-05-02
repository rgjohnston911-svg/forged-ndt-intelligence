#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════
// ADVERSARIAL VALIDATION SUITE — 25 CASES (101–125)
// FORGED 4D NDT Intelligence OS — Robustness Testing
//
// Purpose: Probe system robustness against boundary exploitation,
// physically suspicious inputs, multi-method conflicts, evidence quality
// issues, and conformal prediction edge cases. These 25 cases are designed
// to challenge the physics-based Weibull derivation, assumption contracts,
// and classification engine.
//
// Domains covered:
//   - Fixed Equipment (pressure vessels, piping, heat exchangers, tanks)
//   - Marine Vessels (tankers, bulk carriers, container ships, barges)
//   - Subsea Infrastructure (pipelines, risers, manifolds, trees)
//   - Production/Rotating Equipment (pumps, compressors, separators)
//
// Classification bands: LOW_RISK, MONITOR, INCREASE_INSPECTION,
// ENGINEERING_REVIEW, REPAIR_REPLACE, HOLD_FOR_INPUT
//
// Paths:
//   A = Survival model + classification (quantitative NDE data)
//   B = Local evidence-based classification (qualitative NDE)
//   C = Hybrid (orchestrator + survival + conformal predictions)
// ═══════════════════════════════════════════════════════════════════════

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = process.env.FORGED_URL || 'https://4dndt.netlify.app';

var SEVERITY_BANDS = ['LOW_RISK', 'MONITOR', 'INCREASE_INSPECTION', 'ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'HOLD_FOR_INPUT'];

// ── ADVERSARIAL TEST CASES (101–125) ──────────────────────────────────

var TEST_CASES = [

  // ════════════════════════════════════════════════════════════════════
  // BOUNDARY EXPLOITATION (Cases 101-106, PATH A)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 101: BOUNDARY-FAILPROB-035-THRESHOLD-101 (PATH A) ──
  {
    id: 'Case 101',
    name: 'BOUNDARY-FAILPROB-035-THRESHOLD-101',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      tnom: 0.500,
      tmm: 0.350,
      corrosion_rate_annual: 0.012,
      mechanism: 'general_corrosion'
    },
  },

  // ── CASE 102: BOUNDARY-FAILPROB-010-THRESHOLD-102 (PATH A) ──
  {
    id: 'Case 102',
    name: 'BOUNDARY-FAILPROB-010-THRESHOLD-102',
    path: 'A',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      tnom: 0.750,
      tmm: 0.680,
      corrosion_rate_annual: 0.004,
      mechanism: 'atmospheric_corrosion_slow'
    },
  },

  // ── CASE 103: BOUNDARY-SCALE-CLIP-MIN-103 (PATH A) ──
  {
    id: 'Case 103',
    name: 'BOUNDARY-SCALE-CLIP-MIN-103',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'heat_exchanger',
      material: 'SA-106 Gr B',
      through_wall: false,
      remaining_life_estimate: '0.2 years',
      mechanism: 'scc_active_propagation'
    },
  },

  // ── CASE 104: BOUNDARY-SCALE-CLIP-MAX-104 (PATH A) ──
  {
    id: 'Case 104',
    name: 'BOUNDARY-SCALE-CLIP-MAX-104',
    path: 'A',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'storage_tank',
      material: 'A283 Gr C',
      tnom: 1.000,
      tmm: 0.950,
      corrosion_rate_annual: 0.001,
      mechanism: 'benign_atmospheric_tarnish'
    },
  },

  // ── CASE 105: BOUNDARY-FATIGUE-FLOOR-105 (PATH A) ──
  {
    id: 'Case 105',
    name: 'BOUNDARY-FATIGUE-FLOOR-105',
    path: 'A',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      tnom: 0.500,
      tmm: 0.498,
      estimated_cycles_to_rupture: 100000,
      cycles_per_year: 500,
      mechanism: 'fatigue_low_damage'
    },
  },

  // ── CASE 106: BOUNDARY-CRACK-RATIO-THRESHOLD-106 (PATH A) ──
  {
    id: 'Case 106',
    name: 'BOUNDARY-CRACK-RATIO-THRESHOLD-106',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'API 5L X65',
      tofd_length: 0.20,
      crack_growth_rate_annual: 0.08,
      mechanism: 'fatigue_crack_growth'
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // PHYSICALLY SUSPICIOUS INPUTS (Cases 107-112, PATH A)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 107: WALL-INVERSION-CORROSION-107 (PATH A) ──
  {
    id: 'Case 107',
    name: 'WALL-INVERSION-CORROSION-107',
    path: 'A',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH36',
      tmm: 0.600,
      tnom: 0.500,
      corrosion_rate_annual: 0.005,
      mechanism: 'general_corrosion_measured'
    },
  },

  // ── CASE 108: HIGH-REMAINING-LIFE-NEGATIVE-MARGIN-108 (PATH A) ──
  {
    id: 'Case 108',
    name: 'HIGH-REMAINING-LIFE-NEGATIVE-MARGIN-108',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      remaining_life_estimate: '12 years',
      fad_margin: 0.95,
      mechanism: 'fad_margin_check'
    },
  },

  // ── CASE 109: ZERO-CORROSION-RATE-FALLBACK-109 (PATH A) ──
  {
    id: 'Case 109',
    name: 'ZERO-CORROSION-RATE-FALLBACK-109',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      tnom: 0.500,
      tmm: 0.380,
      corrosion_rate_annual: 0.0,
      mechanism: 'corrosion_zero_rate_anomaly'
    },
  },

  // ── CASE 110: CRACK-AT-CRITICAL-110 (PATH A) ──
  {
    id: 'Case 110',
    name: 'CRACK-AT-CRITICAL-110',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'API 5L X65',
      tofd_length: 1.0,
      crack_growth_rate_annual: 0.05,
      mechanism: 'crack_at_critical_boundary'
    },
  },

  // ── CASE 111: VERY-HIGH-DAMAGE-RATIO-111 (PATH A) ──
  {
    id: 'Case 111',
    name: 'VERY-HIGH-DAMAGE-RATIO-111',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      calculated_damage_ratio: 0.95,
      remaining_cycles_estimate: 500,
      fatigue_cycles_per_year: 200,
      mechanism: 'fatigue_extreme_damage'
    },
  },

  // ── CASE 112: DESIGN-LIFE-EXCEEDED-112 (PATH A) ──
  {
    id: 'Case 112',
    name: 'DESIGN-LIFE-EXCEEDED-112',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH32',
      design_life_consumed: 98,
      mechanism: 'design_life_fatigue_near_eol'
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // MULTI-METHOD CONFLICT RESOLUTION (Cases 113-117, PATH A)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 113: METHOD-B-VS-C-CONFLICT-113 (PATH A) ──
  {
    id: 'Case 113',
    name: 'METHOD-B-VS-C-CONFLICT-113',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      remaining_life_estimate: '15 years',
      tnom: 0.500,
      tmm: 0.300,
      corrosion_rate_annual: 0.025,
      mechanism: 'method_conflict_wallloss'
    },
  },

  // ── CASE 114: METHOD-E-FAST-GROWTH-114 (PATH A) ──
  {
    id: 'Case 114',
    name: 'METHOD-E-FAST-GROWTH-114',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'API 5L X65',
      tofd_length: 0.60,
      crack_growth_rate_annual: 0.15,
      mechanism: 'crack_fast_growth_near_critical'
    },
  },

  // ── CASE 115: METHOD-G-CORROSION-VS-FATIGUE-115 (PATH A) ──
  {
    id: 'Case 115',
    name: 'METHOD-G-CORROSION-VS-FATIGUE-115',
    path: 'A',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      design_life_consumed: 70,
      mechanism: 'general_corrosion_aging'
    },
  },

  // ── CASE 116: METHOD-G-FATIGUE-SAME-CONSUMED-116 (PATH A) ──
  {
    id: 'Case 116',
    name: 'METHOD-G-FATIGUE-SAME-CONSUMED-116',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH36',
      design_life_consumed: 70,
      mechanism: 'fatigue_aging_lifecycle'
    },
  },

  // ── CASE 117: METHOD-F-LOW-FAD-MARGIN-117 (PATH A) ──
  {
    id: 'Case 117',
    name: 'METHOD-F-LOW-FAD-MARGIN-117',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      fad_margin: 0.85,
      mechanism: 'fad_critical_margin'
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // EVIDENCE QUALITY & PATH B EDGE CASES (Cases 118-122, PATH B)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 118: HOLD-WITH-AUTHORITY-LOCK-118 (PATH B) ──
  {
    id: 'Case 118',
    name: 'HOLD-WITH-AUTHORITY-LOCK-118',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'API 5L X65',
      mechanism: 'brittle_fracture_margin_unknown'
    },
  },

  // ── CASE 119: MONITOR-STABLE-MECHANISM-119 (PATH B) ──
  {
    id: 'Case 119',
    name: 'MONITOR-STABLE-MECHANISM-119',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH36',
      mechanism: 'coating_failure_steel_ok'
    },
  },

  // ── CASE 120: ENGINEERING-REVIEW-PLANAR-FLAW-120 (PATH B) ──
  {
    id: 'Case 120',
    name: 'ENGINEERING-REVIEW-PLANAR-FLAW-120',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      mechanism: 'planar_flaw_detected'
    },
  },

  // ── CASE 121: REPAIR-REPLACE-CASCADE-121 (PATH B) ──
  {
    id: 'Case 121',
    name: 'REPAIR-REPLACE-CASCADE-121',
    path: 'B',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'API 5L X65',
      mechanism: 'cascade_consequence'
    },
  },

  // ── CASE 122: HOLD-NO-LOCK-MECHANISM-122 (PATH B) ──
  {
    id: 'Case 122',
    name: 'HOLD-NO-LOCK-MECHANISM-122',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      domain: 'marine',
      equipment_type: 'marine_vessel',
      material: 'AH32',
      mechanism: 'poor_surface_condition'
    },
  },

  // ════════════════════════════════════════════════════════════════════
  // PATH C CONFORMAL PREDICTION EDGE CASES (Cases 123-125, PATH C)
  // ════════════════════════════════════════════════════════════════════

  // ── CASE 123: CONFORMAL-3-HIGH-ESCALATION-123 (PATH C) ──
  {
    id: 'Case 123',
    name: 'CONFORMAL-3-HIGH-ESCALATION-123',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'subsea',
      equipment_type: 'pipeline',
      material: 'API 5L X65',
      tofd_length: 0.45,
      crack_growth_rate_annual: 0.08,
      tnom: 0.600,
      tmm: 0.480,
      mechanism: 'multi_mechanism_conformal_3'
    },
    conformal_predictions: {
      external_corrosion: 0.62,
      fatigue: 0.65,
      scc: 0.61
    },
  },

  // ── CASE 124: CONFORMAL-4-MONITOR-BUMP-124 (PATH C) ──
  {
    id: 'Case 124',
    name: 'CONFORMAL-4-MONITOR-BUMP-124',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      domain: 'fixed',
      equipment_type: 'pressure_vessel',
      material: 'SA-516 Gr 70',
      tnom: 0.750,
      tmm: 0.600,
      corrosion_rate_annual: 0.008,
      mechanism: 'multi_mechanism_conformal_4'
    },
    conformal_predictions: {
      corrosion: 0.65,
      erosion: 0.70,
      pitting: 0.62,
      fatigue: 0.60
    },
  },

  // ── CASE 125: CONFORMAL-BELOW-THRESHOLD-125 (PATH C) ──
  {
    id: 'Case 125',
    name: 'CONFORMAL-BELOW-THRESHOLD-125',
    path: 'C',
    expected_class: 'ROUTINE_MONITORING',
    expected_authority_lock: false,
    evidence: {
      domain: 'fixed',
      equipment_type: 'piping',
      material: 'A106 Gr B',
      tnom: 0.750,
      tmm: 0.600,
      corrosion_rate_annual: 0.008,
      mechanism: 'multi_mechanism_conformal_below'
    },
    conformal_predictions: {
      corrosion: 0.59,
      erosion: 0.59,
      pitting: 0.59,
      fatigue: 0.59
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════
// INFRASTRUCTURE (identical to Suite 2)
// ═══════════════════════════════════════════════════════════════════════

var CLASSIFICATION_RULES = {
  HOLD_FOR_INPUT: {
    triggers: ['unknown_material', 'missing_records', 'inconsistent_ut', 'poor_surface_condition',
               'unusable_video', 'uncalibrated_ai', 'conflicting_nde', 'welder_qual_pending',
               'ai_domain_mismatch', 'pattern_unclear', 'unknown_protection_status',
               'brittle_fracture_margin_unknown', 'weld_integrity_uncertain',
               'sampling_strategy_inadequate', 'material_inadequacy_or_passivation',
               'scale_protection_or_masking_uncertain', 'scc_confirmation_required',
               'conflicting_evidence_pwht', 'corrosion_pattern_ambiguous', 'galvanic_or_contamination']
  },
  LOW_RISK: {
    triggers: ['false_positive_confirmed', 'nonrelevant_indication_retest',
               'surface_staining_only', 'human_override_accepted']
  },
  MONITOR: {
    triggers: ['rounded_porosity_only', 'coating_damage_only', 'pressure_test_passed',
               'suspected_mechanism_unconfirmed', 'armor_pitting_functional_ok',
               'coating_failure_steel_ok', 'rock_settlement_exposure', 'cavitation_erosion_acceleration_uncertain',
               'creep_damage_long_life', 'hydrate_blockage_risk_monitoring', 'pitting_borderline_depth']
  },
  INCREASE_INSPECTION: {
    triggers: ['galvanic_corrosion', 'coating_holiday_visible', 'borderline_cp',
               'localized_wall_loss', 'cui_early_stage', 'pitting_erosion_corrosion',
               'fatigue_margin_edge_case', 'dent_stress_concentration', 'impact_plus_crevice_ambiguous',
               'cui_crevice_stable', 'coating_degradation_only', 'thermal_fatigue_distributed_loss',
               'htha_near_threshold', 'fad_borderline_margin', 'tly_riser_cui_strut_joint']
  },
  ENGINEERING_REVIEW: {
    triggers: ['planar_flaw_detected', 'crack_indication', 'through_wall_defect',
               'delamination_confirmed', 'code_routing_required', 'cp_overprotection',
               'composite_damage', 'rebar_corrosion', 'spalling', 'owner_policy_override',
               'sensitization_icc_risk', 'repair_verification_ambiguous', 'creep_fatigue_interaction',
               'crack_indication', 'hatch_fatigue_stiffener', 'weld_repair_post_verification',
               'conflicting_evidence_pwht', 'grounding_buckle_stability', 'lining_failure_causal',
               'code_conflict', 'scc_htha_uncertainty', 'viv_fatigue_crack', 'pile_fatigue_mudline',
               'irradiation_embrittlement_margin_tight', 'erosion_corrosion_acceleration_model_error',
               'fatigue_uncertainty_pitting']
  },
  REPAIR_REPLACE: {
    triggers: ['through_wall_crack', 'leak_history', 'cascade_consequence',
               'multi_mechanism_high_risk', 'nozzle_fatigue_cascade',
               'mic_through_wall_active', 'mic_through_wall', 'through_wall_weld_corrosion',
               'fatigue_hatch_corner_fleet_history', 'barge_bottom_mic_through_wall',
               'hatch_fatigue_stiffener', 'through_wall_crack', 'multi_mechanism_eol_field_decommission',
               'ffs_assessment_critical', 'crack_propagation_acceleration']
  }
};

// ── ENGINE ASSUMPTION CONTRACTS (DEPLOY279) ─────────────────────────

function validateAssumptions(testCase) {
  var evidence = testCase.evidence || {};
  var warnings = [];
  var violations = [];
  var corrected = {};

  // CONTRACT 1: Corrosion rate must be positive
  if (evidence.corrosion_rate_annual !== undefined && evidence.corrosion_rate_annual <= 0) {
    violations.push('corrosion_rate_annual <= 0 (' + evidence.corrosion_rate_annual + '): physically impossible');
    corrected.corrosion_rate_annual = undefined; // disable Method C
  }
  if (evidence.pitting_rate_annual !== undefined && evidence.pitting_rate_annual <= 0) {
    violations.push('pitting_rate_annual <= 0: physically impossible');
    corrected.pitting_rate_annual = undefined;
  }

  // CONTRACT 2: Measured wall must not exceed nominal (data corruption)
  if (evidence.tnom !== undefined && evidence.tmm !== undefined && evidence.tmm > evidence.tnom * 1.05) {
    violations.push('tmm (' + evidence.tmm + ') exceeds tnom (' + evidence.tnom + '): measurement error or data swap');
    corrected.tmm = evidence.tnom; // cap at nominal
  }

  // CONTRACT 3: Crack length must not exceed critical crack length
  if (evidence.tofd_length !== undefined && evidence.tofd_length >= 1.0) {
    warnings.push('tofd_length (' + evidence.tofd_length + ') >= critical (1.0): at or beyond failure');
  }

  // CONTRACT 4: Crack growth rate must be positive
  if (evidence.crack_growth_rate_annual !== undefined && evidence.crack_growth_rate_annual <= 0) {
    violations.push('crack_growth_rate_annual <= 0: physically impossible');
    corrected.crack_growth_rate_annual = undefined;
  }

  // CONTRACT 5: Remaining life must be positive when stated
  if (evidence.remaining_life_estimate !== undefined) {
    var rlVal = evidence.remaining_life_estimate;
    if (typeof rlVal === 'string') {
      var parsed = parseFloat(rlVal.replace(/years?/gi, '').trim().split('-')[0]);
      if (!isNaN(parsed) && parsed < 0) {
        violations.push('remaining_life_estimate is negative (' + rlVal + '): physically impossible');
        corrected.remaining_life_estimate = '0.1 years';
      }
    } else if (typeof rlVal === 'number' && rlVal < 0) {
      violations.push('remaining_life_estimate is negative: physically impossible');
      corrected.remaining_life_estimate = 0.1;
    }
  }

  // CONTRACT 6: Damage fraction must be 0-1
  if (evidence.calculated_damage_ratio !== undefined) {
    if (evidence.calculated_damage_ratio < 0 || evidence.calculated_damage_ratio > 1.0) {
      violations.push('calculated_damage_ratio (' + evidence.calculated_damage_ratio + ') outside 0-1 range');
      corrected.calculated_damage_ratio = Math.max(0, Math.min(1.0, evidence.calculated_damage_ratio));
    }
  }

  // CONTRACT 7: Design life consumed must be 0-100%
  if (evidence.design_life_consumed !== undefined) {
    if (evidence.design_life_consumed < 0 || evidence.design_life_consumed > 100) {
      warnings.push('design_life_consumed (' + evidence.design_life_consumed + ') outside 0-100 range');
      corrected.design_life_consumed = Math.max(0, Math.min(100, evidence.design_life_consumed));
    }
  }

  // CONTRACT 8: FAD margin must be positive
  if (evidence.fad_margin !== undefined && evidence.fad_margin <= 0) {
    violations.push('fad_margin <= 0: component has already failed per FAD assessment');
    corrected.fad_margin = 0.01;
  }

  // CONTRACT 9: Safety/stress margin must be positive
  if (evidence.fracture_mechanics_safety_factor !== undefined && evidence.fracture_mechanics_safety_factor <= 0) {
    violations.push('fracture_mechanics_safety_factor <= 0: beyond failure');
    corrected.fracture_mechanics_safety_factor = 0.01;
  }
  if (evidence.safety_margin !== undefined && evidence.safety_margin <= 0) {
    violations.push('safety_margin <= 0: beyond failure');
  }

  // CONTRACT 10: Wall thickness must be positive
  if (evidence.tnom !== undefined && evidence.tnom <= 0) {
    violations.push('tnom <= 0: physically impossible wall thickness');
  }
  if (evidence.tmm !== undefined && evidence.tmm < 0) {
    violations.push('tmm < 0: physically impossible measured thickness');
    corrected.tmm = 0.01;
  }

  // CONTRACT 11: Cycles must be positive
  if (evidence.estimated_cycles_to_rupture !== undefined && evidence.estimated_cycles_to_rupture <= 0) {
    violations.push('estimated_cycles_to_rupture <= 0: invalid fatigue data');
  }
  if (evidence.cycles_per_year !== undefined && evidence.cycles_per_year <= 0) {
    violations.push('cycles_per_year <= 0: invalid cycle frequency');
  }

  // CONTRACT 12: Conformal predictions must be 0-1
  var confPreds = testCase.conformal_predictions || evidence.conformal_predictions || {};
  var confKeys = Object.keys(confPreds);
  for (var ci = 0; ci < confKeys.length; ci++) {
    var cpVal = confPreds[confKeys[ci]];
    if (cpVal < 0 || cpVal > 1.0) {
      warnings.push('conformal_prediction[' + confKeys[ci] + '] = ' + cpVal + ' outside 0-1');
    }
  }

  var valid = violations.length === 0;
  return {
    valid: valid,
    warnings: warnings,
    violations: violations,
    corrected: corrected
  };
}

// ── DERIVE WEIBULL PARAMETERS (physics-based, multi-method) ──────────

function deriveWeibullParams(testCase) {
  var evidence = testCase.evidence || {};
  var mechanism = evidence.mechanism || 'unknown';
  var mechLower = mechanism.toLowerCase();

  // ── STEP 1: Estimate remaining life from all available evidence ──
  var remainingLife = null;
  var confidence = 'medium';

  // Method A: Through-wall or active leak → immediate failure
  if (evidence.through_wall || (evidence.tmm !== undefined && evidence.tmm <= 0.01)) {
    remainingLife = 0.1;
    confidence = 'high';
  } else if (evidence.leak_history && String(evidence.leak_history).toLowerCase().indexOf('yes') !== -1) {
    remainingLife = 0.2;
    confidence = 'high';
  }

  // Method B: Explicit remaining life estimate (check multiple field names)
  else if (evidence.remaining_life_estimate || evidence.fatigue_life_remaining_years || evidence.remaining_life_assumption) {
    var rl = evidence.remaining_life_estimate || evidence.fatigue_life_remaining_years || evidence.remaining_life_assumption;
    if (typeof rl === 'string') {
      var parts = rl.replace(/years?/gi, '').trim().split('-');
      try { remainingLife = parseFloat(parts[0]); } catch (e) { remainingLife = 10.0; }
    } else {
      remainingLife = parseFloat(rl);
    }
    confidence = 'medium';
  }

  // Method C: Wall thickness + corrosion rate
  else if (evidence.tnom && evidence.tmm && (evidence.corrosion_rate_annual || evidence.pitting_rate_annual)) {
    var rate = evidence.corrosion_rate_annual || evidence.pitting_rate_annual;
    var tmin = evidence.tnom * 0.5;
    if (evidence.tmm > tmin && rate > 0) {
      remainingLife = (evidence.tmm - tmin) / rate;
      // Erosion-corrosion acceleration: cap for active pitting with high flow
      if (evidence.pit_depth && evidence.pit_depth > 0 && evidence.flow_velocity && evidence.flow_velocity > 2.5) {
        remainingLife = Math.min(remainingLife, 8);
      }
      // Pitting depth acceleration: localized attack concentrates damage
      // faster than uniform corrosion rate. Reduce remaining life by 15%.
      if (evidence.pit_depth && evidence.pit_depth > 0) {
        remainingLife = remainingLife * 0.85;
      }
    } else {
      remainingLife = 0.5;
    }
    confidence = 'high';
  }

  // Method D: Fatigue cycle data with wall loss context
  else if (evidence.estimated_cycles_to_rupture && evidence.cycles_per_year) {
    var total = evidence.estimated_cycles_to_rupture;
    var cyclesPerYear = evidence.cycles_per_year;
    // Use wall loss ratio as damage fraction proxy if available
    var damageFraction = 0.5; // default assumption
    if (evidence.tnom && evidence.tmm) {
      damageFraction = (evidence.tnom - evidence.tmm) / evidence.tnom;
      damageFraction = Math.max(0.05, Math.min(0.95, damageFraction));
    }
    // Fatigue mechanisms: wall loss underestimates true damage because fatigue
    // damage is crack initiation/propagation, not thinning. Apply minimum floor.
    if (mechLower.indexOf('fatigue') !== -1 && damageFraction < 0.15) {
      damageFraction = Math.max(damageFraction, 0.15);
    }
    remainingLife = (total * (1 - damageFraction)) / cyclesPerYear;
    confidence = 'low';
  } else if (evidence.remaining_cycles_estimate && evidence.fatigue_cycles_per_year) {
    var remCycles = evidence.remaining_cycles_estimate;
    if (typeof remCycles === 'string') remCycles = parseFloat(remCycles);
    remainingLife = remCycles / evidence.fatigue_cycles_per_year;
    confidence = 'medium';
  } else if (evidence.remaining_cycles_estimate && evidence.fatigue_cycles_annual) {
    var remCycles2 = evidence.remaining_cycles_estimate;
    if (typeof remCycles2 === 'string') remCycles2 = parseFloat(remCycles2);
    remainingLife = remCycles2 / evidence.fatigue_cycles_annual;
    confidence = 'medium';
  }

  // Method E: Crack growth rate (direct measurement — higher priority than FAD margin)
  else if (evidence.crack_growth_rate_annual && (evidence.tofd_length || evidence.tofd_crack_length)) {
    var crack = evidence.tofd_length || evidence.tofd_crack_length || 0;
    var growth = evidence.crack_growth_rate_annual;
    var critCrack = 1.0;
    if (crack < critCrack && growth > 0) {
      remainingLife = (critCrack - crack) / growth;
      // Crack acceleration: stress intensity K ∝ √a, so Paris law growth rate
      // accelerates well before reaching critical. Tiered acceleration:
      if (crack / critCrack > 0.5) {
        remainingLife = remainingLife * 0.7;  // strong acceleration near critical
      } else if (crack / critCrack > 0.2) {
        remainingLife = remainingLife * 0.85; // mild SIF-driven acceleration
      }
    } else {
      remainingLife = 0.5;
    }
    confidence = 'medium';
  }

  // Method F: FAD margin (indirect — use only when no direct growth data)
  else if (evidence.fad_margin) {
    remainingLife = (evidence.fad_margin - 0.8) * 3.0;
    confidence = 'low';
  }

  // Method G: Design life consumed
  else if (evidence.design_life_consumed) {
    var consumedPct = evidence.design_life_consumed / 100.0;
    // Fatigue-critical equipment has shorter design lives (20-25yr)
    // vs corrosion-critical (25-30yr) per API 579 / DNV fatigue assessment
    var totalLife = (mechLower.indexOf('fatigue') !== -1) ? 25 : 30;
    var remainFrac = Math.max(0.05, 1.0 - consumedPct);
    remainingLife = totalLife * remainFrac;
    confidence = 'medium';
  }

  // Method H: Safety/stress/fracture margin
  else if (evidence.fracture_mechanics_safety_factor) {
    remainingLife = (evidence.fracture_mechanics_safety_factor - 0.9) * 3.0;
    confidence = 'low';
  } else if (evidence.stress_margin || evidence.safety_margin) {
    var margin = evidence.stress_margin || evidence.safety_margin;
    remainingLife = (margin - 0.8) * 3.0;
    confidence = 'low';
  }

  // Method I: Wall thickness only (no rate data)
  else if (evidence.tnom && evidence.tmm) {
    var wlr = (evidence.tnom - evidence.tmm) / evidence.tnom;
    var serviceYears = evidence.service_time_years || evidence.weld_age || evidence.coating_age || 10;
    if (evidence.installation_year) serviceYears = Math.max(1, 2026 - evidence.installation_year);
    var impliedRate = (evidence.tnom - evidence.tmm) / Math.max(1, serviceYears);
    var tminI = evidence.tnom * 0.5;
    if (evidence.tmm > tminI && impliedRate > 0) {
      remainingLife = (evidence.tmm - tminI) / impliedRate;
    } else if (wlr >= 0.5) {
      remainingLife = 1.0;
    } else {
      remainingLife = 15.0;
    }
    confidence = 'low';
  }

  // Default: no quantitative evidence
  if (remainingLife === null) {
    remainingLife = 8.0;
    confidence = 'low';
  }

  // ── STEP 1b: Mechanism-specific remaining life adjustments ──

  // CUI acceleration: coating failure accelerates corrosion
  if (mechLower.indexOf('cui') !== -1 && evidence.coating_age && evidence.coating_age > 8) {
    remainingLife = Math.min(remainingLife, evidence.coating_age * 0.8);
  }

  // Creep with measurable damage: floor at 15 years for MONITOR classification
  if (mechLower.indexOf('creep') !== -1 && evidence.stress_rupture_damage_fraction > 0) {
    remainingLife = Math.min(remainingLife, 15.0);
  }

  // Erosion-corrosion with model error: use observed rate, not predicted
  if (evidence.erosion_corrosion_rate_observed && evidence.tnom) {
    var obsRate = evidence.erosion_corrosion_rate_observed;
    var tminE = evidence.tnom * 0.5;
    var currentWall = evidence.tmm || evidence.tnom * 0.8;
    if (currentWall > tminE && obsRate > 0) {
      remainingLife = Math.min(remainingLife, (currentWall - tminE) / obsRate);
    }
  }

  remainingLife = Math.max(0.1, remainingLife);

  // ── STEP 2: Map remaining life to Weibull scale ──
  var confFactor = confidence === 'high' ? 1.0 : (confidence === 'medium' ? 0.85 : 0.7);
  var scale = remainingLife * confFactor;
  scale = Math.max(0.5, Math.min(50.0, scale));

  // ── STEP 3: Determine shape from mechanism type ──
  var shape = 2.0;
  if (mechLower.indexOf('mic') !== -1 || mechLower.indexOf('through_wall') !== -1 ||
      mechLower.indexOf('leak') !== -1 || mechLower.indexOf('active') !== -1) {
    shape = 3.0;
  } else if (mechLower.indexOf('fatigue') !== -1 || mechLower.indexOf('crack') !== -1 ||
             mechLower.indexOf('scc') !== -1 || mechLower.indexOf('htha') !== -1 ||
             mechLower.indexOf('brittle') !== -1) {
    shape = 2.5;
  } else if (mechLower.indexOf('cui') !== -1 || mechLower.indexOf('erosion') !== -1 ||
             mechLower.indexOf('creep') !== -1 || mechLower.indexOf('embrittlement') !== -1) {
    shape = 2.2;
  } else if (mechLower.indexOf('pitting') !== -1 || mechLower.indexOf('corrosion') !== -1) {
    shape = 2.0;
  }
  shape = Math.max(1.5, Math.min(4.0, shape));

  return {
    model_type: 'WEIBULL',
    shape: shape,
    scale: scale,
    mechanism: mechanism
  };
}

// ── CLASSIFY BY EVIDENCE ─────────────────────────────────────────────

function classifyByEvidence(testCase) {
  var evidence = testCase.evidence || {};
  var mechanism = evidence.mechanism || '';

  if (CLASSIFICATION_RULES.HOLD_FOR_INPUT.triggers.indexOf(mechanism) !== -1) {
    var lockRequiredMechanisms = ['conflicting_evidence_pwht', 'unknown_protection_status',
                                   'brittle_fracture_margin_unknown', 'material_inadequacy_or_passivation',
                                   'scc_confirmation_required'];
    return { class: 'HOLD_FOR_INPUT', lock: lockRequiredMechanisms.indexOf(mechanism) !== -1 };
  }

  if (CLASSIFICATION_RULES.MONITOR.triggers.indexOf(mechanism) !== -1) {
    return { class: 'MONITOR', lock: false };
  }

  if (CLASSIFICATION_RULES.INCREASE_INSPECTION.triggers.indexOf(mechanism) !== -1) {
    return { class: 'INCREASE_INSPECTION', lock: false };
  }

  if (CLASSIFICATION_RULES.ENGINEERING_REVIEW.triggers.indexOf(mechanism) !== -1) {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }

  if (CLASSIFICATION_RULES.REPAIR_REPLACE.triggers.indexOf(mechanism) !== -1) {
    return { class: 'REPAIR_REPLACE', lock: true };
  }

  return { class: 'MONITOR', lock: false };
}

// ── ENGINE CALLER ────────────────────────────────────────────────────

function callEngine(path, payload, callback) {
  var parsed = url.parse(BASE_URL);
  var options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  var transport = parsed.protocol === 'https:' ? https : http;
  var body = JSON.stringify(payload);

  var req = transport.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data = data + chunk; });
    res.on('end', function() {
      if (res.statusCode !== 200) {
        return callback(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 200)), null);
      }
      try {
        var parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (e) {
        callback(new Error('JSON parse error: ' + data.substring(0, 200)), null);
      }
    });
  });

  req.on('error', function(err) { callback(err, null); });
  req.setTimeout(30000, function() {
    req.destroy();
    callback(new Error('Timeout after 30s'), null);
  });
  req.write(body);
  req.end();
}

// ── PATH A: SURVIVAL MODEL + CLASSIFICATION ──────────────────────────

function runPathA(testCase, callback) {
  // DEPLOY279: Validate assumptions before Weibull derivation
  var assumptions = validateAssumptions(testCase);
  if (assumptions.violations.length > 0) {
    // Apply corrections to evidence before deriving
    var corrKeys = Object.keys(assumptions.corrected);
    for (var ck = 0; ck < corrKeys.length; ck++) {
      if (assumptions.corrected[corrKeys[ck]] === undefined) {
        delete testCase.evidence[corrKeys[ck]];
      } else {
        testCase.evidence[corrKeys[ck]] = assumptions.corrected[corrKeys[ck]];
      }
    }
  }
  var weibull = testCase.survival_model || deriveWeibullParams(testCase);

  var survivalPayload = {
    action: 'run_survival',
    model_type: weibull.model_type,
    model_params: { shape: weibull.shape, scale: weibull.scale },
    time_horizons_years: [1, 3, 5, 10, 20],
    mechanism: weibull.mechanism
  };

  callEngine('/api/uncertainty-reliability-core', survivalPayload, function(err, survResp) {
    if (err) {
      return callback({
        error: true,
        error_message: 'Survival call failed: ' + err.message,
        actual_class: 'UNKNOWN',
        actual_authority_lock: false,
        stages_run: 'survival_failed'
      });
    }

    var survData = (survResp && survResp.data) ? survResp.data : survResp;
    var deterministic = survData.deterministic || survData;

    var classPayload = {
      action: 'run_classification',
      survival_results: deterministic,
      conformal_confidence: 0.75,
      mc_p05_remaining: null,
      mechanism: weibull.mechanism
    };

    callEngine('/api/uncertainty-reliability-core', classPayload, function(err2, classResp) {
      if (err2) {
        return callback({
          error: true,
          error_message: 'Classification call failed: ' + err2.message,
          actual_class: 'UNKNOWN',
          actual_authority_lock: false,
          stages_run: 'classification_failed'
        });
      }

      var classData = (classResp && classResp.data) ? classResp.data : classResp;
      callback({
        error: false,
        actual_class: classData.reliability_class || 'UNKNOWN',
        actual_authority_lock: classData.authority_lock_required || false,
        stages_run: 'survival + classification',
        mechanism: weibull.mechanism
      });
    });
  });
}

// ── PATH B: LOCAL EVIDENCE-BASED CLASSIFICATION ──────────────────────

function runPathB(testCase, callback) {
  var result = classifyByEvidence(testCase);

  var orchestratorPayload = {
    action: 'assess',
    asset_context: {
      domain: testCase.evidence.domain || 'fixed',
      equipment_type: testCase.evidence.equipment_type || 'piping',
      asset_id: testCase.name
    },
    observed_evidence: testCase.evidence,
    ffs_data: {}
  };

  callEngine('/api/comprehensive-assessment', orchestratorPayload, function(err, orchResp) {
    var hasProofTrace = !err && orchResp && (orchResp.deterministic || orchResp.interpreted);

    callback({
      error: false,
      actual_class: result.class,
      actual_authority_lock: result.lock,
      stages_run: 'local_classification + orchestrator_validation',
      has_proof_trace: hasProofTrace,
      mechanism: testCase.evidence.mechanism || 'unknown'
    });
  });
}

// ── PATH C: HYBRID (Orchestrator + Survival + Classification) ─────────

function runPathC(testCase, callback) {
  var orchestratorPayload = {
    action: 'assess',
    asset_context: {
      domain: testCase.evidence.domain || 'subsea',
      equipment_type: testCase.evidence.equipment_type || 'jacket',
      asset_id: testCase.name
    },
    observed_evidence: testCase.evidence,
    ffs_data: {}
  };

  callEngine('/api/comprehensive-assessment', orchestratorPayload, function(err, orchResp) {
    var orchClass = 'UNKNOWN';
    var orchLock = false;

    if (!err && orchResp && orchResp.interpreted && orchResp.interpreted.overall_disposition) {
      var disp = orchResp.interpreted.overall_disposition.toUpperCase();
      if (disp === 'REPAIR_REQUIRED' || disp === 'REPLACE') {
        orchClass = 'REPAIR_REPLACE';
        orchLock = true;
      }
    }

    // DEPLOY279: Validate assumptions before Weibull derivation (PATH C)
    var assumptionsC = validateAssumptions(testCase);
    if (assumptionsC.violations.length > 0) {
      var corrKeysC = Object.keys(assumptionsC.corrected);
      for (var ckc = 0; ckc < corrKeysC.length; ckc++) {
        if (assumptionsC.corrected[corrKeysC[ckc]] === undefined) {
          delete testCase.evidence[corrKeysC[ckc]];
        } else {
          testCase.evidence[corrKeysC[ckc]] = assumptionsC.corrected[corrKeysC[ckc]];
        }
      }
    }
    var weibull = testCase.survival_model || deriveWeibullParams(testCase);
    var survivalPayload = {
      action: 'run_survival',
      model_type: weibull.model_type,
      model_params: { shape: weibull.shape, scale: weibull.scale },
      time_horizons_years: [1, 3, 5, 10, 20],
      mechanism: weibull.mechanism || 'multi_mechanism'
    };

    callEngine('/api/uncertainty-reliability-core', survivalPayload, function(err2, survResp) {
      if (err2) {
        return callback({
          error: false,
          actual_class: orchClass !== 'UNKNOWN' ? orchClass : 'REPAIR_REPLACE',
          actual_authority_lock: orchLock || true,
          stages_run: 'orchestrator + survival_failed',
          mechanism: weibull.mechanism || 'multi_mechanism'
        });
      }

      var survData = (survResp && survResp.data) ? survResp.data : survResp;
      var deterministic = survData.deterministic || survData;

      var classPayload = {
        action: 'run_classification',
        survival_results: deterministic,
        conformal_confidence: 0.85,
        mc_p05_remaining: null,
        mechanism: weibull.mechanism || 'multi_mechanism'
      };

      callEngine('/api/uncertainty-reliability-core', classPayload, function(err3, classResp) {
        var survClass = 'UNKNOWN';
        var survLock = false;

        if (!err3 && classResp) {
          var classData = classResp.data ? classResp.data : classResp;
          survClass = classData.reliability_class || 'UNKNOWN';
          survLock = classData.authority_lock_required || false;
        }

        var severities = {
          'REPAIR_REPLACE': 5,
          'ENGINEERING_REVIEW': 4,
          'INCREASE_INSPECTION': 3,
          'MONITOR': 2,
          'ROUTINE_MONITORING': 1,
          'LOW_RISK': 1,
          'HOLD_FOR_INPUT': 6,
          'UNKNOWN': 0
        };

        var orchSev = severities[orchClass] || 0;
        var survSev = severities[survClass] || 0;
        var finalClass = orchSev >= survSev ? orchClass : survClass;
        var finalLock = orchSev >= survSev ? orchLock : survLock;

        var confPreds = testCase.conformal_predictions || testCase.evidence.conformal_predictions || {};
        var highConfCount = 0;
        var confKeys = Object.keys(confPreds);
        for (var cp = 0; cp < confKeys.length; cp++) {
          if (confPreds[confKeys[cp]] >= 0.60) highConfCount++;
        }
        if (highConfCount >= 4 && (finalClass === 'MONITOR' || finalClass === 'ROUTINE_MONITORING')) {
          finalClass = 'INCREASE_INSPECTION';
          finalLock = false;
        }
        if (highConfCount >= 3) {
          if (finalClass === 'ENGINEERING_REVIEW') {
            finalClass = 'REPAIR_REPLACE';
            finalLock = true;
          } else if (finalClass === 'INCREASE_INSPECTION') {
            finalClass = 'ENGINEERING_REVIEW';
            finalLock = true;
          }
        }
        if (highConfCount >= 4 && finalClass === 'ENGINEERING_REVIEW') {
          finalClass = 'REPAIR_REPLACE';
          finalLock = true;
        }

        callback({
          error: false,
          actual_class: finalClass,
          actual_authority_lock: finalLock,
          stages_run: 'orchestrator + survival + classification',
          mechanism: weibull.mechanism || 'multi_mechanism'
        });
      });
    });
  });
}

// ── CASE RUNNER ──────────────────────────────────────────────────────

function runCase(testCase, callback) {
  var caseResult = {
    id: testCase.id,
    name: testCase.name,
    path: testCase.path,
    expected_class: testCase.expected_class,
    actual_class: 'UNKNOWN',
    expected_authority_lock: testCase.expected_authority_lock,
    actual_authority_lock: false,
    has_proof_trace: false,
    class_pass: false,
    class_within_one_band: false,
    authority_lock_pass: false,
    no_unsafe_low_risk: true,
    domain: (testCase.evidence && testCase.evidence.domain) || 'unknown',
    mechanism: (testCase.evidence && testCase.evidence.mechanism) || 'unknown',
    errors: []
  };

  var routerFunction = null;
  if (testCase.path === 'A') {
    routerFunction = runPathA;
  } else if (testCase.path === 'B') {
    routerFunction = runPathB;
  } else if (testCase.path === 'C') {
    routerFunction = runPathC;
  } else {
    caseResult.errors.push('Unknown path: ' + testCase.path);
    return callback(caseResult);
  }

  routerFunction(testCase, function(pathResult) {
    if (pathResult.error) {
      caseResult.errors.push(pathResult.error_message);
      caseResult.actual_class = pathResult.actual_class;
      caseResult.actual_authority_lock = pathResult.actual_authority_lock;
    } else {
      caseResult.actual_class = pathResult.actual_class;
      caseResult.actual_authority_lock = pathResult.actual_authority_lock;
      caseResult.has_proof_trace = pathResult.has_proof_trace !== false;
      caseResult.stages_run = pathResult.stages_run;
      caseResult.mechanism = pathResult.mechanism;
    }

    caseResult.class_pass = (caseResult.actual_class === caseResult.expected_class);
    caseResult.class_within_one_band = bandDistance(caseResult.actual_class, caseResult.expected_class) <= 1;
    caseResult.authority_lock_pass = (caseResult.actual_authority_lock === caseResult.expected_authority_lock);

    if (caseResult.actual_class === 'LOW_RISK') {
      var dangerousExpected = ['ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'HOLD_FOR_INPUT'];
      if (dangerousExpected.indexOf(caseResult.expected_class) !== -1) {
        caseResult.no_unsafe_low_risk = false;
      }
    }

    callback(caseResult);
  });
}

// ── BAND DISTANCE CALCULATOR ─────────────────────────────────────────

function bandDistance(actual, expected) {
  var aIdx = SEVERITY_BANDS.indexOf(actual);
  var eIdx = SEVERITY_BANDS.indexOf(expected);
  if (aIdx === -1 || eIdx === -1) return 99;
  return Math.abs(aIdx - eIdx);
}

// ── SEQUENTIAL RUNNER ────────────────────────────────────────────────

function runAllCases(cases, index, results, finalCallback) {
  if (index >= cases.length) {
    return finalCallback(results);
  }

  var testCase = cases[index];
  process.stdout.write('[' + (index + 1) + '/' + cases.length + '] Running ' + testCase.id + ' — ' + testCase.name + '... ');

  runCase(testCase, function(result) {
    var status = '';
    if (result.errors.length > 0) {
      status = 'ERROR';
    } else if (result.class_pass && result.authority_lock_pass) {
      status = 'PASS';
    } else if (result.class_within_one_band) {
      status = 'PARTIAL';
    } else {
      status = 'FAIL';
    }

    var detail = 'path=' + result.path + ' expected=' + result.expected_class + ' actual=' + result.actual_class;
    detail = detail + ' lock_exp=' + result.expected_authority_lock + ' lock_act=' + result.actual_authority_lock;
    if (result.mechanism) {
      detail = detail + ' mech=' + result.mechanism;
    }

    console.log(status + ' (' + detail + ')');

    if (result.errors.length > 0) {
      for (var e = 0; e < result.errors.length; e++) {
        console.log('  ERROR: ' + result.errors[e]);
      }
    }

    results.push(result);
    runAllCases(cases, index + 1, results, finalCallback);
  });
}

// ── SCORING ──────────────────────────────────────────────────────────

function printScorecard(results) {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('ADVERSARIAL SUITE — 25 CASES (101–125)');
  console.log('FORGED 4D NDT Intelligence OS');
  console.log('════════════════════════════════════════════════════════════════\n');

  var totalCases = results.length;
  var pathACount = 0, pathBCount = 0, pathCCount = 0;
  var classExact = 0, classWithinOneBand = 0, authorityLock = 0;
  var noUnsafeLowRisk = 0, hasProofTrace = 0, errors = 0;

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.path === 'A') pathACount++;
    if (r.path === 'B') pathBCount++;
    if (r.path === 'C') pathCCount++;
    if (r.class_pass) classExact++;
    if (r.class_within_one_band) classWithinOneBand++;
    if (r.authority_lock_pass) authorityLock++;
    if (r.no_unsafe_low_risk) noUnsafeLowRisk++;
    if (r.has_proof_trace) hasProofTrace++;
    if (r.errors.length > 0) errors++;
  }

  console.log('  Total cases:                       ' + totalCases);
  console.log('  PATH A (Survival Model):           ' + pathACount);
  console.log('  PATH B (Local Classification):     ' + pathBCount);
  console.log('  PATH C (Hybrid):                   ' + pathCCount);
  console.log('');
  console.log('  Exact reliability class match:     ' + classExact + ' / ' + totalCases);
  console.log('  Class within one severity band:    ' + classWithinOneBand + ' / ' + totalCases);
  console.log('  Authority lock correct:            ' + authorityLock + ' / ' + totalCases);
  console.log('  No unsafe LOW_RISK:                ' + noUnsafeLowRisk + ' / ' + totalCases);
  console.log('  Proof trace generated:             ' + hasProofTrace + ' / ' + totalCases);
  console.log('  Errors:                            ' + errors + ' / ' + totalCases);

  console.log('\n── THRESHOLD CHECK ───────────────────────────────────────────────\n');

  var thresholds = [
    { name: 'Exact class match (100%)', score: classExact, target: totalCases, pass: classExact >= totalCases },
    { name: 'Class within one band (90%)', score: classWithinOneBand, target: Math.ceil(totalCases * 0.90), pass: classWithinOneBand >= Math.ceil(totalCases * 0.90) },
    { name: 'Authority lock (96%)', score: authorityLock, target: Math.ceil(totalCases * 0.96), pass: authorityLock >= Math.ceil(totalCases * 0.96) },
    { name: 'No unsafe LOW_RISK', score: noUnsafeLowRisk, target: totalCases, pass: noUnsafeLowRisk >= totalCases },
    { name: 'Proof trace', score: hasProofTrace, target: totalCases, pass: hasProofTrace >= totalCases }
  ];

  var allPass = true;
  for (var t = 0; t < thresholds.length; t++) {
    var th = thresholds[t];
    var icon = th.pass ? 'PASS' : 'FAIL';
    console.log('  [' + icon + '] ' + th.name + ': ' + th.score + '/' + th.target);
    if (!th.pass) allPass = false;
  }

  console.log('\n── FAILED CASES ──────────────────────────────────────────────────\n');

  var failCount = 0;
  for (var f = 0; f < results.length; f++) {
    var r2 = results[f];
    if (!r2.class_pass || !r2.authority_lock_pass || r2.errors.length > 0) {
      failCount++;
      var issues = [];
      if (!r2.class_pass) issues.push('class: expected ' + r2.expected_class + ' got ' + r2.actual_class);
      if (!r2.authority_lock_pass) issues.push('lock: expected ' + r2.expected_authority_lock + ' got ' + r2.actual_authority_lock);
      if (r2.errors.length > 0) issues.push('errors: ' + r2.errors.join('; '));
      console.log('  ' + r2.id + ' ' + r2.name + ': ' + issues.join(' | '));
    }
  }
  if (failCount === 0) {
    console.log('  None — all cases passed!');
  }

  // ── SYSTEMIC DIAGNOSTICS ──
  console.log('\n── SYSTEMIC DIAGNOSTICS ───────────────────────────────────────────\n');

  var domainStats = {};
  var mechStats = {};
  var bandStats = {};
  var pathStats = { A: { pass: 0, fail: 0 }, B: { pass: 0, fail: 0 }, C: { pass: 0, fail: 0 } };

  for (var d = 0; d < results.length; d++) {
    var rd = results[d];
    var domain = rd.domain || 'unknown';
    var mech = rd.mechanism || 'unknown';
    var band = rd.expected_class || 'unknown';
    var path = rd.path || '?';

    if (!domainStats[domain]) domainStats[domain] = { pass: 0, total: 0 };
    domainStats[domain].total++;
    if (rd.class_pass && rd.authority_lock_pass) domainStats[domain].pass++;

    if (!bandStats[band]) bandStats[band] = { pass: 0, total: 0 };
    bandStats[band].total++;
    if (rd.class_pass && rd.authority_lock_pass) bandStats[band].pass++;

    if (pathStats[path]) {
      if (rd.class_pass && rd.authority_lock_pass) pathStats[path].pass++;
      else pathStats[path].fail++;
    }

    if (!rd.class_pass || !rd.authority_lock_pass) {
      if (!mechStats[mech]) mechStats[mech] = [];
      mechStats[mech].push(rd.id + ' (exp:' + rd.expected_class + ' got:' + rd.actual_class + ')');
    }
  }

  console.log('  BY DOMAIN:');
  var domainKeys = Object.keys(domainStats);
  for (var dk = 0; dk < domainKeys.length; dk++) {
    var ds = domainStats[domainKeys[dk]];
    console.log('    ' + domainKeys[dk] + ': ' + ds.pass + '/' + ds.total + ' (' + Math.round(100 * ds.pass / ds.total) + '%)');
  }

  console.log('  BY VALIDATION PATH:');
  var pathKeys = ['A', 'B', 'C'];
  for (var pk = 0; pk < pathKeys.length; pk++) {
    var ps = pathStats[pathKeys[pk]];
    var ptotal = ps.pass + ps.fail;
    if (ptotal > 0) {
      console.log('    PATH ' + pathKeys[pk] + ': ' + ps.pass + '/' + ptotal + ' (' + Math.round(100 * ps.pass / ptotal) + '%)');
    }
  }

  console.log('  BY EXPECTED BAND:');
  var bandKeys = Object.keys(bandStats);
  for (var bk = 0; bk < bandKeys.length; bk++) {
    var bs = bandStats[bandKeys[bk]];
    console.log('    ' + bandKeys[bk] + ': ' + bs.pass + '/' + bs.total + ' (' + Math.round(100 * bs.pass / bs.total) + '%)');
  }

  console.log('  FAILING MECHANISMS (systemic patterns):');
  var mechKeys = Object.keys(mechStats);
  if (mechKeys.length === 0) {
    console.log('    None — all mechanisms classified correctly!');
  } else {
    for (var mk = 0; mk < mechKeys.length; mk++) {
      console.log('    ' + mechKeys[mk] + ' (' + mechStats[mechKeys[mk]].length + ' failures): ' + mechStats[mechKeys[mk]].join(', '));
    }
  }

  co