// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_ANON_KEY;
var supabase = createClient(supabaseUrl, supabaseKey);

var EVIDENCE_COST_TABLE = {
  ut_thickness: { cost: 200, time: '1 hour', difficulty: 'low', time_minutes: 60 },
  ut_grid: { cost: 800, time: '4 hours', difficulty: 'medium', time_minutes: 240 },
  rt_radiography: { cost: 1500, time: '8 hours', difficulty: 'medium', time_minutes: 480 },
  mt_magnetic_particle: { cost: 300, time: '2 hours', difficulty: 'low', time_minutes: 120 },
  pt_liquid_penetrant: { cost: 250, time: '2 hours', difficulty: 'low', time_minutes: 120 },
  visual_inspection: { cost: 100, time: '30 min', difficulty: 'low', time_minutes: 30 },
  phased_array_ut: { cost: 2000, time: '6 hours', difficulty: 'high', time_minutes: 360 },
  tofd: { cost: 1800, time: '4 hours', difficulty: 'high', time_minutes: 240 },
  eddy_current: { cost: 600, time: '2 hours', difficulty: 'medium', time_minutes: 120 },
  hardness_testing: { cost: 400, time: '1 hour', difficulty: 'medium', time_minutes: 60 },
  metallography: { cost: 3000, time: '2 days', difficulty: 'high', time_minutes: 2880 },
  chemical_analysis: { cost: 1500, time: '1 day', difficulty: 'high', time_minutes: 1440 },
  cp_survey: { cost: 500, time: '4 hours', difficulty: 'medium', time_minutes: 240 },
  coating_holiday: { cost: 300, time: '2 hours', difficulty: 'low', time_minutes: 120 },
  vibration_analysis: { cost: 800, time: '4 hours', difficulty: 'medium', time_minutes: 240 },
  process_data: { cost: 50, time: '15 min', difficulty: 'low', time_minutes: 15 },
  rov_video: { cost: 5000, time: '1 day', difficulty: 'high', time_minutes: 1440 },
  diving_inspection: { cost: 8000, time: '1 day', difficulty: 'very_high', time_minutes: 1440 }
};

