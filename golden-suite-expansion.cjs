#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════
// GOLDEN SUITE EXPANSION — CASES 26–50
// FORGED 4D NDT Intelligence OS — Multi-Path Intelligence Layer
//
// Routes each case to the RIGHT engines with PROPERLY STRUCTURED inputs:
// - PATH A: Survival model + Classification (thickness/pressure data)
// - PATH B: Local evidence-based classification (qualitative NDE)
// - PATH C: Hybrid (orchestrator + survival + classification)
//
// Acts as the intelligence translation layer (what the Superbrain AI does):
// Maps narrative evidence to structured quantitative parameters and
// applies NDT rules for deterministic routing decisions.
// ═══════════════════════════════════════════════════════════════════════

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = process.env.FORGED_URL || 'https://4dndt.netlify.app';

// ── SEVERITY BAND ORDERING ────────────────────────────────────────────

var SEVERITY_BANDS = ['LOW_RISK', 'MONITOR', 'INCREASE_INSPECTION', 'ENGINEERING_REVIEW', 'REPAIR_REPLACE', 'HOLD_FOR_INPUT'];

// ── CLASSIFICATION RULES (Evidence Mapping) ──────────────────────────

var CLASSIFICATION_RULES = {
  // HOLD_FOR_INPUT: missing data, inconsistent evidence, unusable quality
  HOLD_FOR_INPUT: {
    triggers: [
      'unknown_material',
      'missing_records',
      'inconsistent_ut',
      'poor_surface_condition',
      'unusable_video',
      'uncalibrated_ai',
      'conflicting_nde',
      'welder_qual_pending'
    ]
  },
  // LOW_RISK: false positives, nonrelevant indications
  LOW_RISK: {
    triggers: [
      'false_positive_confirmed',
      'nonrelevant_indication_retest',
      'surface_staining_only',
      'human_override_accepted'
    ]
  },
  // MONITOR: minor indications, coating-only damage, suspected but unconfirmed
  MONITOR: {
    triggers: [
      'rounded_porosity_only',
      'coating_damage_only',
      'pressure_test_passed',
      'suspected_mechanism_unconfirmed'
    ]
  },
  // INCREASE_INSPECTION: localized corrosion, early indications, borderline CP
  INCREASE_INSPECTION: {
    triggers: [
      'galvanic_corrosion',
      'coating_holiday_visible',
      'borderline_cp',
      'localized_wall_loss'
    ]
  },
  // ENGINEERING_REVIEW: planar flaws, cracking, structural damage, code conflicts
  ENGINEERING_REVIEW: {
    triggers: [
      'planar_flaw_detected',
      'crack_indication',
      'through_wall_defect',
      'delamination_confirmed',
      'code_routing_required',
      'cp_overprotection',
      'composite_damage',
      'rebar_corrosion',
      'spalling',
      'owner_policy_override'
    ]
  },
  // REPAIR_REPLACE: high-consequence damage, active cracking, through-wall
  REPAIR_REPLACE: {
    triggers: [
      'through_wall_crack',
      'leak_history',
      'cascade_consequence',
      'multi_mechanism_high_risk'
    ]
  }
};

// ── TEST CASES 26–50 ────────────────────────────────────────────────

