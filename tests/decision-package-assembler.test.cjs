// FORGED NDT Intelligence OS - DecisionPackage Assembler Regression Tests
//
// Run with: node tests/decision-package-assembler.test.js
//
// No external test framework required. Self-contained.
// Exits 0 on pass-all, 1 on any failure.
//
// Tests per Contract section 10 (docs/DECISION_PACKAGE_CONTRACT.md).

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
// FIXTURE — A representative production-shape input
// ============================================================================
function makeFixture() {
  return {
    caseId: 'CASE-TEST-001',
    decisionTimestamp: '2026-05-28T00:00:00.000Z',
    decisionCore: {
      decision_core: {
        engine_version: 'v16.6e',
        elapsed_ms: 432,
        decision_reality: {
          disposition: 'repair_before_restart',
          hard_locks: [
            {
              code: 'HL_CRITICAL_WALL_LOSS',
              reason: 'Wall thickness 0.18 in below T-min 0.25 in',
              disposition: 'REPAIR BEFORE RESTART',
              physics_basis: 'Hoop stress at operating pressure exceeds allowable'
            }
          ]
        },
        damage_reality: {
          primary_mechanism: 'sulfidation',
          validated_mechanisms: [
            { mechanism: 'sulfidation', reality_score: 0.82, reasoning: 'High-sulfur crude, elevated temp' },
            { mechanism: 'naphthenic_acid_corrosion', reality_score: 0.34, reasoning: 'TAN below 0.5' },
            { mechanism: 'high_temp_h2_attack', reality_score: 0.12, reasoning: 'Below threshold for HTHA' }
          ]
        },
        physical_reality: {
          environment: {
            phases_present: ['HYDROCARBON', 'H2S'],
            atmosphere_class: null,
            process_temperature_C: 285
          },
          material: { grade: 'A335 P22' }
        },
        consequence_reality: {
          consequence_tier: 'HIGH',
          human_impact: 'PERSONNEL_EXPOSURE_POSSIBLE',
          enforcement_requirements: ['API_570_INSPECTION', 'OSHA_PSM']
        },
        inspection_reality: {
          required_methods: [
            { method: 'UT-thickness', rationale: 'Confirm wall remaining' }
          ]
        },
        reality_confidence: {
          overall: 0.78,
          contradiction_flags: []
        }
      }
    },
    failureModeDominance: {
      governing_failure_mode: 'CORROSION',
      governing_severity: 'HIGH'
    },
    failureTimeline: {
      governing_time_years: 1.5,
      recommended_inspection_interval_years: 0.5,
      urgency: 'NEAR_TERM',
      progression_state: 'ACTIVE',
      corrosion_timeline: { mechanism_name: 'sulfidation', time_to_action_years: 1.5 },
      crack_timeline: { mechanism_name: 'fatigue', time_to_action_years: 4.2 }
    },
    authorityLock: {
      authority_chain: [
        { code: 'API 570', clause: '7.4.2', reason: 'Wall thickness measurement interval' },
        { code: 'API 579', clause: 'Part 5 Level 1', reason: 'Local metal loss assessment' }
      ]
    },
    dispositionPathway: {
      disposition: 'ENGINEERING_ASSESSMENT',
      required_inspection_plan: [
        { method: 'UT-thickness', description: 'Wall thickness grid' }
      ]
    },
    remainingStrength: {
      governing_maop: 285,
      governing_method: 'modified_b31g',
      severity_tier: 'TIER_2',
      pressure_reduction_required: false,
      calculations: {
        b31g_rsf: 0.74,
        modified_rsf: 0.81
      }
    },
    contradictionEngine: {
      contradictions: [
        {
          category: 'method_vs_mechanism',
          severity: 'MAJOR',
          contradiction_description: 'PT recommended but expected mechanism is internal corrosion'
        }
      ]
    },
    evidenceProvenance: {
      provenance_summary: {
        dominant_source: 'INFERRED',
        trust_band: 'MEDIUM',
        measured_fraction: 0.42
      },
      evidence: [
        { provenance: 'MEASURED' },
        { provenance: 'INFERRED' },
        { provenance: 'UNVERIFIED' }
      ]
    }
  };
}

// ============================================================================
// TESTS — per Contract section 10
// ============================================================================

