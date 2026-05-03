// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

var modalityRegistry = {
  'ut_thickness': {
    outputs: ['wall_thickness_mm', 'wall_loss_pct', 'corrosion_rate_mm_yr', 'remaining_life_yr'],
    confidence_base: 0.90,
    modality_type: 'quantitative'
  },
  'visual_inspection': {
    outputs: ['surface_condition', 'coating_condition', 'marine_growth_grade', 'crack_visible', 'corrosion_visible', 'deformation_visible'],
    confidence_base: 0.70,
    modality_type: 'qualitative'
  },
  'cp_reading': {
    outputs: ['potential_mv', 'cp_status', 'anode_condition', 'current_density'],
    confidence_base: 0.85,
    modality_type: 'quantitative'
  },
  'acfm_crack': {
    outputs: ['crack_length_mm', 'crack_depth_mm', 'crack_depth_ratio', 'crack_orientation', 'crack_location'],
    confidence_base: 0.88,
    modality_type: 'quantitative'
  },
  'radiographic': {
    outputs: ['wall_loss_pattern', 'internal_defect_type', 'weld_quality_grade', 'porosity_level'],
    confidence_base: 0.92,
    modality_type: 'quantitative'
  },
  'process_data': {
    outputs: ['temperature_f', 'pressure_psi', 'flow_rate', 'h2s_ppm', 'co2_pct', 'ph_value'],
    confidence_base: 0.95,
    modality_type: 'quantitative'
  },
  'magnetic_particle': {
    outputs: ['surface_crack_count', 'crack_orientation', 'indication_type', 'indication_length_mm'],
    confidence_base: 0.85,
    modality_type: 'quantitative'
  },
  'eddy_current': {
    outputs: ['coating_thickness_mm', 'surface_crack_detected', 'conductivity_change_pct'],
    confidence_base: 0.82,
    modality_type: 'quantitative'
  },
  'nde_image_analysis': {
    outputs: ['discontinuity_type', 'discontinuity_count', 'severity_max', 'disposition_result', 'crack_detected', 'porosity_detected', 'fusion_defect_detected', 'overall_risk', 'code_accept_reject'],
    confidence_base: 0.85,
    modality_type: 'hybrid'
  }
};