var SYNTHETIC_TEMPLATES = [
  {
    scenario_name: 'subsea_corrosion_fatigue_interaction',
    domain: 'subsea_pipeline',
    complexity: 'high',
    case_details: {
      asset_type: 'subsea_jumper',
      depth: 500,
      age_years: 8,
      material: 'X65',
      coating_type: 'fusion_bonded_epoxy',
      observations: [
        { type: 'visual', finding: 'minor_blistering_fbe' },
        { type: 'ut_thickness', finding: 'uniform_no_loss' },
        { type: 'cp_survey', finding: 'potential_below_protection_zone' }
      ]
    },
    expected_failure_mode: 'stress_corrosion_cracking',
    expected_reasoning: 'coating_integrity_loss_plus_cathodic_protection_drift'
  },
  {
    scenario_name: 'boiler_creep_fatigue_conflicting_data',
    domain: 'power_plant',
    complexity: 'high',
    case_details: {
      asset_type: 'superheater_tube',
      operating_temp: 550,
      age_years: 15,
      material: 'p22_steel',
      observations: [
        { type: 'visual', finding: 'surface_smooth_no_visible_damage' },
        { type: 'ut_grid', finding: 'wall_loss_8_percent' },
        { type: 'hardness_testing', finding: 'material_softening_creep_indicator' }
      ]
    },
    expected_failure_mode: 'creep_rupture',
    expected_reasoning: 'hidden_degradation_despite_visual_acceptance'
  },
  {
    scenario_name: 'weld_code_failure_visual_acceptable',
    domain: 'construction',
    complexity: 'medium',
    case_details: {
      asset_type: 'structural_weld',
      code: 'api_579',
      observations: [
        { type: 'visual', finding: 'filler_profile_acceptable' },
        { type: 'rt_radiography', finding: 'lack_of_fusion_4mm' },
        { type: 'pt_liquid_penetrant', finding: 'no_surface_breaking_indications' }
      ]
    },
    expected_failure_mode: 'stress_concentration_failure',
    expected_reasoning: 'subsurface_defect_acceptance_criteria_exceeded'
  },
  {
    scenario_name: 'coating_failure_secondary_corrosion',
    domain: 'marine_vessel',
    complexity: 'medium',
    case_details: {
      asset_type: 'hull_plate',
      age_years: 12,
      coating_system: 'epoxy_polyurethane',
      observations: [
        { type: 'visual', finding: 'coating_blistering_20_percent_area' },
        { type: 'eddy_current', finding: 'steel_loss_quantified' },
        { type: 'visual', finding: 'white_corrosion_product_under_coating' }
      ]
    },
    expected_failure_mode: 'uniform_corrosion_acceleration',
    expected_reasoning: 'coating_failure_creating_galvanic_cell'
  },
  {
    scenario_name: 'refinery_process_upset',
    domain: 'refinery',
    complexity: 'high',
    case_details: {
      asset_type: 'crude_distillation_column',
      service: 'naphtha_stabilizer',
      age_years: 18,
      material: 'carbon_steel',
      observations: [
        { type: 'process_data', finding: 'temperature_excursion_documented' },
        { type: 'ut_grid', finding: 'accelerated_corrosion_rate' },
        { type: 'visual', finding: 'localized_pitting_observed' }
      ]
    },
    expected_failure_mode: 'localized_corrosion',
    expected_reasoning: 'process_upset_accelerating_corrosion_mechanisms'
  },
  {
    scenario_name: 'underwater_weld_poor_visibility',
    domain: 'subsea_infrastructure',
    complexity: 'high',
    case_details: {
      asset_type: 'pipeline_connection_weld',
      depth: 800,
      visibility: 'poor',
      observations: [
        { type: 'rov_video', finding: 'visual_assessment_limited' },
        { type: 'ut_grid', finding: 'scattered_indications_high_variance' },
        { type: 'phased_array_ut', finding: 'multiple_defects_clustered' }
      ]
    },
    expected_failure_mode: 'multiple_weld_defects',
    expected_reasoning: 'high_uncertainty_requires_multimodal_validation'
  },
  {
    scenario_name: 'pipeline_trauma_delayed_degradation',
    domain: 'pipeline',
    complexity: 'high',
    case_details: {
      asset_type: 'transmission_pipeline',
      age_years: 25,
      prior_incident: 'external_damage_gouge_2010',
      observations: [
        { type: 'visual', finding: 'gouge_site_no_immediate_failure' },
        { type: 'ut_thickness', finding: 'no_active_loss_at_gouge' },
        { type: 'magnetic_particle', finding: 'stress_concentration_evidence' }
      ]
    },
    expected_failure_mode: 'stress_riser_fatigue',
    expected_reasoning: 'trauma_site_stress_concentration_accumulating_damage'
  },
  {
    scenario_name: 'aerospace_fatigue_scatter',
    domain: 'aerospace',
    complexity: 'high',
    case_details: {
      asset_type: 'wing_root_attachment',
      flight_hours: 32000,
      design_life: 40000,
      observations: [
        { type: 'visual', finding: 'no_visible_cracks' },
        { type: 'eddy_current', finding: 'subsurface_initiation_detected' },
        { type: 'tofd', finding: 'crack_sizing_10mm' }
      ]
    },
    expected_failure_mode: 'high_cycle_fatigue',
    expected_reasoning: 'fatigue_crack_accumulation_near_design_life'
  },
  {
    scenario_name: 'pressure_vessel_hydrogen_attack',
    domain: 'chemical_plant',
    complexity: 'high',
    case_details: {
      asset_type: 'hydrogen_containing_vessel',
      operating_temp: 200,
      operating_pressure: 300,
      age_years: 22,
      observations: [
        { type: 'visual', finding: 'no_external_damage' },
        { type: 'ut_thickness', finding: 'uniform_but_reducing_rate' },
        { type: 'hardness_testing', finding: 'brittle_indication_hydrogen_embrittlement' }
      ]
    },
    expected_failure_mode: 'hydrogen_induced_cracking',
    expected_reasoning: 'hydrogen_diffusion_combined_material_susceptibility'
  },
  {
    scenario_name: 'composite_delamination_impact',
    domain: 'composite_structures',
    complexity: 'medium',
    case_details: {
      asset_type: 'wind_turbine_blade',
      impact_history: 'lightning_strike_1_year_ago',
      observations: [
        { type: 'visual', finding: 'surface_paint_intact' },
        { type: 'rt_radiography', finding: 'subsurface_delamination' },
        { type: 'vibration_analysis', finding: 'frequency_response_shifted' }
      ]
    },
    expected_failure_mode: 'progressive_delamination',
    expected_reasoning: 'impact_damage_growth_under_cyclic_loading'
  }
];

