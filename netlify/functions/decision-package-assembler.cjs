// FORGED NDT Intelligence OS - DecisionPackage Assembler
// DEPLOY##X / v##.x
//
// Per provisional patent disclosure: deterministic pure-function assembler that
// transforms the existing decision-pipeline engine outputs into a single frozen,
// hashable DecisionPackage in the shape consumed by the Perspective Intelligence
// Layer, the audit-layer (package-store, replay-audit, sign-export, coherence-log),
// and the multi-LLM adversarial validator.
//
// Pure JS. var only. String concatenation only. module.exports. No template literals.
// No I/O, no Date.now, no Math.random, no external state.
//
// Contract: docs/DECISION_PACKAGE_CONTRACT.md v1.0
//
// Input shape: {
//   caseId,                  // optional string identifier
//   decisionCore,            // full decision_core response body
//   failureModeDominance,    // failure-mode-dominance response body
//   failureTimeline,         // failure-timeline response body
//   authorityLock,           // authority-lock response body
//   dispositionPathway,      // disposition-pathway response body
//   remainingStrength,       // remaining-strength response body
//   contradictionEngine,     // contradiction-engine check_contradictions response
//   evidenceProvenance,      // evidence-provenance response body
//   codeAuthorityRegistry,   // optional code-authority-resolution lookup table
//   decisionTimestamp        // ISO string, frozen at decision time by caller
// }
//
// Output: frozen DecisionPackage object per the contract.

'use strict';

var crypto = require('crypto');

// ============================================================================
// SCHEMA VERSION
// ============================================================================
var SCHEMA_VERSION = '1.0';

// ============================================================================
// TRANSLATION TABLE 1 — DISPOSITION VOCABULARY
// Contract section 3.1
// ============================================================================
var DISPOSITION_DECISION_CORE = {
  'no_go': 'REJECT_FROM_SERVICE',
  'repair_before_restart': 'REPAIR',
  'hold_for_review': 'HOLD_FOR_INPUT',
  'engineering_review_required': 'FFS_LEVEL_2_REQUIRED',
  'conditional_go': 'ACCEPT_WITH_MONITORING',
  'go': 'ACCEPT_FOR_CONTINUED_SERVICE'
};

var DISPOSITION_PATHWAY = {
  'IMMEDIATE_ACTION': 'REJECT_FROM_SERVICE',
  'IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW': 'HALT_AND_ESCALATE',
  'HOLD_FOR_INPUT_ENFORCEMENT': 'HOLD_FOR_INPUT',
  'HOLD_FOR_DATA': 'HOLD_FOR_INPUT',
  'ENGINEERING_ASSESSMENT': 'FFS_LEVEL_2_REQUIRED',
  'MONITOR': 'ACCEPT_WITH_MONITORING',
  'CONTINUE_SERVICE': 'ACCEPT_FOR_CONTINUED_SERVICE',
  'domain_not_supported': 'HOLD_FOR_INPUT'
};

// Conservative-direction ordering (most → least conservative).
// Index 0 is most conservative. Used to resolve disposition conflicts.
var DISPOSITION_CONSERVATIVE_ORDER = [
  'HALT_AND_ESCALATE',
  'REJECT_FROM_SERVICE',
  'REPORT_TO_JURISDICTIONAL_AUTHORITY',
  'REPAIR',
  'HOLD_FOR_INPUT',
  'FFS_LEVEL_3_REQUIRED',
  'FFS_LEVEL_2_REQUIRED',
  'REINSPECT_BY_METHOD',
  'ACCEPT_WITH_MONITORING',
  'ACCEPT_FOR_CONTINUED_SERVICE'
];

function moreConservativeDisposition(a, b) {
  var ai = DISPOSITION_CONSERVATIVE_ORDER.indexOf(a);
  var bi = DISPOSITION_CONSERVATIVE_ORDER.indexOf(b);
  if (ai < 0 && bi < 0) return a; // both unknown — return the first
  if (ai < 0) return b;
  if (bi < 0) return a;
  return ai <= bi ? a : b;
}

// ============================================================================
// TRANSLATION TABLE 2 — HARD-LOCK TRIGGER CODES
// Contract section 3.2
// ============================================================================
var HARD_LOCK_TRIGGER = {
  'HL_THROUGH_WALL_LEAK': 'LOSS_OF_CONTAINMENT_IMMINENT',
  'HL_PRIMARY_CRACK': 'CODE_ALLOWABLE_EXCEEDED',
  'HL_SUPPORT_COLLAPSE': 'STRUCTURAL_INTEGRITY_LOST',
  'HL_FIRE_NO_VALIDATION': 'FIRE_DAMAGE_UNVALIDATED',
  'HL_MAJOR_DEFORMATION': 'STRUCTURAL_INTEGRITY_LOST',
  'HL_CRITICAL_WALL_LOSS': 'CODE_ALLOWABLE_EXCEEDED'
};