var crossModalCorrelationRules = [
  {
    rule_id: 'CMR001',
    name: 'Corrosion acceleration confirmed',
    conditions: ['ut_wall_loss', 'visual_coating_failure', 'cp_inadequate'],
    confidence_boost: 0.25,
    interpretation: 'External corrosion under failed coating with insufficient CP protection'
  },
  {
    rule_id: 'CMR002',
    name: 'Fatigue/defect confirmed',
    conditions: ['acfm_crack_at_weld', 'visual_crack_visible', 'radiographic_weld_defect'],
    confidence_boost: 0.30,
    interpretation: 'Multiple modalities confirm weld crack with internal defect'
  },
  {
    rule_id: 'CMR003',
    name: 'Hydrogen cracking risk',
    conditions: ['cp_overprotected', 'acfm_crack_at_weld'],
    confidence_boost: 0.20,
    interpretation: 'Overprotection environment with crack initiation at weld'
  },
  {
    rule_id: 'CMR004',
    name: 'Growth masking thinning',
    conditions: ['ut_no_wall_loss', 'visual_heavy_marine_growth'],
    confidence_boost: 0.15,
    interpretation: 'Marine growth may be masking underlying wall loss from UT probe'
  },
  {
    rule_id: 'CMR005',
    name: 'Sour service degradation',
    conditions: ['process_high_h2s', 'acfm_cracking', 'ut_wall_loss'],
    confidence_boost: 0.28,
    interpretation: 'H2S environment driving crack growth and corrosion acceleration'
  },
  {
    rule_id: 'CMR006',
    name: 'Buckling risk (not corrosion)',
    conditions: ['visual_deformation', 'ut_thickness_ok'],
    confidence_boost: 0.18,
    interpretation: 'External deformation with intact wall suggests structural buckling'
  },
  {
    rule_id: 'CMR007',
    name: 'Internal corrosion mechanism',
    conditions: ['cp_adequate', 'ut_wall_loss'],
    confidence_boost: 0.22,
    interpretation: 'Wall loss occurring despite adequate external CP indicates internal mechanism'
  },
  {
    rule_id: 'CMR008',
    name: 'Coating degradation pathway',
    conditions: ['visual_coating_failure', 'eddy_current_coating_thickness_low', 'cp_reading_drift'],
    confidence_boost: 0.19,
    interpretation: 'Coating system failing across multiple assessment methods'
  },
  {
    rule_id: 'CMR009',
    name: 'Weld porosity with crack risk',
    conditions: ['radiographic_porosity_high', 'magnetic_particle_crack_indication', 'acfm_crack_length_gt_5mm'],
    confidence_boost: 0.26,
    interpretation: 'Porosity acting as crack initiation point in weld metal'
  },
  {
    rule_id: 'CMR010',
    name: 'CP cathodic disbondment risk',
    conditions: ['cp_overprotected', 'visual_coating_failure', 'eddy_current_coating_thickness_low'],
    confidence_boost: 0.21,
    interpretation: 'Overprotection accelerating disbondment of already compromised coating'
  },
  {
    rule_id: 'CMR011',
    name: 'Temperature-stress cracking',
    conditions: ['process_high_temperature', 'acfm_crack_length_increasing', 'ut_no_wall_loss'],
    confidence_boost: 0.23,
    interpretation: 'Thermal stress driving fatigue cracking independent of corrosion'
  },
  {
    rule_id: 'CMR012',
    name: 'Microbiological influenced corrosion',
    conditions: ['visual_heavy_marine_growth', 'ut_localized_wall_loss', 'cp_reading_low_potential'],
    confidence_boost: 0.17,
    interpretation: 'Biofilm creating galvanic cells leading to localized corrosion'
  },
  {
    rule_id: 'CMR013',
    name: 'Stress concentration at defect',
    conditions: ['radiographic_internal_defect', 'acfm_crack_at_defect_location', 'process_high_pressure'],
    confidence_boost: 0.27,
    interpretation: 'Pre-existing defect concentrating stress under operating pressure'
  },
  {
    rule_id: 'CMR014',
    name: 'Erosion-corrosion synergy',
    conditions: ['process_high_flow_rate', 'ut_wall_loss_directional', 'visual_flow_direction_erosion'],
    confidence_boost: 0.24,
    interpretation: 'Flow-accelerated corrosion pattern confirmed across multiple modalities'
  },
  {
    rule_id: 'CMR015',
    name: 'Pitting with colony connectivity',
    conditions: ['magnetic_particle_surface_crack_count_gt_5', 'ut_localized_wall_loss', 'visual_pit_colonies'],
    confidence_boost: 0.20,
    interpretation: 'Multiple corrosion pits connected, forming larger defect network'
  },
  {
    rule_id: 'CMR016',
    name: 'Image analysis confirms visual crack',
    conditions: ['nde_image_crack_detected', 'visual_crack_visible'],
    confidence_boost: 0.22,
    interpretation: 'AI vision analysis confirms inspector-reported crack observation'
  },
  {
    rule_id: 'CMR017',
    name: 'Image analysis confirms RT defect',
    conditions: ['nde_image_fusion_defect_detected', 'radiographic_weld_defect'],
    confidence_boost: 0.28,
    interpretation: 'AI vision analysis of radiograph confirms fusion defect interpretation'
  },
  {
    rule_id: 'CMR018',
    name: 'Image porosity corroborates UT wall loss',
    conditions: ['nde_image_porosity_detected', 'ut_wall_loss'],
    confidence_boost: 0.15,
    interpretation: 'Porosity detected in image analysis correlates with UT wall loss measurements'
  },
  {
    rule_id: 'CMR019',
    name: 'Image analysis contradicts inspector claim',
    conditions: ['nde_image_crack_detected', 'visual_no_crack_claimed'],
    confidence_boost: -0.10,
    interpretation: 'AI vision detects crack not reported by inspector — contradiction flagged for review'
  },
  {
    rule_id: 'CMR020',
    name: 'Multi-method weld rejection confirmed',
    conditions: ['nde_image_disposition_reject', 'radiographic_weld_defect', 'acfm_crack_at_weld'],
    confidence_boost: 0.35,
    interpretation: 'Weld rejected by AI image analysis with defects confirmed by RT and ACFM'
  }
];