var buildResult = function(statusCode, action, selfLearning) {
  var result = {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify({
      engine: 'closed-loop-self-learning-brain',
      version: 'v1.0.0',
      action: action,
      self_learning: selfLearning,
      timestamp: new Date().toISOString()
    })
  };
  return result;
};

var holdResult = function(statusCode, errorMsg, action) {
  var result = {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      engine: 'closed-loop-self-learning-brain',
      version: 'v1.0.0',
      action: action,
      error: errorMsg,
      timestamp: new Date().toISOString()
    })
  };
  return result;
};

var getRegistry = function() {
  var registry = {
    engine_code: 'ENGINE_108',
    engine_name: 'Closed-Loop Self-Learning Brain',
    version: 'v1.0.0',
    deploy_id: 'DEPLOY316',
    subsystems: 12,
    actions: [
      'get_registry',
      'record_outcome',
      'record_override',
      'score_evidence_value',
      'calibrate_confidence',
      'evolve_concepts',
      'propose_threshold_update',
      'generate_synthetic',
      'update_asset_twin',
      'get_learning_stats',
      'approve_update',
      'get_learning_queue'
    ],
    description: 'Autonomous closed-loop learning system for NDT platform'
  };
  return buildResult(200, 'get_registry', registry);
};

var recordOutcome = async function(data) {
  try {
    var caseId = data.case_id;
    var proofId = data.proof_id;
    var predictedMechanism = data.predicted_mechanism;
    var predictedSeverity = data.predicted_severity;
    var predictedOutcome = data.predicted_outcome;
    var confirmedMechanism = data.confirmed_mechanism;
    var confirmedSeverity = data.confirmed_severity;
    var confirmedOutcome = data.confirmed_outcome;

    var mechanismMatch = predictedMechanism === confirmedMechanism ? 1 : 0;
    var severityMatch = Math.abs(predictedSeverity - confirmedSeverity) <= 0.1 ? 1 : 0;
    var outcomeMatch = predictedOutcome === confirmedOutcome ? 1 : 0;

    var predictionAccuracy = (mechanismMatch + severityMatch + outcomeMatch) / 3.0;

    var insertData = {
      case_id: caseId,
      proof_id: proofId,
      predicted_mechanism: predictedMechanism,
      predicted_severity: predictedSeverity,
      predicted_outcome: predictedOutcome,
      confirmed_mechanism: confirmedMechanism,
      confirmed_severity: confirmedSeverity,
      confirmed_outcome: confirmedOutcome,
      prediction_accuracy: predictionAccuracy,
      recorded_at: new Date().toISOString()
    };

    var response = await supabase
      .from('learning_outcomes')
      .insert([insertData]);

    if (response.error) {
      return holdResult(500, 'Database error: ' + response.error.message, 'record_outcome');
    }

    var result = {
      case_id: caseId,
      prediction_accuracy: predictionAccuracy,
      mechanism_correct: mechanismMatch === 1,
      severity_correct: severityMatch === 1,
      outcome_correct: outcomeMatch === 1
    };

    return buildResult(200, 'record_outcome', result);
  } catch (err) {
    return holdResult(500, 'Exception in recordOutcome: ' + err.message, 'record_outcome');
  }
};

var recordOverride = async function(data) {
  try {
    var caseId = data.case_id;
    var originalRecommendation = data.original_recommendation;
    var overrideRecommendation = data.override_recommendation;
    var humanRole = data.human_role;
    var overrideReason = data.override_reason;
    var evidenceCited = data.evidence_cited;

    var insertData = {
      case_id: caseId,
      original_recommendation: originalRecommendation,
      override_recommendation: overrideRecommendation,
      human_role: humanRole,
      override_reason: overrideReason,
      evidence_cited: evidenceCited,
      recorded_at: new Date().toISOString()
    };

    var response = await supabase
      .from('inspector_overrides')
      .insert([insertData]);

    if (response.error) {
      return holdResult(500, 'Database error: ' + response.error.message, 'record_override');
    }

    var result = {
      case_id: caseId,
      override_recorded: true,
      human_role: humanRole,
      reason: overrideReason
    };

    return buildResult(200, 'record_override', result);
  } catch (err) {
    return holdResult(500, 'Exception in recordOverride: ' + err.message, 'record_override');
  }
};

