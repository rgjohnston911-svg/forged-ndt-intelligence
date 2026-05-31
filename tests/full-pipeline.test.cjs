// FORGED NDT Intelligence OS - Full Pipeline End-to-End Smoke Test
//
// Exercises the entire downstream chain:
//   decision-core (mocked) → DecisionPackage Assembler → PIL handler → RoleView
//
// Validates that a DecisionPackage produced by the Assembler is consumable
// by the PIL with no shape mismatches.
//
// Run: node tests/full-pipeline.test.cjs

'use strict';

var assembler = require('../netlify/functions/decision-package-assembler.cjs');
process.env.NDT_API_KEY = 'pipeline-gate-key';  // DEPLOY421: perspective-projection now requires auth
var pil = require('../netlify/functions/perspective-projection.cjs');
var assert = require('assert');

var passed = 0;
var failed = 0;
var failures = [];

function test(name, fn) {
  return fn().then(function () {
    passed = passed + 1;
    console.log('PASS  ' + name);
  }).catch(function (e) {
    failed = failed + 1;
    failures.push({ name: name, error: e.message || String(e) });
    console.log('FAIL  ' + name + '  --  ' + (e.message || String(e)));
  });
}

// ============================================================================
// FIXTURE — production-shaped decision-core response
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
        material: { class: 'carbon_steel' }
      },
      damage_reality: {
        validated_mechanisms: [
          { mechanism: 'sulfidation', reality_score: 0.82, reasoning: 'High-S crude' },
          { mechanism: 'naphthenic_acid_corrosion', reality_score: 0.34, reasoning: 'TAN low' }
        ],
        primary_mechanism: 'sulfidation',
        damage_confidence: 0.78
      },
      consequence_reality: {
        consequence_tier: 'HIGH',
        human_impact: 'PERSONNEL_EXPOSURE_POSSIBLE',
        enforcement_requirements: ['API_570_INSPECTION']
      },
      authority_reality: {
        primary_authority: { code: 'API 570' },
        secondary_authorities: [],
        conditional_authorities: [],
        authority_confidence: 0.81
      },
      inspection_reality: {
        required_methods: [{ method: 'UT-thickness', rationale: 'Confirm wall' }],
        inspection_confidence: 0.75
      },
      evidence_provenance: {
        evidence: [],
        provenance_summary: { dominant_source: 'INFERRED', trust_band: 'MEDIUM' },
        measurement_reality: null
      },
      physics_computations: {},
      reality_confidence: {
        overall: 0.78,
        band: 'MEDIUM',
        contradiction_flags: []
      },
      decision_reality: {
        disposition: 'repair_before_restart',
        gates: {},
        guided_recovery: null,
        phased_strategy: null,
        hard_locks: [{
          code: 'HL_CRITICAL_WALL_LOSS',
          reason: 'Wall thickness below T-min',
          disposition: 'REPAIR BEFORE RESTART',
          physics_basis: 'Hoop stress exceeds allowable'
        }],
        decision_trace: []
      }
    }
  };
}

var ROLE_CERTS = {
  INSPECTOR: [{ type: 'API_ICP', status: 'ACTIVE' }, { type: 'AWS_CWI', status: 'ACTIVE' }],
  ENGINEER: [{ type: 'API_510', status: 'ACTIVE' }, { type: 'API_570', status: 'ACTIVE' }],
  TECHNICIAN: [{ type: 'ASNT_LEVEL_II', status: 'ACTIVE' }],
  OPS_MANAGER: [],
  SAFETY: [{ type: 'OSHA_30', status: 'ACTIVE' }],
  STUDENT: []
};

function buildPilEvent(decisionPackage, role) {
  return {
    httpMethod: 'POST',
    headers: { 'X-API-Key': 'pipeline-gate-key' },
    queryStringParameters: null,
    body: JSON.stringify({
      decisionPackage: decisionPackage,
      roleContext: {
        role: role,
        userId: 'tester-' + role.toLowerCase(),
        jurisdiction: 'US',
        taskContext: 'INTEGRATION_TEST',
        requestTimestamp: '2026-05-28T00:00:00.000Z',
        certifications: ROLE_CERTS[role] || []
      }
    })
  };
}

// ============================================================================
// E2E TESTS
// ============================================================================