// Test 1: Identity — same input twice produces byte-identical JSON
test('Test 1: Identity (same input twice → identical JSON and packageHash)', function () {
  var a = assembler.assembleDecisionPackage(makeFixture());
  var b = assembler.assembleDecisionPackage(makeFixture());
  assert.strictEqual(a.packageHash, b.packageHash, 'packageHash should be identical');
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b), 'serialized JSON should be identical');
});

// Test 2: Empty pipeline — minimal inputs don't crash
test('Test 2: Empty pipeline (minimal inputs do not crash)', function () {
  var minimal = {
    caseId: 'MIN',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } }
  };
  var pkg = assembler.assembleDecisionPackage(minimal);
  assert.strictEqual(pkg.disposition, 'ACCEPT_FOR_CONTINUED_SERVICE');
  assert.strictEqual(pkg.schemaVersion, '1.0');
  assert.ok(pkg.packageHash);
  assert.ok(pkg.fmd);
  assert.ok(pkg.timeline);
});

// Test 3: Disposition translation — all decision_core values map correctly
test('Test 3a: Disposition translation (decision_core → DecisionPackage)', function () {
  var cases = [
    { src: 'no_go', expected: 'REJECT_FROM_SERVICE' },
    { src: 'repair_before_restart', expected: 'REPAIR' },
    { src: 'hold_for_review', expected: 'HOLD_FOR_INPUT' },
    { src: 'engineering_review_required', expected: 'FFS_LEVEL_2_REQUIRED' },
    { src: 'conditional_go', expected: 'ACCEPT_WITH_MONITORING' },
    { src: 'go', expected: 'ACCEPT_FOR_CONTINUED_SERVICE' }
  ];
  for (var i = 0; i < cases.length; i = i + 1) {
    var c = cases[i];
    var inputs = {
      caseId: 'T3',
      decisionTimestamp: '2026-01-01T00:00:00.000Z',
      decisionCore: { decision_core: { decision_reality: { disposition: c.src } } }
    };
    var pkg = assembler.assembleDecisionPackage(inputs);
    assert.strictEqual(pkg.disposition, c.expected, 'src=' + c.src + ' → expected ' + c.expected + ' got ' + pkg.disposition);
  }
});

test('Test 3b: Disposition translation (disposition_pathway → DecisionPackage when decision_core absent)', function () {
  var cases = [
    { src: 'IMMEDIATE_ACTION', expected: 'REJECT_FROM_SERVICE' },
    { src: 'IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW', expected: 'HALT_AND_ESCALATE' },
    { src: 'HOLD_FOR_INPUT_ENFORCEMENT', expected: 'HOLD_FOR_INPUT' },
    { src: 'MONITOR', expected: 'ACCEPT_WITH_MONITORING' },
    { src: 'CONTINUE_SERVICE', expected: 'ACCEPT_FOR_CONTINUED_SERVICE' }
  ];
  for (var i = 0; i < cases.length; i = i + 1) {
    var c = cases[i];
    var inputs = {
      caseId: 'T3B',
      decisionTimestamp: '2026-01-01T00:00:00.000Z',
      decisionCore: { decision_core: {} }, // no disposition from core
      dispositionPathway: { disposition: c.src }
    };
    var pkg = assembler.assembleDecisionPackage(inputs);
    assert.strictEqual(pkg.disposition, c.expected, 'src=' + c.src + ' → expected ' + c.expected + ' got ' + pkg.disposition);
  }
});

// Test 4: Disposition conflict — conservative direction wins and a contradiction is emitted
test('Test 4: Disposition conflict (decision_core=go, pathway=IMMEDIATE_ACTION → REJECT_FROM_SERVICE + contradiction)', function () {
  var inputs = {
    caseId: 'T4',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } },
    dispositionPathway: { disposition: 'IMMEDIATE_ACTION' }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  // REJECT_FROM_SERVICE is more conservative than ACCEPT_FOR_CONTINUED_SERVICE
  assert.strictEqual(pkg.disposition, 'REJECT_FROM_SERVICE');
  // Contradiction must be emitted
  var hasDivergence = false;
  for (var i = 0; i < pkg.contradictions.length; i = i + 1) {
    if (pkg.contradictions[i].type === 'DISPOSITION_DIVERGENCE') { hasDivergence = true; break; }
  }
  assert.ok(hasDivergence, 'expected DISPOSITION_DIVERGENCE contradiction');
});