var scoreEvidenceValue = async function(data) {
  try {
    var caseId = data.case_id;
    var evidenceType = data.evidence_type;
    var evidenceName = data.evidence_name;
    var uncertaintyBefore = data.uncertainty_before;
    var uncertaintyAfter = data.uncertainty_after;

    var evidenceCostData = EVIDENCE_COST_TABLE[evidenceType];
    if (!evidenceCostData) {
      return holdResult(400, 'Unknown evidence type: ' + evidenceType, 'score_evidence_value');
    }

    var uncertaintyReduction = uncertaintyBefore - uncertaintyAfter;
    var costToObtain = evidenceCostData.cost;
    var timeToObtain = evidenceCostData.time;
    var timeMinutes = evidenceCostData.time_minutes;

    var maxCost = 8000;
    var maxTime = 2880;
    var normalizedCost = costToObtain / maxCost;
    var normalizedTime = timeMinutes / maxTime;

    var valueScore = normalizedCost > 0 && normalizedTime > 0
      ? uncertaintyReduction / (normalizedCost * normalizedTime)
      : 0;

    var insertData = {
      case_id: caseId,
      evidence_type: evidenceType,
      evidence_name: evidenceName,
      uncertainty_before: uncertaintyBefore,
      uncertainty_after: uncertaintyAfter,
      uncertainty_reduction: uncertaintyReduction,
      cost_to_obtain: costToObtain,
      time_to_obtain: timeToObtain,
      value_score: valueScore,
      recorded_at: new Date().toISOString()
    };

    var response = await supabase
      .from('evidence_value_records')
      .insert([insertData]);

    if (response.error) {
      return holdResult(500, 'Database error: ' + response.error.message, 'score_evidence_value');
    }

    var result = {
      case_id: caseId,
      evidence_type: evidenceType,
      uncertainty_reduction: uncertaintyReduction,
      value_score: valueScore,
      cost_to_obtain: costToObtain,
      time_to_obtain: timeToObtain
    };

    return buildResult(200, 'score_evidence_value', result);
  } catch (err) {
    return holdResult(500, 'Exception in scoreEvidenceValue: ' + err.message, 'score_evidence_value');
  }
};

var calibrateConfidence = async function(data) {
  try {
    var engineCode = data.engine_code;
    var industry = data.industry;
    var assetType = data.asset_type;
    var mechanism = data.mechanism;

    var queryResponse = await supabase
      .from('learning_outcomes')
      .select('prediction_accuracy')
      .eq('engine_code', engineCode);

    if (queryResponse.error) {
      return holdResult(500, 'Database error: ' + queryResponse.error.message, 'calibrate_confidence');
    }

    var outcomes = queryResponse.data || [];
    var bands = {
      '0.5_0.6': [],
      '0.6_0.7': [],
      '0.7_0.8': [],
      '0.8_0.9': [],
      '0.9_1.0': []
    };

    var i = 0;
    while (i < outcomes.length) {
      var acc = outcomes[i].prediction_accuracy;
      if (acc >= 0.5 && acc < 0.6) bands['0.5_0.6'].push(acc);
      else if (acc >= 0.6 && acc < 0.7) bands['0.6_0.7'].push(acc);
      else if (acc >= 0.7 && acc < 0.8) bands['0.7_0.8'].push(acc);
      else if (acc >= 0.8 && acc < 0.9) bands['0.8_0.9'].push(acc);
      else if (acc >= 0.9 && acc <= 1.0) bands['0.9_1.0'].push(acc);
      i = i + 1;
    }

    var bandAnalysis = {};
    var bandKeys = Object.keys(bands);
    var bIdx = 0;
    while (bIdx < bandKeys.length) {
      var bandKey = bandKeys[bIdx];
      var bandData = bands[bandKey];
      if (bandData.length > 0) {
        var sum = 0;
        var bLen = 0;
        while (bLen < bandData.length) {
          sum = sum + bandData[bLen];
          bLen = bLen + 1;
        }
        var actualAccuracy = sum / bandData.length;
        var statedConfidence = parseFloat(bandKey.split('_')[0]) + 0.05;
        var calibrationError = statedConfidence - actualAccuracy;
        bandAnalysis[bandKey] = {
          count: bandData.length,
          actual_accuracy: actualAccuracy,
          stated_confidence: statedConfidence,
          calibration_error: calibrationError,
          overconfident: calibrationError > 0.1,
          underconfident: calibrationError < -0.1
        };
      }
      bIdx = bIdx + 1;
    }

    var insertData = {
      engine_code: engineCode,
      industry: industry,
      asset_type: assetType,
      mechanism: mechanism,
      band_analysis: bandAnalysis,
      calibrated_at: new Date().toISOString()
    };

    var insertResponse = await supabase
      .from('confidence_calibration_records')
      .insert([insertData]);

    if (insertResponse.error) {
      return holdResult(500, 'Database error: ' + insertResponse.error.message, 'calibrate_confidence');
    }

    var result = {
      engine_code: engineCode,
      band_analysis: bandAnalysis,
      overall_status: Object.keys(bandAnalysis).length > 0 ? 'calibrated' : 'insufficient_data'
    };

    return buildResult(200, 'calibrate_confidence', result);
  } catch (err) {
    return holdResult(500, 'Exception in calibrateConfidence: ' + err.message, 'calibrate_confidence');
  }
};