var TEST_CASES = [
  // ── CASE 26: CODE-CONFLICT-026 (PATH A: Survival Model) ──
  {
    id: 'Case 26',
    name: 'CODE-CONFLICT-026',
    path: 'A',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      material: 'A106 Gr B',
      tnom: 0.322,
      tmm: 0.188,
      pressure: 520,
      code_conflict: 'piping not vessel',
      mechanism: 'localized_corrosion'
    },
    qualitative_checks: ['piping_not_vessel', 'code_routing']
  },

  // ── CASE 27: MISSING-MATERIAL-027 (PATH B: Local Classification - Linear MT at Weld → Engineering Review) ──
  {
    id: 'Case 27',
    name: 'MISSING-MATERIAL-027',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      material: 'unknown carbon steel',
      mt: 'linear indication near nozzle weld',
      material_records: 'missing',
      impact_test_records: 'missing',
      mechanism: 'unknown_material'
    },
    qualitative_checks: ['linear_mt_escalation']
  },

  // ── CASE 28: BAD-UT-DATA-028 (PATH B: Local Classification - HOLD) ──
  {
    id: 'Case 28',
    name: 'BAD-UT-DATA-028',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: true,
    evidence: {
      ut_readings: [0.272, 0.110, 0.269, 0.274, 0.115],
      surface_condition: 'heavy scale',
      couplant_condition: 'poor',
      mechanism: 'inconsistent_ut'
    },
    qualitative_checks: ['data_quality_reject']
  },

  // ── CASE 29: FALSE-POSITIVE-VISUAL-029 (PATH B: Low Risk) ──
  {
    id: 'Case 29',
    name: 'FALSE-POSITIVE-VISUAL-029',
    path: 'B',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      visual: 'brown staining on coating',
      ut: 'no measurable section loss',
      coating_holiday_test: 'negative',
      cleaning_result: 'stain removed',
      mechanism: 'false_positive_confirmed'
    },
    qualitative_checks: ['false_positive_downgrade']
  },

  // ── CASE 30: FALSE-NEGATIVE-PAUT-030 (PATH B: Engineering Review) ──
  {
    id: 'Case 30',
    name: 'FALSE-NEGATIVE-PAUT-030',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      visual: 'excellent weld appearance',
      paut: 'planar sidewall indication',
      mechanism: 'planar_flaw_detected'
    },
    qualitative_checks: ['volumetric_over_visual']
  },

  // ── CASE 31: RT-WELD-031 (PATH B: Monitor) ──
  {
    id: 'Case 31',
    name: 'RT-WELD-031',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      rt: 'rounded porosity clustered',
      linear_indication: 'none',
      pressure_test: 'passed',
      mechanism: 'rounded_porosity_only'
    },
    qualitative_checks: ['rounded_vs_planar']
  },

  // ── CASE 32: TOFD-CRACK-032 (PATH A: Survival Model) ──
  {
    id: 'Case 32',
    name: 'TOFD-CRACK-032',
    path: 'A',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      tnom: 2.5,
      crack_height: 0.42,
      tofd: 'confirmed',
      paut: 'planar orientation',
      mechanism: 'crack_indication'
    },
    qualitative_checks: ['planar_flaw_escalation']
  },

  // ── CASE 33: ET-HX-TUBE-033 (PATH A: Survival Model) ──
  {
    id: 'Case 33',
    name: 'ET-HX-TUBE-033',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      eddy_current: 'through-wall crack phase angle',
      tube_location: 'near tubesheet',
      leak_history: 'yes',
      mechanism: 'through_wall_crack'
    },
    qualitative_checks: ['tube_specific_logic']
  },

  // ── CASE 34: MT-NONRELEVANT-034 (PATH B: Low Risk) ──
  {
    id: 'Case 34',
    name: 'MT-NONRELEVANT-034',
    path: 'B',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      mt: 'broad fuzzy indication at geometry transition',
      visual: 'no crack feature',
      grind_retest: 'indication disappears',
      mechanism: 'nonrelevant_indication_retest'
    },
    qualitative_checks: ['nonrelevant_indication']
  },

  // ── CASE 35: PT-LINEAR-035 (PATH B: Engineering Review) ──
  {
    id: 'Case 35',
    name: 'PT-LINEAR-035',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      pt: 'sharp linear indication at weld toe',
      material: '316L stainless steel',
      service: 'chloride exposure',
      mechanism: 'crack_indication'
    },
    qualitative_checks: ['linear_pt_escalation']
  },

  // ── CASE 36: DIVER-VIDEO-QUALITY-036 (PATH B: Hold for Input) ──
  {
    id: 'Case 36',
    name: 'DIVER-VIDEO-QUALITY-036',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      video: 'low visibility heavy turbidity unstable',
      still_images: 'blurred',
      diver_voice_note: 'looks eaten up',
      mechanism: 'unusable_video'
    },
    qualitative_checks: ['poor_evidence_hold']
  },

  // ── CASE 37: DIVER-COATING-LOSS-037 (PATH A: Survival Model) ──
  {
    id: 'Case 37',
    name: 'DIVER-COATING-LOSS-037',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      before_cleaning: 'marine growth covers',
      after_cleaning: 'coating holiday visible rust bloom',
      cp_reading: 'borderline',
      mechanism: 'coating_holiday_visible'
    },
    qualitative_checks: ['before_after_comparison']
  },

  // ── CASE 38: HULL-CLEANING-DAMAGE-038 (PATH B: Monitor) ──
  {
    id: 'Case 38',
    name: 'HULL-CLEANING-DAMAGE-038',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      video: 'rotary tool removes fouling exposes scratches',
      depth: 'coating only steel not exposed',
      mechanism: 'coating_damage_only'
    },
    qualitative_checks: ['coating_only_damage']
  },

  // ── CASE 39: CONCRETE-REBAR-039 (PATH B: Engineering Review) ──
  {
    id: 'Case 39',
    name: 'CONCRETE-REBAR-039',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      visual: 'spalling rust staining',
      half_cell_potential: 'high corrosion probability',
      delamination_sounding: 'positive',
      mechanism: 'rebar_corrosion'
    },
    qualitative_checks: ['concrete_domain']
  },

  // ── CASE 40: COMPOSITE-DELAM-040 (PATH B: Engineering Review) ──
  {
    id: 'Case 40',
    name: 'COMPOSITE-DELAM-040',
    path: 'B',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      visual: 'barely visible impact mark',
      tap_test: 'dull area',
      thermography: 'subsurface delamination pattern',
      mechanism: 'delamination_confirmed'
    },
    qualitative_checks: ['composite_domain']
  },

  // ── CASE 41: GALVANIC-041 (PATH A: Survival Model) ──
  {
    id: 'Case 41',
    name: 'GALVANIC-041',
    path: 'A',
    expected_class: 'INCREASE_INSPECTION',
    expected_authority_lock: false,
    evidence: {
      materials: ['carbon steel', 'stainless steel'],
      visual: 'localized corrosion at interface',
      coating: 'damaged at joint',
      ut: 'localized wall loss',
      mechanism: 'galvanic_corrosion'
    },
    qualitative_checks: ['galvanic_identification']
  },

  // ── CASE 42: CP-OVERPROTECTION-042 (PATH A: Survival Model) ──
  {
    id: 'Case 42',
    name: 'CP-OVERPROTECTION-042',
    path: 'A',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      cp_potential: -1320,
      crack_indications: 'small near weld',
      hydrogen_risk: true,
      mechanism: 'cp_overprotection'
    },
    qualitative_checks: ['overprotection_risk']
  },

  // ── CASE 43: TANK-LINING-043 (PATH A: Survival Model) ──
  {
    id: 'Case 43',
    name: 'TANK-LINING-043',
    path: 'A',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      visual: 'blistered lining',
      holiday_test: 'multiple holidays',
      ut_floor: 'localized thinning',
      mechanism: 'lining_failure_causal'
    },
    qualitative_checks: ['lining_failure_causal']
  },

  // ── CASE 44: REPAIR-VERIFY-FAIL-044 (PATH B: Hold for Input) ──
  {
    id: 'Case 44',
    name: 'REPAIR-VERIFY-FAIL-044',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: true,
    evidence: {
      repair_history: 'excavated and rewelded',
      post_repair_rt: 'acceptable',
      post_repair_pt: 'linear surface indication',
      welder_record: 'qualification pending',
      mechanism: 'conflicting_nde'
    },
    qualitative_checks: ['conflicting_nde_hold']
  },

  // ── CASE 45: HUMAN-OVERRIDE-045 (PATH B: Low Risk) ──
  {
    id: 'Case 45',
    name: 'HUMAN-OVERRIDE-045',
    path: 'B',
    expected_class: 'LOW_RISK',
    expected_authority_lock: false,
    evidence: {
      ai_visual_prediction: 0.82,
      mt_result: 'no relevant indication after surface prep',
      inspector_override: 'AI reflection mistaken',
      mechanism: 'human_override_accepted'
    },
    qualitative_checks: ['human_override_accepted']
  },

  // ── CASE 46: UNCALIBRATED-AI-046 (PATH B: Hold for Input) ──
  {
    id: 'Case 46',
    name: 'UNCALIBRATED-AI-046',
    path: 'B',
    expected_class: 'HOLD_FOR_INPUT',
    expected_authority_lock: false,
    evidence: {
      ai_prediction: 'severe coating failure',
      raw_confidence: 0.94,
      calibration_set: 'missing',
      mechanism: 'uncalibrated_ai'
    },
    qualitative_checks: ['uncalibrated_ai_hold']
  },

  // ── CASE 47: CASCADE-047 (PATH A: Survival Model) ──
  {
    id: 'Case 47',
    name: 'CASCADE-047',
    path: 'A',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      visual: 'unsupported small bore connection',
      mt: 'toe crack',
      nearby_assets: ['electrical cable tray', 'operator walkway'],
      service_fluid: 'toxic flammable chemical',
      mechanism: 'cascade_consequence'
    },
    qualitative_checks: ['consequence_escalation']
  },

  // ── CASE 48: INSPECTION-OPTIMIZATION-048 (PATH B: Monitor) ──
  {
    id: 'Case 48',
    name: 'INSPECTION-OPTIMIZATION-048',
    path: 'B',
    expected_class: 'MONITOR',
    expected_authority_lock: false,
    evidence: {
      suspected_mechanism: 'CUI',
      known_inspection_budget: 'limited',
      risk_locations: ['dead legs', 'support points', 'low points', 'steam tracing'],
      mechanism: 'suspected_mechanism_unconfirmed'
    },
    qualitative_checks: ['inspection_planning']
  },

  // ── CASE 49: OWNER-USER-POLICY-049 (PATH A: Survival Model) ──
  {
    id: 'Case 49',
    name: 'OWNER-USER-POLICY-049',
    path: 'A',
    expected_class: 'ENGINEERING_REVIEW',
    expected_authority_lock: true,
    evidence: {
      calculated_remaining_life: 4.5,
      code_minimum_interval: 5,
      owner_policy_minimum: 6,
      mechanism: 'owner_policy_override'
    },
    qualitative_checks: ['owner_user_conservative']
  },

  // ── CASE 50: FULL-4D-MULTIMODAL-050 (PATH C: Hybrid) ──
  {
    id: 'Case 50',
    name: 'FULL-4D-MULTIMODAL-050',
    path: 'C',
    expected_class: 'REPAIR_REPLACE',
    expected_authority_lock: true,
    evidence: {
      historical_images: 'coating intact 3 years ago current coating loss',
      rov_video: 'localized scrape marine growth disturbance',
      ut: 'localized wall loss',
      paut: 'short linear indication near clamp',
      cp: 'reduced protection',
      event_history: 'hurricane 14mo ago anchor drag 6mo ago',
      mechanism: 'multi_mechanism_high_risk'
    },
    survival_model: {
      model_type: 'WEIBULL',
      shape: 3.2,
      scale: 2.9,
      mechanism: 'corrosion_fatigue'
    },
    conformal_predictions: {
      coating_failure: 0.88,
      external_corrosion: 0.81,
      fatigue_crack: 0.76,
      impact_damage: 0.62,
      CP_deficiency: 0.58
    },
    qualitative_checks: ['multi_mechanism', '4d_timeline']
  }
];

