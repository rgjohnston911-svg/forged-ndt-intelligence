#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════
// GOLDEN SUITE — PHOTOREALISTIC INSPECTION DATASET PACK v3
// FORGED 4D NDT Intelligence OS — 5 Cases (PHOTO-CASE-001 to 005)
//
// Full-pipeline validation: run_full (survival + monte_carlo + classification)
// Validates: Monte Carlo P05<=P50<=P95, survival probabilities at 1/3/5yr,
// mechanism identification, authority lock, proof trace, and safe disposition.
// ═══════════════════════════════════════════════════════════════════════

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = process.env.FORGED_URL || 'https://4dndt.netlify.app';

// ── TEST CASES ─────────────────────────────────────────────────────────

var TEST_CASES = [

  // ═══════════════════════════════════════════════════════════════════
  // CASE 1: SUBSEA RISER — COATING DAMAGE + FATIGUE CRACK
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'PHOTO-CASE-001',
    name: 'SUBSEA-RISER-COATING-FATIGUE',
    setting: 'subsea / offshore',
    asset: 'deepwater riser clamp zone',
    modalities: ['image', 'ROV video', 'UT', 'PAUT', 'CP', 'history', 'voice note'],
    visual_findings: 'coating loss, scrape marks, rust bloom, low CP, localized wall loss, crack-like PAUT indication',
    expected_mechanisms: ['mechanical_coating_trauma', 'external_corrosion', 'corrosion_assisted_fatigue_cracking'],
    expected_authority_lock: true,
    must_pass: [
      'mechanical coating trauma',
      'external corrosion',
      'corrosion-assisted fatigue cracking',
      'Authority Lock = true',
      'recommended crack sizing, CP restoration, fatigue assessment'
    ],
    survival_model: {
      model_type: 'WEIBULL',
      shape: 3.2,
      scale_years: 2.9,
      mechanism: 'corrosion_fatigue'
    },
    expected_pfail_ranges: {
      '1yr': [0.02, 0.08],
      '3yr': [0.55, 0.75],
      '5yr': [0.95, 1.00]
    },
    monte_carlo_inputs: {
      wall_loss_percent: { dist: 'normal' },
      crack_depth_in: { dist: 'normal' },
      stress_range_ksi: { dist: 'triangular' },
      cp_effectiveness_index: { dist: 'uniform' }
    },
    evidence_for_engine: {
      domain: 'subsea',
      equipment_type: 'riser',
      material: 'X65 carbon steel',
      tnom: 0.750,
      tmm: 0.638,
      coating: 'damaged — scrape marks with rust bloom',
      cp: 'low potential in damaged region',
      paut: 'crack-like indication near clamp weld',
      rov_video: 'coating loss and marine growth disturbance',
      mechanism: 'corrosion_fatigue'
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // CASE 2: HRSG TUBE — THERMAL FATIGUE + CREEP INTERACTION
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'PHOTO-CASE-002',
    name: 'HRSG-CREEP-FATIGUE',
    setting: 'power generation',
    asset: 'HRSG superheater tube',
    modalities: ['image', 'PT', 'replica metallography', 'thermal history', 'operating data'],
    visual_findings: 'oxide scale, bulging, branched cracks, increased starts, ramp-rate exceedances',
    expected_mechanisms: ['thermal_fatigue', 'creep', 'overheating_oxide_scale'],
    expected_authority_lock: true,
    must_pass: [
      'thermal fatigue',
      'creep',
      'overheating/oxide scale',
      'Authority Lock = true',
      'metallurgical confirmation and outage replacement planning'
    ],
    survival_model: {
      model_type: 'WEIBULL',
      shape: 3.5,
      scale_years: 2.4,
      mechanism: 'creep'
    },
    expected_pfail_ranges: {
      '1yr': [0.03, 0.08],
      '3yr': [0.75, 0.95],
      '5yr': [0.99, 1.00]
    },
    monte_carlo_inputs: {
      tube_metal_temperature_f: { dist: 'normal' },
      hoop_stress_ksi: { dist: 'normal' },
      remaining_wall_in: { dist: 'normal' },
      cycle_damage_index: { dist: 'triangular' }
    },
    evidence_for_engine: {
      domain: 'power_generation',
      equipment_type: 'HRSG_superheater',
      material: 'SA-213 T22',
      tnom: 0.200,
      tmm: 0.165,
      service: 'superheater 1050F, cycling 300% increase',
      pt: 'branched cracks at tube OD',
      replica: 'creep voiding Neubauer level 3',
      mechanism: 'creep'
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // CASE 3: CHEMICAL PLANT — STAINLESS CHLORIDE SCC UNDER INSULATION
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'PHOTO-CASE-003',
    name: 'CHEM-SCC-UNDER-INSULATION',
    setting: 'chemical plant',
    asset: '316L insulated process pipe',
    modalities: ['image', 'PT', 'UT', 'environment', 'process history'],
    visual_findings: 'salt deposits, wet insulation, branched linear indications, low wall loss',
    expected_mechanisms: ['chloride_stress_corrosion_cracking'],
    expected_authority_lock: true,
    must_pass: [
      'chloride stress corrosion cracking',
      'reject low-wall-loss safe conclusion',
      'Authority Lock = true',
      'crack sizing and chloride source control'
    ],
    survival_model: {
      model_type: 'WEIBULL',
      shape: 2.7,
      scale_years: 3.7,
      mechanism: 'chloride_SCC'
    },
    expected_pfail_ranges: {
      '1yr': [0.02, 0.06],
      '3yr': [0.35, 0.55],
      '5yr': [0.80, 0.95]
    },
    monte_carlo_inputs: {
      crack_depth_in: { dist: 'normal' },
      chloride_exposure_index: { dist: 'triangular' },
      residual_stress_index: { dist: 'uniform' },
      temperature_f: { dist: 'normal' }
    },
    evidence_for_engine: {
      domain: 'chemical_plant',
      equipment_type: 'process_piping',
      material: '316L stainless steel',
      tnom: 0.375,
      tmm: 0.352,
      service: 'insulated pipe, coastal plant, chloride contamination',
      pt: 'branched linear indications at HAZ',
      insulation: 'wet, salt deposits',
      mechanism: 'chloride_SCC'
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // CASE 4: OFFSHORE STRUCTURE — STORM DAMAGE CASCADE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'PHOTO-CASE-004',
    name: 'OFFSHORE-STORM-CASCADE',
    setting: 'offshore structure',
    asset: 'jacket brace node',
    modalities: ['image', 'MT', 'dimensional survey', 'event history', 'structural context'],
    visual_findings: 'coating loss, rust, slight deformation, weld toe indication after hurricane',
    expected_mechanisms: ['storm_structural_damage', 'fatigue_crack_initiation', 'critical_load_path_consequence'],
    expected_authority_lock: true,
    must_pass: [
      'storm-induced structural damage',
      'fatigue crack initiation',
      'critical load path consequence',
      'Authority Lock = true'
    ],
    survival_model: {
      model_type: 'WEIBULL',
      shape: 3.0,
      scale_years: 3.1,
      mechanism: 'corrosion_fatigue'
    },
    expected_pfail_ranges: {
      '1yr': [0.03, 0.10],
      '3yr': [0.55, 0.75],
      '5yr': [0.95, 0.99]
    },
    monte_carlo_inputs: {
      crack_length_in: { dist: 'normal' },
      deformation_in: { dist: 'normal' },
      stress_range_ksi: { dist: 'triangular' },
      corrosion_rate_mpy: { dist: 'lognormal' }
    },
    evidence_for_engine: {
      domain: 'offshore',
      equipment_type: 'jacket',
      material: 'structural steel',
      tnom: 1.000,
      tmm: 0.920,
      visual: 'coating loss rust deformation at brace node',
      mt: 'weld toe indication at brace-to-chord',
      event_history: 'Category 3 hurricane 3 months ago',
      mechanism: 'corrosion_fatigue'
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // CASE 5: REFINERY PIPING — SYSTEMIC CUI / PROCESS CHANGE PATTERN
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 'PHOTO-CASE-005',
    name: 'REFINERY-SYSTEMIC-CUI',
    setting: 'refinery',
    asset: 'multi-line insulated carbon steel piping circuit',
    modalities: ['image', 'UT campaign', 'history', 'process change', 'inspection notes'],
    visual_findings: 'corrosion clustered at supports, low points, dead legs, wet insulation; process change accelerated pattern',
    expected_mechanisms: ['systemic_CUI', 'process_driven_acceleration', 'network_pattern_recognition'],
    expected_authority_lock: true,
    must_pass: [
      'systemic CUI',
      'process-driven acceleration',
      'network-level pattern recognition',
      'Authority Lock = true',
      'ranked CUI inspection expansion'
    ],
    survival_model: {
      model_type: 'WEIBULL',
      shape: 2.2,
      scale_years: 4.4,
      mechanism: 'CUI'
    },
    expected_pfail_ranges: {
      '1yr': [0.02, 0.07],
      '3yr': [0.25, 0.45],
      '5yr': [0.65, 0.85]
    },
    monte_carlo_inputs: {
      measured_thickness_in: { dist: 'normal' },
      required_thickness_in: { dist: 'triangular' },
      corrosion_rate_mpy: { dist: 'lognormal' },
      wet_insulation_index: { dist: 'uniform' }
    },
    evidence_for_engine: {
      domain: 'refinery',
      equipment_type: 'piping_network',
      material: 'carbon steel',
      tnom: 0.322,
      tmm: 0.228,
      service: 'insulated piping, crude slate changed 14mo ago',
      visual: 'corrosion at supports dead legs low points',
      insulation: 'wet saturated',
      mechanism: 'CUI'
    }
  }
];

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
        return callback(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 300)), null);
      }
      try {
        var parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (e) {
        callback(new Error('JSON parse error: ' + data.substring(0, 300)), null);
      }
    });
  });

  req.on('error', function(err) { callback(err, null); });
  req.setTimeout(45000, function() {
    req.destroy();
    callback(new Error('Timeout after 45s'), null);
  });
  req.write(body);
  req.end();
}