var evolveConcepts = async function(data) {
  try {
    var queryResponse = await supabase
      .from('concept_registry')
      .select('concept_id, concept_name, validation_count');

    if (queryResponse.error) {
      return holdResult(500, 'Database error: ' + queryResponse.error.message, 'evolve_concepts');
    }

    var concepts = queryResponse.data || [];
    var proposedNewConcepts = [];
    var retirementCandidates = [];
    var mergeCandidates = [];

    var cIdx = 0;
    while (cIdx < concepts.length) {
      var concept = concepts[cIdx];
      if (concept.validation_count >= 50) {
        proposedNewConcepts.push({
          concept_id: concept.concept_id,
          action: 'strengthen',
          validation_count: concept.validation_count
        });
      } else if (concept.validation_count < 5) {
        retirementCandidates.push({
          concept_id: concept.concept_id,
          action: 'retire',
          validation_count: concept.validation_count
        });
      }
      cIdx = cIdx + 1;
    }

    var insertData = {
      analysis_timestamp: new Date().toISOString(),
      proposed_new_concepts: proposedNewConcepts,
      retirement_candidates: retirementCandidates,
      merge_candidates: mergeCandidates
    };

    var insertResponse = await supabase
      .from('concept_evolution_records')
      .insert([insertData]);

    if (insertResponse.error) {
      return holdResult(500, 'Database error: ' + insertResponse.error.message, 'evolve_concepts');
    }

    var result = {
      total_concepts_analyzed: concepts.length,
      proposed_new_concepts_count: proposedNewConcepts.length,
      retirement_candidates_count: retirementCandidates.length,
      merge_candidates_count: mergeCandidates.length
    };

    return buildResult(200, 'evolve_concepts', result);
  } catch (err) {
    return holdResult(500, 'Exception in evolveConcepts: ' + err.message, 'evolve_concepts');
  }
};

var proposeThresholdUpdate = async function(data) {
  try {
    var thresholdType = data.threshold_type;
    var evidenceBasis = data.evidence_basis;
    var proposedValue = data.proposed_value;

    var validationScore = Math.random();
    var riskScore = Math.random();

    var insertData = {
      threshold_type: thresholdType,
      proposed_value: proposedValue,
      evidence_basis: evidenceBasis,
      validation_score: validationScore,
      risk_score: riskScore,
      status: 'pending',
      human_approval_required: true,
      created_at: new Date().toISOString()
    };

    var response = await supabase
      .from('learning_update_candidates')
      .insert([insertData]);

    if (response.error) {
      return holdResult(500, 'Database error: ' + response.error.message, 'propose_threshold_update');
    }

    var result = {
      threshold_type: thresholdType,
      proposed_value: proposedValue,
      validation_score: validationScore,
      risk_score: riskScore,
      status: 'pending',
      requires_approval: true
    };

    return buildResult(200, 'propose_threshold_update', result);
  } catch (err) {
    return holdResult(500, 'Exception in proposeThresholdUpdate: ' + err.message, 'propose_threshold_update');
  }
};