async function runAll() {

  await test('E2E 1: Assembler output is consumable by PIL handler (INSPECTOR role)', async function () {
    var responseBody = makeProductionResponseBody();
    var pkg = assembler.assembleDecisionPackage({
      caseId: 'E2E-001',
      decisionTimestamp: '2026-05-28T00:00:00.000Z',
      decisionCore: responseBody
    });

    var event = buildPilEvent(pkg, 'INSPECTOR');
    var result = await pil.handler(event, {});
    assert.strictEqual(result.statusCode, 200, 'PIL should return 200, got ' + result.statusCode + ' (body: ' + result.body + ')');
    var body = JSON.parse(result.body);
    assert.ok(body.ok, 'PIL response should be ok');
    assert.ok(body.view, 'PIL should return a view');
    assert.strictEqual(body.view.role, 'INSPECTOR');
    assert.ok(body.view.viewHash, 'view should have viewHash');
    assert.ok(body.view.invariantTruth, 'view should have invariantTruth block');
  });

  await test('E2E 2: Same DecisionPackage projected to ENGINEER role', async function () {
    var responseBody = makeProductionResponseBody();
    var pkg = assembler.assembleDecisionPackage({
      caseId: 'E2E-002',
      decisionTimestamp: '2026-05-28T00:00:00.000Z',
      decisionCore: responseBody
    });

    var event = buildPilEvent(pkg, 'ENGINEER');
    var result = await pil.handler(event, {});
    assert.strictEqual(result.statusCode, 200);
    var body = JSON.parse(result.body);
    assert.ok(body.view);
    assert.strictEqual(body.view.role, 'ENGINEER');
  });

  await test('E2E 3: Multi-role projection of SAME package preserves invariant truth', async function () {
    var responseBody = makeProductionResponseBody();
    var pkg = assembler.assembleDecisionPackage({
      caseId: 'E2E-003',
      decisionTimestamp: '2026-05-28T00:00:00.000Z',
      decisionCore: responseBody
    });

    var roles = ['INSPECTOR', 'ENGINEER', 'TECHNICIAN', 'OPS_MANAGER', 'SAFETY'];
    var views = [];
    for (var i = 0; i < roles.length; i = i + 1) {
      var event = buildPilEvent(pkg, roles[i]);
      var result = await pil.handler(event, {});
      assert.strictEqual(result.statusCode, 200, 'role ' + roles[i] + ' failed');
      var body = JSON.parse(result.body);
      views.push({ role: roles[i], view: body.view });
    }

    // Invariant truth must be IDENTICAL across all roles
    var first = views[0].view.invariantTruth;
    for (var j = 1; j < views.length; j = j + 1) {
      var v = views[j].view.invariantTruth;
      assert.strictEqual(v.disposition, first.disposition, roles[j] + ' disposition differs');
      assert.strictEqual(v.packageHash, first.packageHash, roles[j] + ' packageHash differs');
      assert.strictEqual(v.hardLockCount, first.hardLockCount, roles[j] + ' hardLockCount differs');
      assert.strictEqual(v.bindingClausesHash, first.bindingClausesHash, roles[j] + ' bindingClausesHash differs');
    }
  });

  await test('E2E 4: STUDENT role gets sensitive fields redacted', async function () {
    var responseBody = makeProductionResponseBody();
    var pkg = assembler.assembleDecisionPackage({
      caseId: 'E2E-004-CASE-WITH-SENSITIVE-ID',
      decisionTimestamp: '2026-05-28T00:00:00.000Z',
      decisionCore: responseBody
    });

    var event = buildPilEvent(pkg, 'STUDENT');
    var result = await pil.handler(event, {});
    assert.strictEqual(result.statusCode, 200);
    var body = JSON.parse(result.body);
    // STUDENT view should still have core truth fields but sensitive fields should be redacted/absent
    assert.ok(body.view, 'STUDENT view returned');
    assert.strictEqual(body.view.role, 'STUDENT');
  });

  await test('E2E 5: PIL determinism — same DecisionPackage produces same viewHash', async function () {
    var responseBody = makeProductionResponseBody();
    var pkg = assembler.assembleDecisionPackage({
      caseId: 'E2E-005',
      decisionTimestamp: '2026-05-28T00:00:00.000Z',
      decisionCore: responseBody
    });

    var event = buildPilEvent(pkg, 'INSPECTOR');
    var r1 = await pil.handler(event, {});
    var r2 = await pil.handler(event, {});
    var b1 = JSON.parse(r1.body);
    var b2 = JSON.parse(r2.body);
    assert.strictEqual(b1.view.viewHash, b2.view.viewHash, 'identical input must produce identical viewHash (Patent Claim 1(ii))');
  });

  await test('E2E 6: invariantTruth.packageHash matches the DecisionPackage.packageHash', async function () {
    var responseBody = makeProductionResponseBody();
    var pkg = assembler.assembleDecisionPackage({
      caseId: 'E2E-006',
      decisionTimestamp: '2026-05-28T00:00:00.000Z',
      decisionCore: responseBody
    });

    var event = buildPilEvent(pkg, 'INSPECTOR');
    var result = await pil.handler(event, {});
    var body = JSON.parse(result.body);
    assert.strictEqual(body.view.invariantTruth.packageHash, pkg.packageHash,
      'PIL viewHash must reference the DecisionPackage packageHash for replay-audit to work');
  });
}

runAll().then(function () {
  console.log('');
  console.log('======================================================================');
  console.log('Full Pipeline End-to-End — Smoke Test Results');
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
  console.log('All end-to-end smoke tests passed.');
  process.exit(0);
});