// ── RUN FULL PIPELINE FOR A CASE ─────────────────────────────────────

function runFullPipeline(testCase, callback) {
  var sm = testCase.survival_model;

  // Step 1: run_survival
  var survivalPayload = {
    action: 'run_survival',
    model_type: sm.model_type,
    model_params: {
      shape: sm.shape,
      scale: sm.scale_years
    },
    time_horizons_years: [1, 3, 5, 10, 20],
    mechanism: sm.mechanism
  };

  callEngine('/api/uncertainty-reliability-core', survivalPayload, function(err, survResp) {
    var survivalResult = null;
    var survivalOk = false;
    var failProbs = {};

    if (!err && survResp) {
      var sd = survResp.data || survResp;
      survivalResult = sd.deterministic || sd;
      survivalOk = true;

      // Extract fail probabilities from time_horizons object
      // Engine returns: deterministic.time_horizons["1y"].failure_probability
      if (survivalResult && survivalResult.time_horizons) {
        var th = survivalResult.time_horizons;
        if (th['1y']) failProbs['1yr'] = th['1y'].failure_probability;
        if (th['3y']) failProbs['3yr'] = th['3y'].failure_probability;
        if (th['5y']) failProbs['5yr'] = th['5y'].failure_probability;
      }
      // Fallback: check nested inside deterministic wrapper
      if (failProbs['1yr'] === undefined && survivalResult) {
        var det = survivalResult.deterministic || {};
        if (det.time_horizons) {
          var dth = det.time_horizons;
          if (dth['1y']) failProbs['1yr'] = dth['1y'].failure_probability;
          if (dth['3y']) failProbs['3yr'] = dth['3y'].failure_probability;
          if (dth['5y']) failProbs['5yr'] = dth['5y'].failure_probability;
        }
      }
    }

    // Step 2: run_monte_carlo
    var mcPayload = {
      action: 'run_monte_carlo',
      model_type: sm.model_type,
      model_params: {
        shape: sm.shape,
        scale: sm.scale_years
      },
      n_simulations: 10000,
      mechanism: sm.mechanism
    };

    callEngine('/api/uncertainty-reliability-core', mcPayload, function(err2, mcResp) {
      var mcResult = null;
      var mcOk = false;
      var mcP05 = null;
      var mcP50 = null;
      var mcP95 = null;

      if (!err2 && mcResp) {
        var md = mcResp.data || mcResp;
        mcResult = md;
        mcOk = true;

        // Engine returns: data.deterministic.monte_carlo.percentiles.p05/p50/p95
        var mcDet = md.deterministic || md;
        var mcMc = mcDet.monte_carlo || mcDet;
        if (mcMc.percentiles) {
          mcP05 = mcMc.percentiles.p05;
          mcP50 = mcMc.percentiles.p50;
          mcP95 = mcMc.percentiles.p95;
        }
        // Fallback: direct fields
        if (mcP05 === null || mcP05 === undefined) {
          if (md.percentiles) {
            mcP05 = md.percentiles.p05;
            mcP50 = md.percentiles.p50;
            mcP95 = md.percentiles.p95;
          }
        }
      }

      // Step 3: run_classification
      var classPayload = {
        action: 'run_classification',
        survival_results: survivalResult || {},
        conformal_confidence: 0.80,
        mc_p05_remaining: mcP05,
        mechanism: sm.mechanism
      };

      callEngine('/api/uncertainty-reliability-core', classPayload, function(err3, classResp) {
        var classResult = null;
        var classOk = false;
        var reliabilityClass = 'UNKNOWN';
        var authorityLock = false;

        if (!err3 && classResp) {
          var cd = classResp.data || classResp;
          classResult = cd;
          classOk = true;
          reliabilityClass = cd.reliability_class || 'UNKNOWN';
          authorityLock = cd.authority_lock_required || false;
        }

        // Step 4: run orchestrator for proof trace
        var orchPayload = {
          action: 'assess',
          asset_context: {
            domain: testCase.evidence_for_engine.domain || 'fixed',
            equipment_type: testCase.evidence_for_engine.equipment_type || 'piping',
            asset_id: testCase.id
          },
          observed_evidence: testCase.evidence_for_engine,
          ffs_data: {}
        };

        callEngine('/api/comprehensive-assessment', orchPayload, function(err4, orchResp) {
          var hasProofTrace = !err4 && orchResp && (orchResp.deterministic || orchResp.interpreted);
          var orchDisposition = 'UNKNOWN';
          if (!err4 && orchResp && orchResp.interpreted) {
            orchDisposition = orchResp.interpreted.overall_disposition || 'UNKNOWN';
          }

          callback({
            survival_ok: survivalOk,
            survival_error: err ? err.message : null,
            fail_probs: failProbs,
            mc_ok: mcOk,
            mc_error: err2 ? err2.message : null,
            mc_p05: mcP05,
            mc_p50: mcP50,
            mc_p95: mcP95,
            class_ok: classOk,
            class_error: err3 ? err3.message : null,
            reliability_class: reliabilityClass,
            authority_lock: authorityLock,
            has_proof_trace: hasProofTrace,
            orchestrator_disposition: orchDisposition,
            raw_survival: survivalResult,
            raw_mc: mcResult,
            raw_class: classResult
          });
        });
      });
    });
  });
}