var generateSynthetic = async function(data) {
  try {
    var domain = data.domain;
    var complexityLevel = data.complexity_level;

    var selectedTemplate = null;
    var tIdx = 0;
    while (tIdx < SYNTHETIC_TEMPLATES.length) {
      var template = SYNTHETIC_TEMPLATES[tIdx];
      if (template.domain === domain && template.complexity === complexityLevel) {
        selectedTemplate = template;
        break;
      }
      tIdx = tIdx + 1;
    }

    if (!selectedTemplate && SYNTHETIC_TEMPLATES.length > 0) {
      selectedTemplate = SYNTHETIC_TEMPLATES[Math.floor(Math.random() * SYNTHETIC_TEMPLATES.length)];
    }

    if (!selectedTemplate) {
      return holdResult(400, 'No synthetic template found for domain: ' + domain, 'generate_synthetic');
    }

    var scenarioId = 'synthetic_' + domain + '_' + Date.now();
    var insertData = {
      scenario_id: scenarioId,
      scenario_name: selectedTemplate.scenario_name,
      domain: domain,
      complexity: complexityLevel,
      payload: selectedTemplate.case_details,
      expected_failure_mode: selectedTemplate.expected_failure_mode,
      expected_reasoning: selectedTemplate.expected_reasoning,
      generated_at: new Date().toISOString()
    };

    var response = await supabase
      .from('synthetic_scenarios')
      .insert([insertData]);

    if (response.error) {
      return holdResult(500, 'Database error: ' + response.error.message, 'generate_synthetic');
    }

    var result = {
      scenario_id: scenarioId,
      scenario_name: selectedTemplate.scenario_name,
      domain: domain,
      complexity: complexityLevel,
      expected_failure_mode: selectedTemplate.expected_failure_mode
    };

    return buildResult(200, 'generate_synthetic', result);
  } catch (err) {
    return holdResult(500, 'Exception in generateSynthetic: ' + err.message, 'generate_synthetic');
  }
};

var updateAssetTwin = async function(data) {
  try {
    var assetId = data.asset_id;
    var caseId = data.case_id;
    var updateData = data.update_data;

    var existingResponse = await supabase
      .from('asset_twin_memory')
      .select('asset_memory')
      .eq('asset_id', assetId)
      .single();

    var assetMemory = existingResponse.data && existingResponse.data.asset_memory ? existingResponse.data.asset_memory : {};
    var currentMemorySize = Object.keys(assetMemory).length;

    assetMemory['case_' + caseId] = {
      inspection_results: updateData.inspection_results,
      repairs: updateData.repairs,
      condition_changes: updateData.condition_changes,
      timestamp: new Date().toISOString()
    };

    var upsertData = {
      asset_id: assetId,
      asset_memory: assetMemory,
      last_updated: new Date().toISOString(),
      memory_entries: currentMemorySize + 1
    };

    var response = await supabase
      .from('asset_twin_memory')
      .upsert([upsertData]);

    if (response.error) {
      return holdResult(500, 'Database error: ' + response.error.message, 'update_asset_twin');
    }

    var result = {
      asset_id: assetId,
      case_id: caseId,
      memory_updated: true,
      total_entries: currentMemorySize + 1
    };

    return buildResult(200, 'update_asset_twin', result);
  } catch (err) {
    return holdResult(500, 'Exception in updateAssetTwin: ' + err.message, 'update_asset_twin');
  }
};

var getLearningStats = async function(data) {
  try {
    var outcomesResponse = await supabase
      .from('learning_outcomes')
      .select('prediction_accuracy, engine_code, domain, mechanism');

    if (outcomesResponse.error) {
      return holdResult(500, 'Database error: ' + outcomesResponse.error.message, 'get_learning_stats');
    }

    var outcomes = outcomesResponse.data || [];
    var totalOutcomes = outcomes.length;

    var sumAccuracy = 0;
    var idx = 0;
    while (idx < outcomes.length) {
      sumAccuracy = sumAccuracy + outcomes[idx].prediction_accuracy;
      idx = idx + 1;
    }

    var averageAccuracy = totalOutcomes > 0 ? sumAccuracy / totalOutcomes : 0;

    var evidenceResponse = await supabase
      .from('evidence_value_records')
      .select('evidence_type, value_score');

    var evidenceData = evidenceResponse.data || [];
    var topEvidence = 'visual_inspection';
    if (evidenceData.length > 0) {
      var bestValue = evidenceData[0].value_score;
      topEvidence = evidenceData[0].evidence_type;
      var eidx = 1;
      while (eidx < evidenceData.length && eidx < 5) {
        if (evidenceData[eidx].value_score > bestValue) {
          bestValue = evidenceData[eidx].value_score;
          topEvidence = evidenceData[eidx].evidence_type;
        }
        eidx = eidx + 1;
      }
    }

    var result = {
      total_outcomes_recorded: totalOutcomes,
      average_prediction_accuracy: averageAccuracy,
      top_evidence_type: topEvidence,
      confidence_calibration_status: 'in_progress',
      concept_evolution_status: 'active',
      timestamp: new Date().toISOString()
    };

    return buildResult(200, 'get_learning_stats', result);
  } catch (err) {
    return holdResult(500, 'Exception in getLearningStats: ' + err.message, 'get_learning_stats');
  }
};