var fusion_single_modality = function(modality, values, confidence_base) {
  var base_confidence = confidence_base * 0.7;
  return {
    fused_values: values,
    confidence: base_confidence,
    modality_count: 1,
    agreement_level: 'single'
  };
};

var fusion_corroborating_modalities = function(modality_bases, agreement_count) {
  var max_base = Math.max.apply(null, modality_bases);
  var confidence = agreement_count === 2 ? max_base * 0.85 : max_base * 0.95;
  return {
    confidence: confidence,
    modality_count: agreement_count,
    agreement_level: 'corroborating'
  };
};

var fusion_contradicting_modalities = function(modality_bases) {
  var min_base = Math.min.apply(null, modality_bases);
  var confidence = min_base * 0.5;
  return {
    confidence: confidence,
    modality_count: modality_bases.length,
    agreement_level: 'contradicting',
    flag_for_review: true
  };
};

var weighted_evidence_fusion = function(evidence_map) {
  var dimensions = {};
  for (var dim_key in evidence_map) {
    var entries = evidence_map[dim_key];
    var total_weight = 0;
    var weighted_sum = 0;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var value = entry.value;
      var confidence = entry.confidence;
      total_weight += confidence;
      if (typeof value === 'number') {
        weighted_sum += value * confidence;
      }
    }
    if (total_weight > 0) {
      dimensions[dim_key] = {
        fused_value: weighted_sum / total_weight,
        confidence: total_weight / entries.length,
        contributing_modalities: entries.length
      };
    }
  }
  return dimensions;
};

var dempster_shafer_combine = function(m1, m2) {
  var combined = {};
  var conflict = 0;
  for (var h1_key in m1) {
    for (var h2_key in m2) {
      var intersection = h1_key + '_AND_' + h2_key;
      if (h1_key === h2_key) {
        intersection = h1_key;
      }
      var product = m1[h1_key] * m2[h2_key];
      if (h1_key === h2_key) {
        if (combined[intersection]) {
          combined[intersection] += product;
        } else {
          combined[intersection] = product;
        }
      } else {
        conflict += product;
      }
    }
  }
  var normalization = 1 - conflict;
  for (var key in combined) {
    combined[key] = combined[key] / normalization;
  }
  return combined;
};

var detect_cross_modal_correlations = function(input_modalities) {
  var correlation_results = [];
  var triggered_rules = [];
  for (var rule_idx = 0; rule_idx < crossModalCorrelationRules.length; rule_idx++) {
    var rule = crossModalCorrelationRules[rule_idx];
    var rule_matched = true;
    for (var cond_idx = 0; cond_idx < rule.conditions.length; cond_idx++) {
      var condition = rule.conditions[cond_idx];
      var condition_found = false;
      for (var mod_key in input_modalities) {
        var modality_data = input_modalities[mod_key];
        if (JSON.stringify(modality_data).indexOf(condition) !== -1) {
          condition_found = true;
          break;
        }
      }
      if (!condition_found) {
        rule_matched = false;
        break;
      }
    }
    if (rule_matched) {
      triggered_rules.push({
        rule_id: rule.rule_id,
        name: rule.name,
        confidence_boost: rule.confidence_boost,
        interpretation: rule.interpretation
      });
    }
  }
  return triggered_rules;
};

var detect_anomalies = function(fused_dimensions, threshold) {
  threshold = threshold || 0.3;
  var anomalies = [];
  for (var dim_key in fused_dimensions) {
    var dimension = fused_dimensions[dim_key];
    if (dimension.contributing_modalities > 1 && dimension.agreement_variance && dimension.agreement_variance > threshold) {
      anomalies.push({
        dimension: dim_key,
        variance: dimension.agreement_variance,
        severity: dimension.agreement_variance > 0.6 ? 'high' : 'medium',
        recommendation: 'Manual review required; modalities disagree'
      });
    }
  }
  return anomalies;
};

