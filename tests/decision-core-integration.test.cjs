// FORGED NDT Intelligence OS - decision-core Assembler integration smoke test
//
// Verifies that the integration logic added to decision-core.ts works correctly
// by simulating the exact pattern: build a responseBody matching production
// decision-core shape, run the Assembler against it, attach result, verify.
//
// Run: node tests/decision-core-integration.test.cjs

'use strict';

var assembler = require('../netlify/functions/decision-package-assembler.cjs');
var assert = require('assert');

var passed = 0;
var failed = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passed = passed + 1;
    console.log('PASS  ' + name);
  } catch (e) {
    failed = failed + 1;
    failures.push({ name: name, error: e.message || String(e) });
    console.log('FAIL  ' + name + '  --  ' + (e.message || String(e)));
  }
}

// ============================================================================
// FIXTURE — simulates a real production decision-core response body
// (this is what `responseBody` looks like at the integration point)
// ============================================================================
function makeProductionResponseBody() {
  return {
    decision_core: {
      engine_version: 'physics-first-decision-core-v2.12.2',
      elapsed_ms: 432,
      klein_bottle_states: 8,
      asset_correction: { corrected: false },
      physical_reality: {
        environment: {
          phases_present: ['HYDROCARBON', 'H2S'],
          phases_negated: [],
          atmosphere_class: null,
          process_temperature_C: 285
        },
        material: { class: 'carbon_steel', class_confidence: 0.9, evidence: [] }
      },
      damage_reality: {
        validated_mechanisms: [
          { mechanism: 'sulfidation', reality_score: 0.82, reasoning: 'High-sulfur crude, elevated temp' },
          { mechanism: 'naphthenic_acid_corrosion', reality_score: 0.34, reasoning: 'TAN below 0.5' }
        ],
        primary_mechanism: 'sulfidation',
        damage_confidence: 0.78
      },
      consequence_reality: {
        consequence_tier: 'HIGH',
        human_impact: 'PERSONNEL_EXPOSURE_POSSIBLE',
        enforcement_requirements: ['API_570_INSPECTION', 'OSHA_PSM']
      },
      authority_reality: {
        primary_authority: { code: 'API 570', clauses: ['7.4.2'] },
        secondary_authorities: [{ code: 'API 579' }],
        conditional_authorities: [],
        authority_confidence: 0.81
      },
      inspection_reality: {
        required_methods: [{ method: 'UT-thickness', rationale: 'Confirm wall remaining' }],
        inspection_confidence: 0.75
      },
      evidence_provenance: {
        evidence: [],
        provenance_summary: { dominant_source: 'INFERRED', trust_band: 'MEDIUM', measured_fraction: 0.42 },
        measurement_reality: null
      },
      physics_computations: {},
      reality_confidence: {
        overall: 0.78,
        band: 'MEDIUM',
        contradiction_flags: [],
        certainty_state: 'EVIDENCE_LIMITED',
        decision_lock: false,
        escalation_required: false,
        limiting_factors: [],
        counterfactual_challenge: null,
        confidence_narrative: 'Test fixture'
      },
      decision_reality: {
        disposition: 'repair_before_restart',
        disposition_basis: 'Wall loss exceeds T-min',
        gates: {},
        guided_recovery: null,
        phased_strategy: null,
        hard_locks: [
          {
            code: 'HL_CRITICAL_WALL_LOSS',
            reason: 'Wall thickness 0.18 in below T-min 0.25 in',
            disposition: 'REPAIR BEFORE RESTART',
            physics_basis: 'Hoop stress at operating pressure exceeds allowable'
          }
        ],
        decision_trace: []
      }
    }
  };
}

// ============================================================================
// INTEGRATION TESTS — simulate the exact code path inserted into decision-core.ts
// ============================================================================

test('Integration 1: Assembler attaches decisionPackage to responseBody', function () {
  var responseBody = makeProductionResponseBody();
  var startMs = Date.now();
  var elapsedMs = 432;

  // This is the exact pattern inserted into decision-core.ts
  try {
    var decisionTimestampIso = new Date(startMs + elapsedMs).toISOString();
    responseBody.decisionPackage = assembler.assembleDecisionPackage({
      caseId: 'INTEG-001',
      decisionTimestamp: decisionTimestampIso,
      decisionCore: responseBody
    });
  } catch (assemblerErr) {
    responseBody.decisionPackageError = { error: 'ASSEMBLER_FAILED' };
  }

  assert.ok(responseBody.decisionPackage, 'decisionPackage should be attached');
  assert.ok(!responseBody.decisionPackageError, 'no error should be set');
  assert.strictEqual(responseBody.decisionPackage.schemaVersion, '1.0');
  assert.strictEqual(responseBody.decisionPackage.disposition, 'REPAIR');
});

test('Integration 2: Existing decision_core fields are preserved exactly', function () {
  var responseBody = makeProductionResponseBody();
  var originalShape = JSON.stringify(responseBody);

  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-002',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  // Verify decision_core is byte-identical to before assembly
  var afterDecisionCore = JSON.stringify({ decision_core: responseBody.decision_core });
  var beforeDecisionCore = JSON.stringify({ decision_core: JSON.parse(originalShape).decision_core });
  assert.strictEqual(afterDecisionCore, beforeDecisionCore, 'decision_core block must remain byte-identical');
});

test('Integration 3: Hard locks correctly translated', function () {
  var responseBody = makeProductionResponseBody();
  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-003',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  assert.strictEqual(responseBody.decisionPackage.hardLocks.length, 1);
  assert.strictEqual(responseBody.decisionPackage.hardLocks[0].trigger, 'CODE_ALLOWABLE_EXCEEDED');
  assert.strictEqual(responseBody.decisionPackage.hardLocks[0].severity, 'HIGH');
  assert.strictEqual(responseBody.decisionPackage.hardLocks[0].safeStateOutput, 'REPAIR');
  assert.strictEqual(responseBody.decisionPackage.hardLocks[0].code, 'HL_CRITICAL_WALL_LOSS', 'original code preserved');
});