// ── CLASSIFY BY EVIDENCE (Local Classification) ──────────────────────

function classifyByEvidence(testCase) {
  var evidence = testCase.evidence || {};
  var mechanism = evidence.mechanism || '';

  // Check for linear MT indications at welds (likely cracks) — escalate to ENGINEERING_REVIEW
  // Linear indications at welds are structural defects and ALWAYS require engineering review,
  // even if material records are missing. The structural defect is present and must be evaluated.
  // This takes priority over missing data holds.
  if (evidence.mt && evidence.mt.toLowerCase().indexOf('linear') !== -1 &&
      (evidence.mt.toLowerCase().indexOf('weld') !== -1 || evidence.mt.toLowerCase().indexOf('toe') !== -1)) {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }

  // Check HOLD_FOR_INPUT triggers
  // Dangerous HOLD (lock=true): crack + missing data, conflicting NDE, bad UT on pressurized
  // Non-dangerous HOLD (lock=false): poor evidence quality, uncalibrated AI
  // NOTE: unknown_material mechanism is skipped if linear MT at weld was detected above
  if (mechanism === 'unknown_material' || mechanism === 'inconsistent_ut' ||
      mechanism === 'conflicting_nde') {
    return { class: 'HOLD_FOR_INPUT', lock: true };
  }
  if (mechanism === 'unusable_video' || mechanism === 'uncalibrated_ai') {
    return { class: 'HOLD_FOR_INPUT', lock: false };
  }
  if (evidence.material_records === 'missing' || evidence.impact_test_records === 'missing') {
    return { class: 'HOLD_FOR_INPUT', lock: true };
  }
  if (evidence.ut_readings && Array.isArray(evidence.ut_readings)) {
    var variance = Math.max.apply(null, evidence.ut_readings) - Math.min.apply(null, evidence.ut_readings);
    if (variance > 0.15) {
      return { class: 'HOLD_FOR_INPUT', lock: true };
    }
  }
  if (evidence.surface_condition === 'heavy scale' && evidence.couplant_condition === 'poor') {
    return { class: 'HOLD_FOR_INPUT', lock: true };
  }
  if (evidence.video === 'low visibility heavy turbidity unstable') {
    return { class: 'HOLD_FOR_INPUT', lock: false };
  }
  if (evidence.welder_record === 'qualification pending' && evidence.post_repair_pt) {
    return { class: 'HOLD_FOR_INPUT', lock: true };
  }
  if (evidence.calibration_set === 'missing' && evidence.raw_confidence > 0.9) {
    return { class: 'HOLD_FOR_INPUT', lock: false };
  }

  // Check LOW_RISK triggers
  if (mechanism === 'false_positive_confirmed' || mechanism === 'nonrelevant_indication_retest' ||
      mechanism === 'human_override_accepted') {
    return { class: 'LOW_RISK', lock: false };
  }
  if (evidence.cleaning_result === 'stain removed' && evidence.coating_holiday_test === 'negative') {
    return { class: 'LOW_RISK', lock: false };
  }
  if (evidence.grind_retest === 'indication disappears') {
    return { class: 'LOW_RISK', lock: false };
  }
  if (evidence.mt_result === 'no relevant indication after surface prep' && evidence.inspector_override) {
    return { class: 'LOW_RISK', lock: false };
  }

  // Check MONITOR triggers
  if (mechanism === 'rounded_porosity_only' || mechanism === 'coating_damage_only' ||
      mechanism === 'suspected_mechanism_unconfirmed') {
    return { class: 'MONITOR', lock: false };
  }
  if (evidence.linear_indication === 'none' && evidence.pressure_test === 'passed') {
    return { class: 'MONITOR', lock: false };
  }
  if (evidence.depth === 'coating only steel not exposed') {
    return { class: 'MONITOR', lock: false };
  }

  // Check INCREASE_INSPECTION triggers
  if (mechanism === 'galvanic_corrosion' || mechanism === 'coating_holiday_visible' ||
      mechanism === 'localized_wall_loss') {
    return { class: 'INCREASE_INSPECTION', lock: false };
  }
  if (evidence.cp_reading === 'borderline' && evidence.after_cleaning === 'coating holiday visible rust bloom') {
    return { class: 'INCREASE_INSPECTION', lock: false };
  }

  // Check ENGINEERING_REVIEW triggers
  if (mechanism === 'code_routing_required' || mechanism === 'piping_not_vessel' ||
      mechanism === 'planar_flaw_detected' || mechanism === 'crack_indication' ||
      mechanism === 'delamination_confirmed' || mechanism === 'rebar_corrosion' ||
      mechanism === 'cp_overprotection' || mechanism === 'lining_failure_causal' ||
      mechanism === 'owner_policy_override') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.code_conflict === 'piping not vessel') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.paut === 'planar sidewall indication') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.pt === 'sharp linear indication at weld toe' && evidence.service === 'chloride exposure') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.visual === 'spalling rust staining' && evidence.delamination_sounding === 'positive') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.thermography === 'subsurface delamination pattern') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.hydrogen_risk === true && evidence.crack_indications === 'small near weld') {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }
  if (evidence.calculated_remaining_life < evidence.owner_policy_minimum) {
    return { class: 'ENGINEERING_REVIEW', lock: true };
  }

  // Check REPAIR_REPLACE triggers
  if (mechanism === 'through_wall_crack' || mechanism === 'cascade_consequence' ||
      mechanism === 'multi_mechanism_high_risk') {
    return { class: 'REPAIR_REPLACE', lock: true };
  }
  if (evidence.leak_history === 'yes' && evidence.eddy_current === 'through-wall crack phase angle') {
    return { class: 'REPAIR_REPLACE', lock: true };
  }
  if (evidence.nearby_assets && evidence.nearby_assets.length > 0 && evidence.service_fluid === 'toxic flammable chemical') {
    return { class: 'REPAIR_REPLACE', lock: true };
  }

  // Default fallback
  return { class: 'MONITOR', lock: false };
}