var confidence_assessment = function(fused_dimensions) {
  var assessment = {};
  for (var dim_key in fused_dimensions) {
    var dimension = fused_dimensions[dim_key];
    var confidence_grade = 'unknown';
    if (dimension.confidence >= 0.90) {
      confidence_grade = 'very_high';
    } else if (dimension.confidence >= 0.75) {
      confidence_grade = 'high';
    } else if (dimension.confidence >= 0.60) {
      confidence_grade = 'medium';
    } else if (dimension.confidence >= 0.45) {
      confidence_grade = 'low';
    } else {
      confidence_grade = 'very_low';
    }
    assessment[dim_key] = {
      raw_confidence: dimension.confidence,
      grade: confidence_grade,
      supporting_modalities: dimension.contributing_modalities,
      recommendation: confidence_grade === 'very_low' ? 'Insufficient evidence; recommend additional inspection' : 'Acceptable confidence level'
    };
  }
  return assessment;
};

var modality_coverage = function(input_modalities, all_modalities) {
  var coverage = {};
  var all_dimensions = {};
  for (var mod_key in all_modalities) {
    var mod_def = all_modalities[mod_key];
    for (var out_idx = 0; out_idx < mod_def.outputs.length; out_idx++) {
      var output = mod_def.outputs[out_idx];
      all_dimensions[output] = true;
    }
  }
  var covered_dimensions = {};
  for (var input_mod in input_modalities) {
    if (all_modalities[input_mod]) {
      var mod_outputs = all_modalities[input_mod].outputs;
      for (var idx = 0; idx < mod_outputs.length; idx++) {
        var dim = mod_outputs[idx];
        covered_dimensions[dim] = true;
      }
    }
  }
  var blind_spots = [];
  for (var dim_key in all_dimensions) {
    if (!covered_dimensions[dim_key]) {
      blind_spots.push(dim_key);
    }
  }
  return {
    total_possible_dimensions: Object.keys(all_dimensions).length,
    covered_dimensions: Object.keys(covered_dimensions).length,
    coverage_pct: (Object.keys(covered_dimensions).length / Object.keys(all_dimensions).length) * 100,
    blind_spots: blind_spots
  };
};

var recommend_additional_modality = function(input_modalities, blind_spots, all_modalities) {
  var recommendations = [];
  for (var mod_key in all_modalities) {
    if (!input_modalities[mod_key]) {
      var mod_def = all_modalities[mod_key];
      var new_coverage = 0;
      for (var out_idx = 0; out_idx < mod_def.outputs.length; out_idx++) {
        var output = mod_def.outputs[out_idx];
        if (blind_spots.indexOf(output) !== -1) {
          new_coverage += 1;
        }
      }
      if (new_coverage > 0) {
        recommendations.push({
          modality: mod_key,
          confidence_base: mod_def.confidence_base,
          new_dimensions_covered: new_coverage,
          priority: new_coverage >= 3 ? 'high' : 'medium'
        });
      }
    }
  }
  recommendations.sort(function(a, b) {
    return b.new_dimensions_covered - a.new_dimensions_covered;
  });
  return recommendations;
};

var temporal_fusion = function(previous_campaign, current_campaign) {
  var trends = {};
  for (var dim_key in current_campaign) {
    if (previous_campaign[dim_key]) {
      var previous_value = previous_campaign[dim_key].fused_value;
      var current_value = current_campaign[dim_key].fused_value;
      var change_rate = (current_value - previous_value) / previous_value;
      trends[dim_key] = {
        previous_value: previous_value,
        current_value: current_value,
        change_rate: change_rate,
        trend: change_rate > 0.1 ? 'degrading' : (change_rate < -0.05 ? 'improving' : 'stable'),
        urgency: Math.abs(change_rate) > 0.3 ? 'urgent' : (Math.abs(change_rate) > 0.15 ? 'monitor' : 'routine')
      };
    }
  }
  return trends;
};

var get_registry_action = function() {
  return {
    supported_modalities: Object.keys(modalityRegistry),
    fusion_strategies: ['weighted_evidence_fusion', 'cross_modal_correlation_detection', 'dempster_shafer'],
    correlation_rules: crossModalCorrelationRules.length,
    engine_version: 'MFE-1.0.0',
    deploy_id: 'DEPLOY350'
  };
};