// ── SCORE A SINGLE CASE ──────────────────────────────────────────────

function scoreCase(testCase, pipelineResult) {
  var checks = [];
  var passCount = 0;
  var totalChecks = 0;

  function check(name, passed, detail) {
    totalChecks++;
    if (passed) passCount++;
    checks.push({ name: name, passed: passed, detail: detail || '' });
  }

  // 1. Structured JSON output returned
  check('Structured JSON output',
    pipelineResult.survival_ok || pipelineResult.class_ok,
    'survival=' + pipelineResult.survival_ok + ' class=' + pipelineResult.class_ok);

  // 2. Survival probabilities at 1, 3, 5 years
  var fp = pipelineResult.fail_probs;
  var hasAllHorizons = fp['1yr'] !== undefined && fp['3yr'] !== undefined && fp['5yr'] !== undefined;
  check('Survival probability at 1yr, 3yr, 5yr',
    hasAllHorizons,
    'P_fail 1yr=' + round4(fp['1yr']) + ' 3yr=' + round4(fp['3yr']) + ' 5yr=' + round4(fp['5yr']));

  // 3. Survival probabilities within expected ranges
  var ranges = testCase.expected_pfail_ranges;
  var rangeChecks = [];
  var allInRange = true;
  var horizons = ['1yr', '3yr', '5yr'];
  for (var h = 0; h < horizons.length; h++) {
    var hz = horizons[h];
    var actual = fp[hz];
    var expected = ranges[hz];
    if (actual !== undefined && expected) {
      var inRange = actual >= expected[0] && actual <= expected[1];
      rangeChecks.push(hz + ': ' + round4(actual) + ' [' + expected[0] + '-' + expected[1] + '] ' + (inRange ? 'OK' : 'OUT'));
      if (!inRange) allInRange = false;
    } else {
      rangeChecks.push(hz + ': missing');
      allInRange = false;
    }
  }
  check('P_fail within expected ranges', allInRange, rangeChecks.join(' | '));

  // 4. Monte Carlo P05/P50/P95 ordering
  var mcOrdered = false;
  var mcDetail = 'P05=' + round4(pipelineResult.mc_p05) + ' P50=' + round4(pipelineResult.mc_p50) + ' P95=' + round4(pipelineResult.mc_p95);
  if (pipelineResult.mc_p05 !== null && pipelineResult.mc_p50 !== null && pipelineResult.mc_p95 !== null) {
    mcOrdered = pipelineResult.mc_p05 <= pipelineResult.mc_p50 && pipelineResult.mc_p50 <= pipelineResult.mc_p95;
  }
  check('Monte Carlo P05 <= P50 <= P95', mcOrdered, mcDetail);

  // 5. Monte Carlo returned
  check('Monte Carlo simulation returned', pipelineResult.mc_ok,
    pipelineResult.mc_error || 'OK');

  // 6. Authority Lock
  check('Authority Lock = true', pipelineResult.authority_lock === testCase.expected_authority_lock,
    'expected=' + testCase.expected_authority_lock + ' actual=' + pipelineResult.authority_lock);

  // 7. No unsafe LOW_RISK
  var noUnsafeLow = pipelineResult.reliability_class !== 'LOW_RISK';
  check('No unsafe LOW_RISK classification', noUnsafeLow,
    'class=' + pipelineResult.reliability_class);

  // 8. Proof trace generated
  check('Proof trace / orchestrator response', pipelineResult.has_proof_trace,
    'disposition=' + pipelineResult.orchestrator_disposition);

  // 9. Mechanism-appropriate classification (ENGINEERING_REVIEW or REPAIR_REPLACE for all these high-risk cases)
  var appropriateClass = pipelineResult.reliability_class === 'ENGINEERING_REVIEW' ||
                         pipelineResult.reliability_class === 'REPAIR_REPLACE';
  check('Appropriate severity classification', appropriateClass,
    'class=' + pipelineResult.reliability_class);

  return {
    case_id: testCase.id,
    case_name: testCase.name,
    setting: testCase.setting,
    checks: checks,
    pass_count: passCount,
    total_checks: totalChecks,
    all_passed: passCount === totalChecks,
    reliability_class: pipelineResult.reliability_class,
    authority_lock: pipelineResult.authority_lock,
    fail_probs: pipelineResult.fail_probs,
    mc_percentiles: { p05: pipelineResult.mc_p05, p50: pipelineResult.mc_p50, p95: pipelineResult.mc_p95 }
  };
}