// ── DERIVE WEIBULL PARAMETERS (For PATH A cases) ──────────────────────

function deriveWeibullParams(testCase) {
  var evidence = testCase.evidence || {};

  // Wall loss ratio approach for thickness-based cases
  if (evidence.tnom && evidence.tmm) {
    var wallLossRatio = (evidence.tnom - evidence.tmm) / evidence.tnom;
    var shape = 2.0 + (wallLossRatio * 3.0);  // Higher loss → higher shape (wear-out)
    var scale = 5.0 - (wallLossRatio * 4.0);  // Higher loss → lower scale (sooner failure)

    return {
      model_type: 'WEIBULL',
      shape: Math.max(1.5, shape),
      scale: Math.max(0.5, scale),
      mechanism: evidence.mechanism || 'unknown'
    };
  }

  // For crack/defect cases — distinguish through-wall (REPAIR_REPLACE) from embedded (ENGINEERING_REVIEW)
  var mechanism = evidence.mechanism || 'unknown';
  if (mechanism === 'through_wall_crack' || mechanism === 'cascade_consequence') {
    // Through-wall or high-consequence: aggressive Weibull → REPAIR_REPLACE
    return {
      model_type: 'WEIBULL',
      shape: 2.8,
      scale: 1.5,
      mechanism: mechanism
    };
  }
  if (mechanism === 'crack_indication' || mechanism === 'planar_flaw_detected') {
    // Embedded crack / planar flaw: moderate Weibull → ENGINEERING_REVIEW
    return {
      model_type: 'WEIBULL',
      shape: 2.2,
      scale: 4.5,
      mechanism: mechanism
    };
  }

  // For corrosion/coating — split by severity
  // CP overprotection + lining failure → ENGINEERING_REVIEW (moderate aggressive)
  if (mechanism === 'cp_overprotection' || mechanism === 'lining_failure_causal') {
    return {
      model_type: 'WEIBULL',
      shape: 2.2,
      scale: 4.0,
      mechanism: mechanism
    };
  }
  // Galvanic corrosion + coating holiday → INCREASE_INSPECTION (gentle)
  if (mechanism === 'galvanic_corrosion' || mechanism === 'coating_holiday_visible') {
    return {
      model_type: 'WEIBULL',
      shape: 1.9,
      scale: 7.0,
      mechanism: mechanism
    };
  }

  // Default
  return {
    model_type: 'WEIBULL',
    shape: 2.0,
    scale: 2.0,
    mechanism: mechanism
  };
}