var HARD_LOCK_SEVERITY = {
  'HL_THROUGH_WALL_LEAK': 'CRITICAL',
  'HL_FIRE_NO_VALIDATION': 'CRITICAL',
  'HL_SUPPORT_COLLAPSE': 'CRITICAL',
  'HL_MAJOR_DEFORMATION': 'HIGH',
  'HL_PRIMARY_CRACK': 'HIGH',
  'HL_CRITICAL_WALL_LOSS': 'HIGH'
};

// Contract section 4.4 — hard_lock disposition → canonical safeStateOutput
var HARD_LOCK_SAFE_STATE = {
  'NO GO': 'REJECT_FROM_SERVICE',
  'NO_GO': 'REJECT_FROM_SERVICE',
  'REPAIR BEFORE RESTART': 'REPAIR',
  'REPAIR_BEFORE_RESTART': 'REPAIR',
  'HOLD FOR REVIEW': 'HOLD_FOR_INPUT',
  'HOLD_FOR_REVIEW': 'HOLD_FOR_INPUT'
};

// ============================================================================
// TRANSLATION TABLE 3 — CONTRADICTION TYPE MAPPING
// Contract section 3.3
// ============================================================================
var CONTRADICTION_TYPE = {
  'claim_vs_image': 'EVIDENCE_OBSERVATION_MISMATCH',
  'claim_vs_measurement': 'EVIDENCE_OBSERVATION_MISMATCH',
  'claim_vs_code': 'CODE_COMPLIANCE_VIOLATION',
  'mechanism_vs_environment': 'MECHANISM_ENVIRONMENT_MISMATCH',
  'mechanism_vs_material': 'MECHANISM_MATERIAL_MISMATCH',
  'method_vs_mechanism': 'METHOD_MECHANISM_MISMATCH',
  'disposition_vs_authority': 'DISPOSITION_AUTHORITY_CONFLICT',
  'disposition_vs_evidence': 'DISPOSITION_EVIDENCE_CONFLICT',
  'physics_violation': 'PHYSICS_VIOLATION',
  'compound_mechanism_unresolved': 'COMPOUND_MECHANISM_AMBIGUITY'
};

// ============================================================================
// TRANSLATION TABLE 4 — PROVENANCE VALUES
// Contract section 3.4
// ============================================================================
var PROVENANCE_VALUE = {
  'MEASURED': 'MEASURED',
  'OBSERVED': 'OBSERVED',
  'REPORTED': 'REPORTED',
  'INFERRED': 'INFERRED',
  'COMPUTED': 'COMPUTED',
  'UNVERIFIED': 'ASSUMED',
  'CONTRADICTED': 'ASSUMED'
};

var PROVENANCE_RANK = {
  'MEASURED': 6,
  'OBSERVED': 5,
  'REPORTED': 4,
  'INFERRED': 3,
  'COMPUTED': 3,
  'UNVERIFIED': 2,
  'ASSUMED': 1
};

// ============================================================================
// FALLBACK MAP — GOVERNING SEVERITY → FMD MARGIN
// Contract section 4.1
// ============================================================================
var SEVERITY_TO_MARGIN_FALLBACK = {
  'CRITICAL': 0.95,
  'SEVERE': 0.75,
  'HIGH': 0.55,
  'MODERATE': 0.30,
  'LOW': 0.10
};

// ============================================================================
// DETERMINISTIC HELPERS
// ============================================================================
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isArray(v) {
  return Array.isArray(v);
}

function safeGet(obj, path, fallback) {
  // path is an array of keys, e.g., ['decision_reality', 'disposition']
  var cur = obj;
  for (var i = 0; i < path.length; i = i + 1) {
    if (cur === null || cur === undefined) return fallback;
    cur = cur[path[i]];
  }
  return cur === undefined || cur === null ? fallback : cur;
}