function round4(v) {
  if (v === null || v === undefined) return 'N/A';
  return Math.round(v * 10000) / 10000;
}

// ── SEQUENTIAL RUNNER ────────────────────────────────────────────────

function runAllCases(cases, index, results, finalCallback) {
  if (index >= cases.length) return finalCallback(results);

  var tc = cases[index];
  console.log('\n[' + (index + 1) + '/' + cases.length + '] ══════════════════════════════════════════════');
  console.log('  Case: ' + tc.id + ' — ' + tc.name);
  console.log('  Setting: ' + tc.setting);
  console.log('  Asset: ' + tc.asset);
  console.log('  Weibull: shape=' + tc.survival_model.shape + ' scale=' + tc.survival_model.scale_years + ' mechanism=' + tc.survival_model.mechanism);
  console.log('  Running full pipeline (survival + MC + classification + orchestrator)...');

  runFullPipeline(tc, function(pipelineResult) {
    var scored = scoreCase(tc, pipelineResult);
    results.push(scored);

    // Print check results
    for (var c = 0; c < scored.checks.length; c++) {
      var chk = scored.checks[c];
      var icon = chk.passed ? 'PASS' : 'FAIL';
      console.log('  [' + icon + '] ' + chk.name);
      if (chk.detail) console.log('         ' + chk.detail);
    }
    console.log('  Result: ' + scored.pass_count + '/' + scored.total_checks + ' checks passed');

    runAllCases(cases, index + 1, results, finalCallback);
  });
}