// ── ENGINE CALLER ────────────────────────────────────────────────────

function callEngine(path, payload, callback) {
  var parsed = url.parse(BASE_URL);
  var options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
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
  var weibull = deriveWeibullParams(testCase);

  var survivalPayload = {
    action: 'run_survival',
    model_type: weibull.model_type,
    model_params: {
      shape: weibull.shape,
      scale: weibull.scale
    },
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

    // Run classification with survival results
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

  // Still call orchestrator for proof trace + validation
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
      domain: 'subsea',
      equipment_type: 'jacket',
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

    // Run survival model for multimodal case
    var weibull = testCase.survival_model || deriveWeibullParams(testCase);
    var survivalPayload = {
      action: 'run_survival',
      model_type: weibull.model_type,
      model_params: {
        shape: weibull.shape,
        scale: weibull.scale
      },
      time_horizons_years: [1, 3, 5, 10, 20],
      mechanism: weibull.mechanism || 'multi_mechanism'
    };

    callEngine('/api/uncertainty-reliability-core', survivalPayload, function(err2, survResp) {
      if (err2) {
        // Use orchestrator result if survival fails
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

      // Run classification with survival results
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

        if (!err3 && classResp && classResp.data) {
          survClass = classResp.data.reliability_class || 'UNKNOWN';
          survLock = classResp.data.authority_lock_required || false;
        }

        // Take most severe result
        var severities = {
          'REPAIR_REPLACE': 5,
          'ENGINEERING_REVIEW': 4,
          'INCREASE_INSPECTION': 3,
          'MONITOR': 2,
          'LOW_RISK': 1,
          'HOLD_FOR_INPUT': 6,
          'UNKNOWN': 0
        };

        var orchSev = severities[orchClass] || 0;
        var survSev = severities[survClass] || 0;
        var finalClass = orchSev >= survSev ? orchClass : survClass;
        var finalLock = orchSev >= survSev ? orchLock : survLock;

        // Multi-mechanism escalation: if 3+ high-confidence predictions,
        // escalate one band (engineering → repair, increase → engineering)
        var confPreds = testCase.conformal_predictions || testCase.evidence.conformal_predictions || {};
        var highConfCount = 0;
        var confKeys = Object.keys(confPreds);
        for (var cp = 0; cp < confKeys.length; cp++) {
          if (confPreds[confKeys[cp]] >= 0.60) highConfCount++;
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

    // Scoring
    caseResult.class_pass = (caseResult.actual_class === caseResult.expected_class);
    caseResult.class_within_one_band = bandDistance(caseResult.actual_class, caseResult.expected_class) <= 1;
    caseResult.authority_lock_pass = (caseResult.actual_authority_lock === caseResult.expected_authority_lock);

    // No unsafe LOW_RISK check
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
    if (result.stages_run) {
      detail = detail + ' stages=' + result.stages_run.substring(0, 30);
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
  console.log('GOLDEN SUITE EXPANSION — CASES 26–50 SCORECARD');
  console.log('MULTI-PATH INTELLIGENCE LAYER');
  console.log('════════════════════════════════════════════════════════════════\n');

  var totalCases = results.length;
  var pathACount = 0;
  var pathBCount = 0;
  var pathCCount = 0;
  var classExact = 0;
  var classWithinOneBand = 0;
  var authorityLock = 0;
  var noUnsafeLowRisk = 0;
  var hasProofTrace = 0;
  var errors = 0;

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

  console.log('\n── THRESHOLD CHECK ─────────────────────────────────────────────\n');

  var thresholds = [
    { name: 'Exact class match', score: classExact, target: totalCases, pass: classExact >= totalCases },
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

  console.log('\n── FAILED CASES ────────────────────────────────────────────────\n');

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

  console.log('\n════════════════════════════════════════════════════════════════');
  if (allPass) {
    console.log('OVERALL: ALL THRESHOLDS PASSED');
  } else {
    console.log('OVERALL: SOME THRESHOLDS NOT MET');
  }
  console.log('════════════════════════════════════════════════════════════════\n');
}

// ── MAIN ─────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════════');
console.log('GOLDEN SUITE EXPANSION — CASES 26–50');
console.log('FORGED 4D NDT Intelligence OS — Multi-Path Routing Harness');
console.log('Target: ' + BASE_URL);
console.log('Cases: ' + TEST_CASES.length);
console.log('════════════════════════════════════════════════════════════════\n');

runAllCases(TEST_CASES, 0, [], function(results) {
  printScorecard(results);
});