test('Integration 4: FMD margin derived from validated_mechanisms scores', function () {
  var responseBody = makeProductionResponseBody();
  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-004',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  // 0.82 - 0.34 = 0.48
  assert.ok(Math.abs(responseBody.decisionPackage.fmd.margin - 0.48) < 0.0001,
    'margin should be 0.48, got ' + responseBody.decisionPackage.fmd.margin);
  assert.strictEqual(responseBody.decisionPackage.fmd.dominant, 'sulfidation');
});

test('Integration 5: Hazards derived from environment.phases_present', function () {
  var responseBody = makeProductionResponseBody();
  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-005',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  var hazards = responseBody.decisionPackage.resolved.environment.hazards;
  assert.ok(hazards.indexOf('wet_h2s') >= 0, 'wet_h2s should be present (H2S phase)');
  assert.ok(hazards.indexOf('hydrocarbon_service') >= 0, 'hydrocarbon_service should be present');
  assert.ok(hazards.indexOf('elevated_temperature') >= 0, 'elevated_temperature should be present (285°C)');
  assert.ok(hazards.indexOf('personnel_exposure_risk') >= 0, 'personnel_exposure_risk should be present');
});

test('Integration 6: Defensive failure handling does not break responseBody', function () {
  // Simulate an Assembler crash by passing malformed input
  var responseBody = makeProductionResponseBody();
  var originalKeys = Object.keys(responseBody).slice();

  try {
    responseBody.decisionPackage = assembler.assembleDecisionPackage({
      caseId: 'INTEG-006',
      // intentionally missing decisionTimestamp
      decisionCore: responseBody
    });
  } catch (assemblerErr) {
    responseBody.decisionPackageError = {
      error: assemblerErr.assemblerError || 'ASSEMBLER_FAILED',
      field: assemblerErr.field || null,
      message: assemblerErr.message || String(assemblerErr)
    };
  }

  // Verify decision_core is still intact
  assert.ok(responseBody.decision_core, 'decision_core must remain even on Assembler failure');
  // Verify error was captured cleanly
  assert.ok(responseBody.decisionPackageError, 'error should be captured');
  assert.strictEqual(responseBody.decisionPackageError.error, 'MISSING_INPUT_FIELD');
  assert.strictEqual(responseBody.decisionPackageError.field, 'decisionTimestamp');
});

test('Integration 7: packageHash is computed and present', function () {
  var responseBody = makeProductionResponseBody();
  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-007',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  assert.ok(responseBody.decisionPackage.packageHash, 'packageHash must be present');
  assert.strictEqual(responseBody.decisionPackage.packageHash.length, 64, 'packageHash should be 64-char hex');
  assert.ok(/^[0-9a-f]{64}$/.test(responseBody.decisionPackage.packageHash), 'packageHash should be valid hex');
});

test('Integration 8: Two identical responseBodies produce identical packageHash', function () {
  var a = makeProductionResponseBody();
  var b = makeProductionResponseBody();
  var ts = '2026-05-28T00:00:00.000Z';

  a.decisionPackage = assembler.assembleDecisionPackage({ caseId: 'X', decisionTimestamp: ts, decisionCore: a });
  b.decisionPackage = assembler.assembleDecisionPackage({ caseId: 'X', decisionTimestamp: ts, decisionCore: b });

  assert.strictEqual(a.decisionPackage.packageHash, b.decisionPackage.packageHash);
});

test('Integration 9: JSON.stringify of full responseBody works (no circular refs)', function () {
  var responseBody = makeProductionResponseBody();
  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-009',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  // This is the final step in decision-core: JSON.stringify(responseBody)
  var serialized = JSON.stringify(responseBody);
  assert.ok(serialized.length > 1000, 'serialized response should be substantial');
  assert.ok(serialized.indexOf('"decisionPackage":') > 0, 'decisionPackage key should be in serialized output');
  assert.ok(serialized.indexOf('"decision_core":') > 0, 'decision_core key should be preserved');

  // Verify we can parse it back
  var roundtrip = JSON.parse(serialized);
  assert.ok(roundtrip.decision_core);
  assert.ok(roundtrip.decisionPackage);
  assert.strictEqual(roundtrip.decisionPackage.disposition, 'REPAIR');
});

test('Integration 10: mustNotConclude is populated based on assembled package state', function () {
  var responseBody = makeProductionResponseBody();
  responseBody.decisionPackage = assembler.assembleDecisionPackage({
    caseId: 'INTEG-010',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: responseBody
  });

  // We have: hard locks present → rule 8 should fire
  var found = responseBody.decisionPackage.mustNotConclude.some(function (s) {
    return s.indexOf('hard-lock') >= 0;
  });
  assert.ok(found, 'expected hard-lock mustNotConclude entry');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('');
console.log('======================================================================');
console.log('decision-core Assembler Integration — Smoke Test Results');
console.log('======================================================================');
console.log('PASSED: ' + passed);
console.log('FAILED: ' + failed);
console.log('TOTAL:  ' + (passed + failed));

if (failed > 0) {
  console.log('');
  console.log('FAILURES:');
  for (var i = 0; i < failures.length; i = i + 1) {
    console.log('  - ' + failures[i].name + ': ' + failures[i].error);
  }
  process.exit(1);
}

console.log('');
console.log('All integration smoke tests passed.');
process.exit(0);