// Test 5: Hard-lock translation
test('Test 5: Hard-lock translation (each HL_* code maps to canonical trigger)', function () {
  var hlCases = [
    { code: 'HL_THROUGH_WALL_LEAK', expectedTrigger: 'LOSS_OF_CONTAINMENT_IMMINENT', expectedSeverity: 'CRITICAL' },
    { code: 'HL_PRIMARY_CRACK', expectedTrigger: 'CODE_ALLOWABLE_EXCEEDED', expectedSeverity: 'HIGH' },
    { code: 'HL_SUPPORT_COLLAPSE', expectedTrigger: 'STRUCTURAL_INTEGRITY_LOST', expectedSeverity: 'CRITICAL' },
    { code: 'HL_FIRE_NO_VALIDATION', expectedTrigger: 'FIRE_DAMAGE_UNVALIDATED', expectedSeverity: 'CRITICAL' },
    { code: 'HL_MAJOR_DEFORMATION', expectedTrigger: 'STRUCTURAL_INTEGRITY_LOST', expectedSeverity: 'HIGH' },
    { code: 'HL_CRITICAL_WALL_LOSS', expectedTrigger: 'CODE_ALLOWABLE_EXCEEDED', expectedSeverity: 'HIGH' }
  ];
  for (var i = 0; i < hlCases.length; i = i + 1) {
    var hc = hlCases[i];
    var inputs = {
      caseId: 'T5',
      decisionTimestamp: '2026-01-01T00:00:00.000Z',
      decisionCore: {
        decision_core: {
          decision_reality: {
            disposition: 'no_go',
            hard_locks: [{ code: hc.code, disposition: 'NO GO', reason: 'test', physics_basis: 'test' }]
          }
        }
      }
    };
    var pkg = assembler.assembleDecisionPackage(inputs);
    assert.strictEqual(pkg.hardLocks.length, 1);
    assert.strictEqual(pkg.hardLocks[0].trigger, hc.expectedTrigger, 'trigger for ' + hc.code);
    assert.strictEqual(pkg.hardLocks[0].severity, hc.expectedSeverity, 'severity for ' + hc.code);
    assert.strictEqual(pkg.hardLocks[0].safeStateOutput, 'REJECT_FROM_SERVICE');
    assert.strictEqual(pkg.hardLocks[0].code, hc.code, 'original code preserved');
  }
});