function clamp(n, lo, hi) {
  if (typeof n !== 'number' || isNaN(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    var parts = [];
    for (var i = 0; i < value.length; i = i + 1) {
      parts.push(stableStringify(value[i]));
    }
    return '[' + parts.join(',') + ']';
  }
  var keys = Object.keys(value).sort();
  var entries = [];
  for (var k = 0; k < keys.length; k = k + 1) {
    entries.push(JSON.stringify(keys[k]) + ':' + stableStringify(value[keys[k]]));
  }
  return '{' + entries.join(',') + '}';
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function dedupeStringArray(arr) {
  if (!isArray(arr)) return [];
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i = i + 1) {
    var k = arr[i];
    if (typeof k !== 'string') continue;
    if (!seen[k]) {
      seen[k] = true;
      out.push(k);
    }
  }
  out.sort();
  return out;
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

// ---- Disposition + contradictions-from-divergence ----
function buildDisposition(inputs, sideEffectContradictions) {
  var dcVal = safeGet(inputs.decisionCore, ['decision_core', 'decision_reality', 'disposition'], null);
  var dpVal = safeGet(inputs.dispositionPathway, ['disposition'], null);

  var dcCanonical = dcVal && DISPOSITION_DECISION_CORE[dcVal] ? DISPOSITION_DECISION_CORE[dcVal] : null;
  var dpCanonical = dpVal && DISPOSITION_PATHWAY[dpVal] ? DISPOSITION_PATHWAY[dpVal] : null;

  if (dcCanonical && dpCanonical && dcCanonical !== dpCanonical) {
    // Conflict — emit a synthesized contradiction and pick the more conservative
    sideEffectContradictions.push({
      resolved: false,
      type: 'DISPOSITION_DIVERGENCE',
      category: 'assembler_synthesized',
      description:
        'decision_core disposition (' + dcCanonical +
        ') diverges from disposition_pathway (' + dpCanonical + '). Assembler selected more conservative.',
      severity: 'MAJOR'
    });
    return moreConservativeDisposition(dcCanonical, dpCanonical);
  }

  if (dcCanonical) return dcCanonical;
  if (dpCanonical) return dpCanonical;

  // Neither source produced a recognized disposition — degrade to HOLD_FOR_INPUT defensively
  sideEffectContradictions.push({
    resolved: false,
    type: 'DISPOSITION_UNRESOLVED',
    category: 'assembler_synthesized',
    description: 'Neither decision_core nor disposition_pathway emitted a recognized disposition value.',
    severity: 'CRITICAL'
  });
  return 'HOLD_FOR_INPUT';
}

// ---- Confidence ----
function buildConfidence(inputs) {
  var fromCore = safeGet(inputs.decisionCore, ['decision_core', 'reality_confidence', 'overall'], null);
  if (typeof fromCore === 'number') return clamp(fromCore, 0, 1);
  var fromSpine = safeGet(inputs, ['decisionSpine', 'unified_confidence'], null);
  if (typeof fromSpine === 'number') return clamp(fromSpine, 0, 1);
  return 0;
}

// ---- Recommended Method (single, unambiguous) ----
function buildRecommendedMethod(inputs) {
  var methods = safeGet(inputs.decisionCore, ['decision_core', 'inspection_reality', 'required_methods'], null);
  if (isArray(methods) && methods.length === 1) {
    var m = methods[0];
    if (typeof m === 'string') return m;
    if (isObject(m) && typeof m.method === 'string') return m.method;
  }
  return null;
}

// ---- FMD section ----
function buildFmd(inputs) {
  var fmd = inputs.failureModeDominance || {};
  var dcDamage = safeGet(inputs.decisionCore, ['decision_core', 'damage_reality'], {}) || {};

  var dominant = safeGet(dcDamage, ['primary_mechanism'], null) ||
                 safeGet(fmd, ['governing_failure_mode'], 'unspecified');

  // candidates — prefer validated_mechanisms with reality_score
  var validated = safeGet(dcDamage, ['validated_mechanisms'], null);
  var candidates = [];
  if (isArray(validated)) {
    for (var i = 0; i < validated.length; i = i + 1) {
      var v = validated[i];
      if (isObject(v)) {
        candidates.push({
          mechanism: v.mechanism || v.name || ('candidate_' + i),
          score: typeof v.reality_score === 'number' ? v.reality_score
               : typeof v.score === 'number' ? v.score : 0,
          reasoning: v.reasoning || v.basis || ''
        });
      } else if (typeof v === 'string') {
        candidates.push({ mechanism: v, score: 0, reasoning: '' });
      }
    }
    // Sort descending by score for deterministic ordering
    candidates.sort(function (a, b) { return b.score - a.score; });
  }

  // Fallback: build candidates from FMD's path arrays if validated_mechanisms is empty
  if (candidates.length === 0) {
    var pathArrays = ['corrosion_path', 'cracking_path', 'structural_path'];
    for (var p = 0; p < pathArrays.length; p = p + 1) {
      var arr = safeGet(fmd, [pathArrays[p]], null);
      if (isArray(arr)) {
        for (var j = 0; j < arr.length; j = j + 1) {
          var it = arr[j];
          if (isObject(it) && typeof it.mechanism === 'string') {
            candidates.push({
              mechanism: it.mechanism,
              score: typeof it.score === 'number' ? it.score : 0,
              reasoning: it.basis || ''
            });
          }
        }
      }
    }
    candidates.sort(function (a, b) { return b.score - a.score; });
  }

  // Margin derivation per contract section 4.1
  var margin;
  if (candidates.length < 2) {
    margin = 1.0;
  } else if (candidates[0].score > 0 || candidates[1].score > 0) {
    margin = clamp(candidates[0].score - candidates[1].score, 0, 1);
  } else {
    // No reality_score data — fall back to severity mapping
    var sev = safeGet(fmd, ['governing_severity'], 'MODERATE');
    margin = SEVERITY_TO_MARGIN_FALLBACK[sev];
    if (typeof margin !== 'number') margin = 0.30;
  }

  return {
    dominant: dominant,
    margin: margin,
    candidates: candidates,
    governingFailureMode: safeGet(fmd, ['governing_failure_mode'], null),
    governingSeverity: safeGet(fmd, ['governing_severity'], null)
  };
}

// ---- Timeline section ----
function buildTimeline(inputs) {
  var ft = inputs.failureTimeline || {};
  var fmd = inputs.failureModeDominance || {};

  var years = safeGet(ft, ['governing_time_years'], null);
  var days = (typeof years === 'number')
    ? clamp(Math.round(years * 365), 1, 36500)
    : 36500; // unknown → assume far future, but not infinite

  var rateControlling = computeRateControllingMechanism(ft);
  var compound = safeGet(fmd, ['governing_failure_mode'], '') === 'COMPOUND';

  return {
    timeToActionDays: days,
    rateControllingMechanism: rateControlling,
    compound: compound,
    governingTimeYears: typeof years === 'number' ? years : null,
    recommendedInspectionIntervalYears: safeGet(ft, ['recommended_inspection_interval_years'], null),
    urgency: safeGet(ft, ['urgency'], null),
    progressionState: safeGet(ft, ['progression_state'], null)
  };
}

// Contract section 4.3 — 0.6-fraction rate-control rule (Patent Claim 4)
function computeRateControllingMechanism(ft) {
  var timelines = [];
  var corrosion = safeGet(ft, ['corrosion_timeline'], null);
  var crack = safeGet(ft, ['crack_timeline'], null);

  if (isObject(corrosion) && typeof corrosion.time_to_action_years === 'number') {
    timelines.push({
      mechanism: corrosion.mechanism_name || 'corrosion',
      time: corrosion.time_to_action_years
    });
  }
  if (isObject(crack) && typeof crack.time_to_action_years === 'number') {
    timelines.push({
      mechanism: crack.mechanism_name || 'cracking',
      time: crack.time_to_action_years
    });
  }

  if (timelines.length === 0) return null;
  if (timelines.length === 1) return timelines[0].mechanism;

  // Sort ascending by time
  timelines.sort(function (a, b) { return a.time - b.time; });
  var fastest = timelines[0].time;
  var next = timelines[1].time;

  // Guard against zero or negative
  if (next <= 0) return timelines[0].mechanism;

  // 0.6-fraction rule
  if (fastest < 0.6 * next) {
    return timelines[0].mechanism;
  }
  return null; // joint envelope governs
}

// ---- Hard Locks section ----
function buildHardLocks(inputs) {
  var raw = safeGet(inputs.decisionCore, ['decision_core', 'decision_reality', 'hard_locks'], null);
  if (!isArray(raw)) return [];

  var out = [];
  for (var i = 0; i < raw.length; i = i + 1) {
    var hl = raw[i];
    if (!isObject(hl)) continue;
    var code = hl.code || 'HL_UNKNOWN';
    var trigger = HARD_LOCK_TRIGGER[code] || 'UNCLASSIFIED_HARD_LOCK';
    var severity = HARD_LOCK_SEVERITY[code] || 'HIGH';
    var dispNorm = (hl.disposition || '').toString().toUpperCase();
    var safeState = HARD_LOCK_SAFE_STATE[dispNorm] || 'HALT_AND_ESCALATE';

    out.push({
      trigger: trigger,
      code: code,
      safeStateOutput: safeState,
      severity: severity,
      reason: hl.reason || '',
      physicsBasis: hl.physics_basis || ''
    });
  }

  // Sort by (severity rank, code) for deterministic order
  var sevRank = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
  out.sort(function (a, b) {
    var ar = sevRank[a.severity] !== undefined ? sevRank[a.severity] : 9;
    var br = sevRank[b.severity] !== undefined ? sevRank[b.severity] : 9;
    if (ar !== br) return ar - br;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });

  return out;
}

// ---- Binding Clauses section ----
function buildBindingClauses(inputs) {
  var chain = safeGet(inputs.authorityLock, ['authority_chain'], null);
  if (!isArray(chain)) return [];

  var registry = inputs.codeAuthorityRegistry || null;

  var out = [];
  var seen = {};
  for (var i = 0; i < chain.length; i = i + 1) {
    var item = chain[i];
    if (!isObject(item)) continue;
    var code = item.code || item.standard || 'unspecified';
    var clause = item.clause || item.section || item.paragraph || '<unspecified>';
    var dedupeKey = code + '||' + clause;
    if (seen[dedupeKey]) continue;
    seen[dedupeKey] = true;

    var requirement = null;
    if (registry && typeof registry.lookup === 'function') {
      try {
        requirement = registry.lookup(code, clause);
      } catch (e) {
        requirement = null;
      }
    }
    if (!requirement) requirement = item.requirement || item.reason || item.text || '<no text available>';

    out.push({ code: code, clause: clause, requirement: requirement });
  }

  // Sort by (code, clause) for deterministic order (matches PIL's bindingClausesHash)
  out.sort(function (a, b) {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    return a.clause < b.clause ? -1 : a.clause > b.clause ? 1 : 0;
  });

  return out;
}

// ---- Contradictions section ----
function buildContradictions(inputs, synthesized) {
  var out = [];
  // Start with any contradictions the Assembler synthesized during disposition resolution
  for (var i = 0; i < synthesized.length; i = i + 1) {
    out.push(synthesized[i]);
  }

  var raw = safeGet(inputs.contradictionEngine, ['contradictions'], null);
  if (isArray(raw)) {
    for (var j = 0; j < raw.length; j = j + 1) {
      var c = raw[j];
      if (!isObject(c)) continue;
      var category = c.category || 'unspecified';
      var canonicalType = CONTRADICTION_TYPE[category] || 'UNCLASSIFIED_CONTRADICTION';
      out.push({
        resolved: typeof c.resolved === 'boolean' ? c.resolved : false,
        type: canonicalType,
        category: category,
        description: c.contradiction_description || c.description || '',
        severity: c.severity || 'INFORMATIONAL'
      });
    }
  }

  // Pull additional contradiction_flags (string[]) from decision_core.reality_confidence
  var flags = safeGet(inputs.decisionCore, ['decision_core', 'reality_confidence', 'contradiction_flags'], null);
  if (isArray(flags)) {
    for (var k = 0; k < flags.length; k = k + 1) {
      var flag = flags[k];
      if (typeof flag === 'string' && flag.length > 0) {
        out.push({
          resolved: false,
          type: 'UNCLASSIFIED_CONTRADICTION',
          category: 'reality_confidence_flag',
          description: flag,
          severity: 'INFORMATIONAL'
        });
      }
    }
  }

  return out;
}

// ---- Consequence section ----
function buildConsequence(inputs) {
  var cr = safeGet(inputs.decisionCore, ['decision_core', 'consequence_reality'], {}) || {};
  return {
    tier: cr.consequence_tier || 'LOW',
    humanImpact: cr.human_impact || null,
    enforcementRequirements: isArray(cr.enforcement_requirements) ? cr.enforcement_requirements : []
  };
}

// ---- Provenance section ----
function buildProvenance(inputs) {
  var ps = safeGet(inputs.evidenceProvenance, ['provenance_summary'], null);
  if (!isObject(ps)) {
    ps = safeGet(inputs.decisionCore, ['decision_core', 'evidence_provenance', 'provenance_summary'], {}) || {};
  }

  var dominantSource = ps.dominant_source || null;
  var trustBand = ps.trust_band || null;
  var measuredFraction = typeof ps.measured_fraction === 'number' ? ps.measured_fraction : null;

  // Compute lowestProvenance per contract section 4.7
  // Step 1: include dominant_source mapped via §3.4
  // Step 2: scan evidence items for the lowest individual provenance
  var observed = [];
  if (dominantSource) observed.push(dominantSource);

  var evidence = safeGet(inputs.evidenceProvenance, ['evidence'], null);
  if (isArray(evidence)) {
    for (var i = 0; i < evidence.length; i = i + 1) {
      var ev = evidence[i];
      if (isObject(ev) && typeof ev.provenance === 'string') {
        observed.push(ev.provenance);
      }
    }
  }

  if (observed.length === 0) {
    return {
      lowestProvenance: 'ASSUMED',
      dominantSource: null,
      trustBand: trustBand,
      measuredFraction: measuredFraction
    };
  }

  // Find the lowest-rank entry
  var lowest = 'MEASURED';
  var lowestRank = 999;
  for (var k = 0; k < observed.length; k = k + 1) {
    var canonical = PROVENANCE_VALUE[observed[k]] || 'ASSUMED';
    var rank = PROVENANCE_RANK[canonical];
    if (typeof rank !== 'number') rank = 1;
    if (rank < lowestRank) {
      lowestRank = rank;
      lowest = canonical;
    }
  }

  return {
    lowestProvenance: lowest,
    dominantSource: dominantSource,
    trustBand: trustBand,
    measuredFraction: measuredFraction
  };
}

// ---- Remaining Strength section ----
function buildRemainingStrength(inputs) {
  var rs = inputs.remainingStrength || {};
  var calcs = isObject(rs.calculations) ? rs.calculations : {};
  var rsf = (typeof calcs.modified_rsf === 'number') ? calcs.modified_rsf
          : (typeof calcs.b31g_rsf === 'number') ? calcs.b31g_rsf
          : null;

  return {
    rsf: rsf,
    mawp: typeof rs.governing_maop === 'number' ? rs.governing_maop : null,
    governingMaop: typeof rs.governing_maop === 'number' ? rs.governing_maop : null,
    governingMethod: rs.governing_method || null,
    severityTier: rs.severity_tier || null,
    pressureReductionRequired: rs.pressure_reduction_required === true
  };
}

// ---- Resolved environment + hazards ----
function buildResolvedEnvironment(inputs) {
  var env = safeGet(inputs.decisionCore, ['decision_core', 'physical_reality', 'environment'], {}) || {};
  var material = safeGet(inputs.decisionCore, ['decision_core', 'physical_reality', 'material'], null);
  var fmd = inputs.failureModeDominance || {};
  var consequence = safeGet(inputs.decisionCore, ['decision_core', 'consequence_reality'], {}) || {};

  var hazards = [];

  // Phase-based hazards
  var phases = isArray(env.phases_present) ? env.phases_present : [];
  for (var i = 0; i < phases.length; i = i + 1) {
    var phase = (phases[i] || '').toString().toUpperCase();
    if (phase === 'H2S') hazards.push('wet_h2s');
    if (phase === 'HYDROCARBON' || phase === 'HYDROCARBONS') hazards.push('hydrocarbon_service');
    if (phase === 'AMMONIA') hazards.push('ammonia_service');
    if (phase === 'CHLORIDE' || phase === 'CHLORIDES') hazards.push('chloride_service');
  }

  // Atmosphere-based hazards
  var atm = (env.atmosphere_class || '').toString().toUpperCase();
  if (atm === 'MARINE') hazards.push('marine_atmosphere');
  if (atm === 'OFFSHORE') hazards.push('offshore_environment');

  // Temperature-based hazards
  var temp = env.process_temperature_C || env.process_temp_c || null;
  if (typeof temp === 'number') {
    if (temp > 200) hazards.push('elevated_temperature');
    if (temp < -29) hazards.push('low_temperature_brittle_risk');
  }

  // Mechanism-implied hazards (HIC/SSC/SOHIC families)
  var crackPath = safeGet(fmd, ['cracking_path'], null);
  if (isArray(crackPath)) {
    for (var c = 0; c < crackPath.length; c = c + 1) {
      var item = crackPath[c];
      if (isObject(item)) {
        var mech = (item.mechanism || '').toString().toUpperCase();
        if (mech === 'HIC' || mech === 'SSC' || mech === 'SOHIC') {
          hazards.push('wet_h2s');
        }
      }
    }
  }

  // Personnel exposure
  if ((consequence.human_impact || '').toString().toUpperCase().indexOf('PERSONNEL') >= 0) {
    hazards.push('personnel_exposure_risk');
  }

  return {
    environment: {
      hazards: dedupeStringArray(hazards),
      phasesPresent: isArray(env.phases_present) ? env.phases_present.slice() : [],
      atmosphereClass: env.atmosphere_class || null
    },
    material: material
  };
}

// ---- Required Inspections section ----
function buildRequiredInspections(inputs) {
  var out = [];
  var seen = {};

  var fromPathway = safeGet(inputs.dispositionPathway, ['required_inspection_plan'], null);
  if (isArray(fromPathway)) {
    for (var i = 0; i < fromPathway.length; i = i + 1) {
      var rip = fromPathway[i];
      if (!isObject(rip)) continue;
      var method = rip.method || rip.name || ('inspection_' + i);
      if (seen[method]) continue;
      seen[method] = true;
      out.push({
        method: method,
        description: rip.description || (method + ' inspection per disposition_pathway'),
        coverage: rip.coverage || null,
        rationale: rip.rationale || rip.reason || null
      });
    }
  }

  var fromCore = safeGet(inputs.decisionCore, ['decision_core', 'inspection_reality', 'required_methods'], null);
  if (isArray(fromCore)) {
    for (var j = 0; j < fromCore.length; j = j + 1) {
      var rm = fromCore[j];
      var methodName = typeof rm === 'string' ? rm : (isObject(rm) ? (rm.method || rm.name || ('method_' + j)) : null);
      if (!methodName || seen[methodName]) continue;
      seen[methodName] = true;
      out.push({
        method: methodName,
        description: isObject(rm) && rm.description ? rm.description : (methodName + ' inspection per decision_core'),
        coverage: isObject(rm) ? (rm.coverage || null) : null,
        rationale: isObject(rm) ? (rm.rationale || rm.reason || null) : null
      });
    }
  }

  // Stable sort by method name
  out.sort(function (a, b) { return a.method < b.method ? -1 : a.method > b.method ? 1 : 0; });

  return out;
}

// ---- mustNotConclude — contract section 4.9 ----
function buildMustNotConclude(pkg) {
  var out = [];

  // Rule 1: ASSUMED provenance
  if (pkg.provenance && pkg.provenance.lowestProvenance === 'ASSUMED') {
    out.push('Do not finalize disposition until all ASSUMED inputs are upgraded to MEASURED or OBSERVED via targeted re-inspection.');
  }

  // Rule 2: FMD margin < 0.10
  if (pkg.fmd && typeof pkg.fmd.margin === 'number' && pkg.fmd.margin < 0.10) {
    out.push('Do not declare a single root cause until additional inspection data distinguishes between competing mechanisms.');
  }

  // Rule 3: confidence < 0.60
  if (typeof pkg.confidence === 'number' && pkg.confidence < 0.60) {
    out.push('Do not communicate this disposition with confidence — overall pipeline confidence is below 0.60. Treat as preliminary.');
  }

  // Rule 4: any unresolved contradictions
  var hasUnresolved = false;
  if (isArray(pkg.contradictions)) {
    for (var i = 0; i < pkg.contradictions.length; i = i + 1) {
      if (pkg.contradictions[i] && pkg.contradictions[i].resolved === false) {
        hasUnresolved = true;
        break;
      }
    }
  }
  if (hasUnresolved) {
    out.push('Do not act on this disposition while contradictions remain unresolved. Review and resolve before proceeding.');
  }

  // Rule 5: compound mechanism with no rate-controller
  if (pkg.timeline && pkg.timeline.compound === true && pkg.timeline.rateControllingMechanism === null) {
    out.push('Do not assume a single mechanism governs — compound mechanisms with no rate-controller. Joint envelope analysis required.');
  }

  // Rule 6: required inspections present and confidence below 0.70
  if (isArray(pkg.requiredInspections) && pkg.requiredInspections.length > 0 &&
      typeof pkg.confidence === 'number' && pkg.confidence < 0.70) {
    out.push('Do not finalize remaining-life calculation until the recommended inspection methods are executed and results integrated.');
  }

  // Rule 7: severe remaining-strength condition
  if (pkg.remainingStrength) {
    var sev = (pkg.remainingStrength.severityTier || '').toString().toUpperCase();
    if (sev.indexOf('REJECT') >= 0 || sev === 'TIER_4' || sev === 'TIER_4_REJECT' || pkg.remainingStrength.pressureReductionRequired === true) {
      out.push('Do not return to service. Pressure reduction or replacement required per remaining-strength assessment.');
    }
  }

  // Rule 8: hard locks present
  if (isArray(pkg.hardLocks) && pkg.hardLocks.length > 0) {
    out.push('Do not override hard-lock conditions. These are not subject to operational judgment.');
  }

  return out;
}

// ============================================================================
// HASH COMPUTATION — Contract section 5
// ============================================================================
function computePackageHash(pkg) {
  // Build a hashable copy: remove packageHash (about to be set) and projectionTimestamp
  // (set later by PIL, not part of decision identity)
  var copy = {};
  var keys = Object.keys(pkg);
  for (var i = 0; i < keys.length; i = i + 1) {
    var k = keys[i];
    if (k === 'packageHash' || k === 'projectionTimestamp') continue;
    copy[k] = pkg[k];
  }
  return sha256Hex(stableStringify(copy));
}

// ============================================================================
// MAIN ASSEMBLER
// ============================================================================
function assembleDecisionPackage(inputs) {
  if (!inputs || typeof inputs !== 'object') {
    throw new Error('assembleDecisionPackage: inputs object required');
  }
  if (!inputs.decisionCore) {
    var err1 = new Error('assembleDecisionPackage: missing required input field decisionCore');
    err1.assemblerError = 'MISSING_INPUT_FIELD';
    err1.field = 'decisionCore';
    throw err1;
  }
  if (!inputs.decisionTimestamp || typeof inputs.decisionTimestamp !== 'string') {
    var err2 = new Error('assembleDecisionPackage: missing required input field decisionTimestamp');
    err2.assemblerError = 'MISSING_INPUT_FIELD';
    err2.field = 'decisionTimestamp';
    throw err2;
  }

  // Side-channel for contradictions synthesized during translation (disposition divergence, etc.)
  var synthesizedContradictions = [];

  // Build each section
  var disposition = buildDisposition(inputs, synthesizedContradictions);
  var confidence = buildConfidence(inputs);
  var recommendedMethod = buildRecommendedMethod(inputs);
  var fmd = buildFmd(inputs);
  var timeline = buildTimeline(inputs);
  var hardLocks = buildHardLocks(inputs);
  var bindingClauses = buildBindingClauses(inputs);
  var contradictions = buildContradictions(inputs, synthesizedContradictions);
  var consequence = buildConsequence(inputs);
  var provenance = buildProvenance(inputs);
  var remainingStrength = buildRemainingStrength(inputs);
  var resolved = buildResolvedEnvironment(inputs);
  var requiredInspections = buildRequiredInspections(inputs);

  // Assemble (without packageHash and mustNotConclude yet — mustNotConclude depends on the assembled package)
  var pkg = {
    schemaVersion: SCHEMA_VERSION,
    packageId: inputs.caseId || safeGet(inputs.decisionCore, ['decision_core', 'case_id'], null) || 'unspecified',
    packageHash: null, // computed below
    decisionTimestamp: inputs.decisionTimestamp,
    packageTimestamp: inputs.decisionTimestamp,
    projectionTimestamp: null,
    disposition: disposition,
    confidence: confidence,
    recommendedMethod: recommendedMethod,
    fmd: fmd,
    timeline: timeline,
    hardLocks: hardLocks,
    bindingClauses: bindingClauses,
    contradictions: contradictions,
    consequence: consequence,
    provenance: provenance,
    remainingStrength: remainingStrength,
    resolved: resolved,
    requiredInspections: requiredInspections,
    mustNotConclude: [] // populated below
  };

  // mustNotConclude depends on the assembled package
  pkg.mustNotConclude = buildMustNotConclude(pkg);

  // Compute packageHash last
  pkg.packageHash = computePackageHash(pkg);

  return pkg;
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  assembleDecisionPackage: assembleDecisionPackage,
  // Exported for testing
  _internals: {
    stableStringify: stableStringify,
    sha256Hex: sha256Hex,
    computePackageHash: computePackageHash,
    moreConservativeDisposition: moreConservativeDisposition,
    computeRateControllingMechanism: computeRateControllingMechanism,
    DISPOSITION_DECISION_CORE: DISPOSITION_DECISION_CORE,
    DISPOSITION_PATHWAY: DISPOSITION_PATHWAY,
    HARD_LOCK_TRIGGER: HARD_LOCK_TRIGGER,
    HARD_LOCK_SEVERITY: HARD_LOCK_SEVERITY,
    HARD_LOCK_SAFE_STATE: HARD_LOCK_SAFE_STATE,
    CONTRADICTION_TYPE: CONTRADICTION_TYPE,
    PROVENANCE_VALUE: PROVENANCE_VALUE,
    PROVENANCE_RANK: PROVENANCE_RANK,
    SEVERITY_TO_MARGIN_FALLBACK: SEVERITY_TO_MARGIN_FALLBACK
  }
};