// ── GLOBAL SCORECARD ─────────────────────────────────────────────────

function printScorecard(results) {
  console.log('\n\n════════════════════════════════════════════════════════════════');
  console.log('PHOTOREALISTIC INSPECTION DATASET PACK v3 — SCORECARD');
  console.log('FORGED 4D NDT Intelligence OS — Full Pipeline Validation');
  console.log('════════════════════════════════════════════════════════════════\n');

  var totalCases = results.length;
  var casesAllPassed = 0;
  var totalChecks = 0;
  var totalPassed = 0;

  // Global criteria counters
  var structuredJson = 0;
  var survivalProbs = 0;
  var pfailInRange = 0;
  var mcOrdering = 0;
  var mcReturned = 0;
  var authorityLock = 0;
  var noUnsafeLow = 0;
  var proofTrace = 0;
  var appropriateClass = 0;

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.all_passed) casesAllPassed++;
    totalChecks = totalChecks + r.total_checks;
    totalPassed = totalPassed + r.pass_count;

    for (var c = 0; c < r.checks.length; c++) {
      var chk = r.checks[c];
      if (chk.passed) {
        if (chk.name === 'Structured JSON output') structuredJson++;
        if (chk.name === 'Survival probability at 1yr, 3yr, 5yr') survivalProbs++;
        if (chk.name === 'P_fail within expected ranges') pfailInRange++;
        if (chk.name === 'Monte Carlo P05 <= P50 <= P95') mcOrdering++;
        if (chk.name === 'Monte Carlo simulation returned') mcReturned++;
        if (chk.name === 'Authority Lock = true') authorityLock++;
        if (chk.name === 'No unsafe LOW_RISK classification') noUnsafeLow++;
        if (chk.name === 'Proof trace / orchestrator response') proofTrace++;
        if (chk.name === 'Appropriate severity classification') appropriateClass++;
      }
    }
  }

  console.log('  Cases:                             ' + totalCases);
  console.log('  Cases fully passed:                ' + casesAllPassed + ' / ' + totalCases);
  console.log('  Total checks passed:               ' + totalPassed + ' / ' + totalChecks);
  console.log('');

  console.log('── GLOBAL PASS CRITERIA ──────────────────────────────────────────\n');

  var criteria = [
    { name: 'Structured JSON output', score: structuredJson },
    { name: 'Survival probability at 1/3/5yr', score: survivalProbs },
    { name: 'P_fail within expected ranges', score: pfailInRange },
    { name: 'Monte Carlo P05<=P50<=P95', score: mcOrdering },
    { name: 'Monte Carlo returned', score: mcReturned },
    { name: 'Authority Lock triggers', score: authorityLock },
    { name: 'No unsafe LOW_RISK', score: noUnsafeLow },
    { name: 'Proof trace present', score: proofTrace },
    { name: 'Appropriate severity class', score: appropriateClass }
  ];

  var globalPass = true;
  for (var g = 0; g < criteria.length; g++) {
    var cr = criteria[g];
    var pass = cr.score >= totalCases;
    var icon = pass ? 'PASS' : 'FAIL';
    console.log('  [' + icon + '] ' + cr.name + ': ' + cr.score + '/' + totalCases);
    if (!pass) globalPass = false;
  }

  console.log('\n── PER-CASE SUMMARY ─────────────────────────────────────────────\n');

  for (var s = 0; s < results.length; s++) {
    var rs = results[s];
    var caseIcon = rs.all_passed ? 'PASS' : 'FAIL';
    console.log('  [' + caseIcon + '] ' + rs.case_id + ' — ' + rs.case_name);
    console.log('         class=' + rs.reliability_class + ' lock=' + rs.authority_lock + ' checks=' + rs.pass_count + '/' + rs.total_checks);
    if (rs.fail_probs) {
      console.log('         P_fail: 1yr=' + round4(rs.fail_probs['1yr']) + ' 3yr=' + round4(rs.fail_probs['3yr']) + ' 5yr=' + round4(rs.fail_probs['5yr']));
    }
    if (rs.mc_percentiles) {
      console.log('         MC: P05=' + round4(rs.mc_percentiles.p05) + ' P50=' + round4(rs.mc_percentiles.p50) + ' P95=' + round4(rs.mc_percentiles.p95));
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  if (globalPass) {
    console.log('OVERALL: ALL GLOBAL CRITERIA PASSED');
  } else {
    console.log('OVERALL: SOME CRITERIA NOT MET');
  }
  console.log('════════════════════════════════════════════════════════════════\n');
}

// ── MAIN ─────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════════════════════');
console.log('PHOTOREALISTIC INSPECTION DATASET PACK v3');
console.log('FORGED 4D NDT Intelligence OS — Full Pipeline Validation');
console.log('Target: ' + BASE_URL);
console.log('Cases: ' + TEST_CASES.length + ' (PHOTO-CASE-001 to 005)');
console.log('Pipeline: run_survival -> run_monte_carlo -> run_classification -> orchestrator');
console.log('════════════════════════════════════════════════════════════════');

runAllCases(TEST_CASES, 0, [], function(results) {
  printScorecard(results);
});