// Test 6: Unknown hard-lock — emit UNCLASSIFIED_HARD_LOCK with HIGH severity, code preserved
test('Test 6: Unknown hard-lock (preserves code, marks UNCLASSIFIED)', function () {
  var inputs = {
    caseId: 'T6',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: {
      decision_core: {
        decision_reality: {
          disposition: 'no_go',
          hard_locks: [{ code: 'HL_BRAND_NEW_LOCK', disposition: 'NO GO', reason: 'novel', physics_basis: 'novel' }]
        }
      }
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  assert.strictEqual(pkg.hardLocks[0].trigger, 'UNCLASSIFIED_HARD_LOCK');
  assert.strictEqual(pkg.hardLocks[0].severity, 'HIGH');
  assert.strictEqual(pkg.hardLocks[0].code, 'HL_BRAND_NEW_LOCK');
});

// Test 7: mustNotConclude rules
test('Test 7a: mustNotConclude — ASSUMED provenance triggers rule 1', function () {
  var inputs = {
    caseId: 'T7A',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } },
    evidenceProvenance: {
      provenance_summary: { dominant_source: 'UNVERIFIED' }
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  assert.strictEqual(pkg.provenance.lowestProvenance, 'ASSUMED');
  var found = pkg.mustNotConclude.some(function (s) { return s.indexOf('ASSUMED') >= 0; });
  assert.ok(found, 'expected mustNotConclude entry mentioning ASSUMED');
});

test('Test 7b: mustNotConclude — low confidence triggers rule 3', function () {
  var inputs = {
    caseId: 'T7B',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: {
      decision_core: {
        decision_reality: { disposition: 'go' },
        reality_confidence: { overall: 0.42 }
      }
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  assert.ok(pkg.confidence < 0.60);
  var found = pkg.mustNotConclude.some(function (s) { return s.indexOf('confidence') >= 0; });
  assert.ok(found, 'expected confidence-related mustNotConclude');
});

test('Test 7c: mustNotConclude — unresolved contradiction triggers rule 4', function () {
  var inputs = {
    caseId: 'T7C',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } },
    contradictionEngine: {
      contradictions: [{ category: 'claim_vs_image', severity: 'MAJOR', contradiction_description: 'test', resolved: false }]
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  var found = pkg.mustNotConclude.some(function (s) { return s.indexOf('contradictions remain unresolved') >= 0; });
  assert.ok(found, 'expected unresolved-contradiction mustNotConclude');
});

test('Test 7d: mustNotConclude — hard locks present triggers rule 8', function () {
  var inputs = {
    caseId: 'T7D',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: {
      decision_core: {
        decision_reality: {
          disposition: 'no_go',
          hard_locks: [{ code: 'HL_THROUGH_WALL_LEAK', disposition: 'NO GO', reason: 'leak', physics_basis: 'breach' }]
        }
      }
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  var found = pkg.mustNotConclude.some(function (s) { return s.indexOf('hard-lock') >= 0; });
  assert.ok(found, 'expected hard-lock mustNotConclude');
});

// Test 8: packageHash determinism — array order doesn't matter (canonical sort handles it)
test('Test 8: packageHash determinism (key order swapped → same hash)', function () {
  var a = assembler.assembleDecisionPackage(makeFixture());
  // Mutate by re-serializing with different key ordering on input
  var fixtureBackwards = makeFixture();
  // Force a different in-memory key order on a sub-object
  var dr = fixtureBackwards.decisionCore.decision_core.decision_reality;
  var newDr = { hard_locks: dr.hard_locks, disposition: dr.disposition };
  fixtureBackwards.decisionCore.decision_core.decision_reality = newDr;
  var b = assembler.assembleDecisionPackage(fixtureBackwards);
  assert.strictEqual(a.packageHash, b.packageHash, 'reordering keys should not change packageHash');
});

// Test 9: packageHash tamper detection
test('Test 9: packageHash tamper detection (one field changes → different hash)', function () {
  var inputsA = makeFixture();
  var inputsB = makeFixture();
  inputsB.decisionCore.decision_core.damage_reality.primary_mechanism = 'high_temp_h2_attack';
  var a = assembler.assembleDecisionPackage(inputsA);
  var b = assembler.assembleDecisionPackage(inputsB);
  assert.notStrictEqual(a.packageHash, b.packageHash, 'changing primary mechanism should change packageHash');
});

// Test 10: Provenance non-increase
test('Test 10: Provenance non-increase (ASSUMED evidence wins over MEASURED)', function () {
  var inputs = {
    caseId: 'T10',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } },
    evidenceProvenance: {
      provenance_summary: { dominant_source: 'MEASURED' }, // dominant is MEASURED
      evidence: [
        { provenance: 'MEASURED' },
        { provenance: 'MEASURED' },
        { provenance: 'UNVERIFIED' } // but one item is ASSUMED-equivalent
      ]
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  assert.strictEqual(pkg.provenance.lowestProvenance, 'ASSUMED',
    'lowestProvenance should be ASSUMED because of one UNVERIFIED evidence item');
});

// ============================================================================
// EXTRA — Patent-specific behaviors
// ============================================================================

// Compound mechanism rate-control test (0.6-fraction rule, Patent Claim 4)
test('Extra: 0.6-fraction rule — fast mechanism < 0.6× next becomes rate-controller', function () {
  var inputs = {
    caseId: 'EX-A',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } },
    failureTimeline: {
      governing_time_years: 1.0,
      corrosion_timeline: { mechanism_name: 'sulfidation', time_to_action_years: 1.0 },
      crack_timeline: { mechanism_name: 'fatigue', time_to_action_years: 10.0 }
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  // 1.0 < 0.6 * 10.0 (= 6.0) → sulfidation is rate-controller
  assert.strictEqual(pkg.timeline.rateControllingMechanism, 'sulfidation');
});

test('Extra: 0.6-fraction rule — neither mechanism dominates → null', function () {
  var inputs = {
    caseId: 'EX-B',
    decisionTimestamp: '2026-01-01T00:00:00.000Z',
    decisionCore: { decision_core: { decision_reality: { disposition: 'go' } } },
    failureTimeline: {
      governing_time_years: 1.0,
      corrosion_timeline: { mechanism_name: 'sulfidation', time_to_action_years: 1.0 },
      crack_timeline: { mechanism_name: 'fatigue', time_to_action_years: 1.2 }
    }
  };
  var pkg = assembler.assembleDecisionPackage(inputs);
  // 1.0 is NOT < 0.6 * 1.2 (= 0.72) → null (joint envelope governs)
  assert.strictEqual(pkg.timeline.rateControllingMechanism, null);
});

// Contradiction type mapping — verify METHOD_MECHANISM_MISMATCH lands correctly (PIL depends on it)
test('Extra: method_vs_mechanism → METHOD_MECHANISM_MISMATCH (PIL escalation rule depends on this)', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  var found = false;
  for (var i = 0; i < pkg.contradictions.length; i = i + 1) {
    if (pkg.contradictions[i].type === 'METHOD_MECHANISM_MISMATCH') {
      found = true;
      assert.strictEqual(pkg.contradictions[i].category, 'method_vs_mechanism', 'category preserved');
      break;
    }
  }
  assert.ok(found, 'expected METHOD_MECHANISM_MISMATCH contradiction in fixture');
});

// FMD margin derivation from validated_mechanisms scores
test('Extra: FMD margin derives from top-2 candidate score delta', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  // fixture: scores 0.82, 0.34, 0.12 → margin = 0.82 - 0.34 = 0.48
  assert.ok(Math.abs(pkg.fmd.margin - 0.48) < 0.0001, 'margin = 0.48 (got ' + pkg.fmd.margin + ')');
});

// Hazard derivation
test('Extra: hazards derived from environment (H2S phase → wet_h2s)', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  assert.ok(pkg.resolved.environment.hazards.indexOf('wet_h2s') >= 0, 'wet_h2s hazard should be present');
  assert.ok(pkg.resolved.environment.hazards.indexOf('hydrocarbon_service') >= 0, 'hydrocarbon_service should be present');
  assert.ok(pkg.resolved.environment.hazards.indexOf('elevated_temperature') >= 0, 'elevated_temperature (T=285°C) should be present');
});

// Binding clauses are sorted deterministically
test('Extra: bindingClauses sorted by (code, clause)', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  assert.strictEqual(pkg.bindingClauses.length, 2);
  assert.strictEqual(pkg.bindingClauses[0].code, 'API 570');
  assert.strictEqual(pkg.bindingClauses[1].code, 'API 579');
});

// Schema version
test('Extra: schemaVersion is 1.0', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  assert.strictEqual(pkg.schemaVersion, '1.0');
});

// Missing required inputs throw structured error
test('Extra: missing decisionCore throws MISSING_INPUT_FIELD error', function () {
  try {
    assembler.assembleDecisionPackage({ caseId: 'X', decisionTimestamp: '2026-01-01T00:00:00.000Z' });
    assert.fail('should have thrown');
  } catch (e) {
    assert.strictEqual(e.assemblerError, 'MISSING_INPUT_FIELD');
    assert.strictEqual(e.field, 'decisionCore');
  }
});

test('Extra: missing decisionTimestamp throws MISSING_INPUT_FIELD error', function () {
  try {
    assembler.assembleDecisionPackage({ caseId: 'X', decisionCore: { decision_core: {} } });
    assert.fail('should have thrown');
  } catch (e) {
    assert.strictEqual(e.assemblerError, 'MISSING_INPUT_FIELD');
    assert.strictEqual(e.field, 'decisionTimestamp');
  }
});

// projectionTimestamp is always null from the Assembler
test('Extra: projectionTimestamp always null from Assembler', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  assert.strictEqual(pkg.projectionTimestamp, null);
});

// packageHash does not depend on projectionTimestamp
test('Extra: packageHash does not change when projectionTimestamp is set (PIL stability)', function () {
  var pkg = assembler.assembleDecisionPackage(makeFixture());
  var originalHash = pkg.packageHash;
  // Simulate PIL setting projectionTimestamp
  pkg.projectionTimestamp = '2026-05-29T12:00:00.000Z';
  var recomputed = assembler._internals.computePackageHash(pkg);
  assert.strictEqual(originalHash, recomputed, 'packageHash should be stable across PIL projection');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('');
console.log('======================================================================');
console.log('DecisionPackage Assembler — Regression Test Results');
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
console.log('All tests passed.');
process.exit(0);