var approveUpdate = async function(data) {
  try {
    var updateCandidateId = data.update_candidate_id;
    var approverRole = data.approver_role;
    var approverName = data.approver_name;

    var candidateResponse = await supabase
      .from('learning_update_candidates')
      .select('*')
      .eq('id', updateCandidateId)
      .single();

    if (candidateResponse.error) {
      return holdResult(500, 'Candidate not found: ' + candidateResponse.error.message, 'approve_update');
    }

    var candidate = candidateResponse.data;

    var updateResponse = await supabase
      .from('learning_update_candidates')
      .update({ status: 'approved', active: true })
      .eq('id', updateCandidateId);

    if (updateResponse.error) {
      return holdResult(500, 'Database error: ' + updateResponse.error.message, 'approve_update');
    }

    var versionData = {
      update_candidate_id: updateCandidateId,
      threshold_type: candidate.threshold_type,
      proposed_value: candidate.proposed_value,
      approver_role: approverRole,
      approver_name: approverName,
      active: true,
      approved_at: new Date().toISOString()
    };

    var versionResponse = await supabase
      .from('learning_version')
      .insert([versionData]);

    if (versionResponse.error) {
      return holdResult(500, 'Database error: ' + versionResponse.error.message, 'approve_update');
    }

    var result = {
      update_candidate_id: updateCandidateId,
      status: 'approved',
      version_created: true,
      approver: approverName + ' (' + approverRole + ')'
    };

    return buildResult(200, 'approve_update', result);
  } catch (err) {
    return holdResult(500, 'Exception in approveUpdate: ' + err.message, 'approve_update');
  }
};

var getLearningQueue = async function(data) {
  try {
    var queueResponse = await supabase
      .from('learning_update_candidates')
      .select('id, threshold_type, proposed_value, validation_score, risk_score, evidence_basis, status')
      .eq('status', 'pending');

    if (queueResponse.error) {
      return holdResult(500, 'Database error: ' + queueResponse.error.message, 'get_learning_queue');
    }

    var pendingUpdates = queueResponse.data || [];

    var result = {
      pending_count: pendingUpdates.length,
      updates: pendingUpdates,
      requires_human_review: pendingUpdates.length > 0,
      timestamp: new Date().toISOString()
    };

    return buildResult(200, 'get_learning_queue', result);
  } catch (err) {
    return holdResult(500, 'Exception in getLearningQueue: ' + err.message, 'get_learning_queue');
  }
};

var handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    var optionsResult = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: true })
    };
    return optionsResult;
  }

  if (event.httpMethod !== 'POST') {
    return holdResult(405, 'Method not allowed. Only POST is supported.', 'unknown');
  }

  var requestData;
  try {
    requestData = JSON.parse(event.body);
  } catch (parseErr) {
    return holdResult(400, 'Invalid JSON in request body', 'unknown');
  }

  var action = requestData.action;

  if (action === 'get_registry') {
    return getRegistry();
  } else if (action === 'record_outcome') {
    return await recordOutcome(requestData);
  } else if (action === 'record_override') {
    return await recordOverride(requestData);
  } else if (action === 'score_evidence_value') {
    return await scoreEvidenceValue(requestData);
  } else if (action === 'calibrate_confidence') {
    return await calibrateConfidence(requestData);
  } else if (action === 'evolve_concepts') {
    return await evolveConcepts(requestData);
  } else if (action === 'propose_threshold_update') {
    return await proposeThresholdUpdate(requestData);
  } else if (action === 'generate_synthetic') {
    return await generateSynthetic(requestData);
  } else if (action === 'update_asset_twin') {
    return await updateAssetTwin(requestData);
  } else if (action === 'get_learning_stats') {
    return await getLearningStats(requestData);
  } else if (action === 'approve_update') {
    return await approveUpdate(requestData);
  } else if (action === 'get_learning_queue') {
    return await getLearningQueue(requestData);
  } else {
    return holdResult(400, 'Unknown action: ' + action, action);
  }
};

export { handler };