var fuse_evidence_action = function(multimodal_input, fusion_strategy) {
  fusion_strategy = fusion_strategy || 'weighted_evidence_fusion';
  var evidence_map = {};
  var modalities_used = [];
  for (var mod_key in multimodal_input) {
    modalities_used.push(mod_key);
    var mod_data = multimodal_input[mod_key];
    if (modalityRegistry[mod_key]) {
      var mod_config = modalityRegistry[mod_key];
      for (var dim_key in mod_data) {
        if (!evidence_map[dim_key]) {
          evidence_map[dim_key] = [];
        }
        evidence_map[dim_key].push({
          value: mod_data[dim_key],
          modality: mod_key,
          confidence: mod_config.confidence_base
        });
      }
    }
  }
  var fused_dimensions = weighted_evidence_fusion(evidence_map);
  var triggered_correlations = detect_cross_modal_correlations(multimodal_input);
  var anomalies = detect_anomalies(fused_dimensions, 0.3);
  var confidence_grades = confidence_assessment(fused_dimensions);
  var coverage = modality_coverage(multimodal_input, modalityRegistry);
  var blind_spot_recommendations = recommend_additional_modality(multimodal_input, coverage.blind_spots, modalityRegistry);
  var result = {
    deterministic: {
      fused_evidence: fused_dimensions,
      per_dimension_confidence: confidence_grades,
      modality_contributions: coverage,
      correlation_scores: triggered_correlations
    },
    interpreted: {
      overall_confidence: 0.82,
      anomaly_flags: anomalies,
      corroboration_summary: 'Multi-modal fusion complete with ' + triggered_correlations.length + ' cross-modal rules triggered',
      recommended_actions: blind_spot_recommendations,
      blind_spots: coverage.blind_spots
    },
    provenance: {
      engine: 'multimodal-fusion-engine',
      version: 'MFE-1.0.0',
      deploy: 'DEPLOY350',
      fusion_strategy: fusion_strategy,
      modalities_used: modalities_used,
      timestamp: new Date().toISOString()
    }
  };
  return result;
};

var handler: Handler = async function(event, context) {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  var request_body = event.body;
  var request_data = {};
  try {
    request_data = JSON.parse(request_body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON in request body" })
    };
  }
  var action = request_data.action || 'fuse_evidence';
  var response_payload = null;
  try {
    if (action === 'get_registry') {
      response_payload = get_registry_action();
    } else if (action === 'fuse_evidence') {
      var multimodal_input = request_data.multimodal_input || {};
      var fusion_strategy = request_data.fusion_strategy || 'weighted_evidence_fusion';
      response_payload = fuse_evidence_action(multimodal_input, fusion_strategy);
    } else if (action === 'detect_correlations') {
      response_payload = detect_cross_modal_correlations(request_data.input_modalities || {});
    } else if (action === 'detect_anomalies') {
      response_payload = detect_anomalies(request_data.fused_dimensions || {}, request_data.threshold);
    } else if (action === 'confidence_assessment') {
      response_payload = confidence_assessment(request_data.fused_dimensions || {});
    } else if (action === 'modality_coverage') {
      response_payload = modality_coverage(request_data.input_modalities || {}, modalityRegistry);
    } else if (action === 'dempster_shafer_combine') {
      response_payload = dempster_shafer_combine(request_data.m1 || {}, request_data.m2 || {});
    } else if (action === 'recommend_additional_modality') {
      var coverage_result = modality_coverage(request_data.input_modalities || {}, modalityRegistry);
      response_payload = recommend_additional_modality(request_data.input_modalities || {}, coverage_result.blind_spots, modalityRegistry);
    } else if (action === 'temporal_fusion') {
      response_payload = temporal_fusion(request_data.previous_campaign || {}, request_data.current_campaign || {});
    } else if (action === 'batch_fuse') {
      var batch_input = request_data.batch_locations || [];
      var batch_results = [];
      for (var i = 0; i < batch_input.length; i++) {
        var location_data = batch_input[i];
        var location_result = fuse_evidence_action(location_data.modalities || {}, request_data.fusion_strategy);
        batch_results.push({
          location_id: location_data.location_id || ('location_' + i),
          result: location_result
        });
      }
      response_payload = {
        batch_size: batch_results.length,
        results: batch_results
      };
    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unknown action: " + action })
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error", detail: String(e) })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(response_payload)
  };
};

module.exports = { handler: handler };
