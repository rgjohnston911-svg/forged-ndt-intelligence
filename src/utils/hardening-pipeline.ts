// ============================================================================
// FORGED NDT INTELLIGENCE OS — HARDENING PIPELINE v1.0
// src/utils/hardening-pipeline.ts
// ============================================================================

import type {
  RealityChallengeResult,
  UnknownStateResult,
  TrustedFact
} from '../hardening-types';

import { sbInsert, sbUpdate, generateId } from './supabase';

// ============================================================================
// FUNCTION CALLERS
// ============================================================================

export async function callRealityChallenge(
  transcript: string,
  parsedIncident: any,
  resolvedAsset: any,
  grammarBridgeResult: any,
  evidenceProvenanceResult: any
): Promise<RealityChallengeResult> {
  try {
    var response = await fetch('/.netlify/functions/reality-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcript,
        parsed_incident: parsedIncident,
        resolved_asset: resolvedAsset,
        grammar_bridge_result: grammarBridgeResult,
        evidence_provenance_result: evidenceProvenanceResult
      })
    });

    if (!response.ok) {
      throw new Error('Reality Challenge returned ' + response.status);
    }

    return await response.json();
  } catch (err: any) {
    console.error('[HardeningPipeline] Reality Challenge error:', err);
    return {
      primary_reality_hypothesis: {
        asset_class: 'unknown',
        scenario_type: 'unknown',
        finding_frame: 'unknown',
        mechanism_frame: 'unknown',
        confidence: 0.5,
        basis: ['Fallback — Reality Challenge Engine unavailable']
      },
      alternate_hypotheses: [],
      highest_risk_plausible_hypothesis: null,
      ambiguity_flags: ['ENGINE_UNAVAILABLE'],
      ambiguity_score: 0,
      challenge_triggered: false,
      reality_lock_recommendation: 'accept_primary',
      challenge_reasoning_trace: ['Reality Challenge Engine call failed: ' + (err.message || 'unknown')]
    };
  }
}

export async function callUnknownState(
  challengeResult: RealityChallengeResult,
  evidenceProvenanceResult: any,
  damageResult: any,
  methodSufficiencyResult: any,
  authorityResult: any,
  contradictionResult: any,
  consequenceResult: any
): Promise<UnknownStateResult> {
  try {
    var response = await fetch('/.netlify/functions/unknown-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_result: challengeResult,
        evidence_provenance_result: evidenceProvenanceResult,
        damage_result: damageResult,
        method_sufficiency_result: methodSufficiencyResult,
        authority_result: authorityResult,
        contradiction_result: contradictionResult,
        consequence_result: consequenceResult
      })
    });

    if (!response.ok) {
      throw new Error('Unknown State returned ' + response.status);
    }

    return await response.json();
  } catch (err: any) {
    console.error('[HardeningPipeline] Unknown State error:', err);
    return {
      reality_state: 'UNKNOWN',
      unknown_triggered: true,
      unknown_reason_codes: ['ENGINE_ERROR'],
      unresolved_questions: ['Unknown State Engine unavailable — manual evaluation required'],
      blocked_questions: [],
      minimum_data_required: [],
      next_best_inspection_actions: [],
      unknown_blocks_final_disposition: false
    };
  }
}

export async function callCaseAuditReport(
  challengeResult: RealityChallengeResult | null,
  unknownStateResult: UnknownStateResult | null,
  decisionCoreResult: any,
  evidenceProvenanceResult: any,
  contradictionResult: any,
  trustedFacts: TrustedFact[],
  runId: string
): Promise<any> {
  try {
    var response = await fetch('/.netlify/functions/case-audit-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_result: challengeResult,
        unknown_state_result: unknownStateResult,
        decision_core_result: decisionCoreResult,
        evidence_provenance_result: evidenceProvenanceResult,
        contradiction_result: contradictionResult,
        trusted_facts: trustedFacts,
        run_id: runId
      })
    });

    if (!response.ok) {
      throw new Error('Case Audit Report returned ' + response.status);
    }

    return await response.json();
  } catch (err: any) {
    console.error('[HardeningPipeline] Case Audit Report error:', err);
    return null;
  }
}

// ============================================================================
// TRUSTED FACT EXTRACTOR
// ============================================================================

export function extractTrustedFacts(
  parsedIncident: any,
  grammarBridgeResult: any,
  evidenceProvenanceResult: any
): TrustedFact[] {
  var facts: TrustedFact[] = [];

  if (parsedIncident) {
    if (parsedIncident.asset_type) {
      facts.push({
        field: 'asset_type',
        value: parsedIncident.asset_type,
        provenance: 'reported',
        trust_weight: 0.7
      });
    }
    if (parsedIncident.finding_type) {
      facts.push({
        field: 'finding_type',
        value: parsedIncident.finding_type,
        provenance: 'reported',
        trust_weight: 0.7
      });
    }
    if (parsedIncident.primary_mechanism) {
      facts.push({
        field: 'primary_mechanism',
        value: parsedIncident.primary_mechanism,
        provenance: 'inferred',
        trust_weight: 0.5
      });
    }
  }

  if (grammarBridgeResult && grammarBridgeResult.extracted_fields) {
    var fields = grammarBridgeResult.extracted_fields;
    if (fields.thickness_reading !== undefined) {
      facts.push({
        field: 'thickness_reading',
        value: String(fields.thickness_reading),
        provenance: 'measured',
        trust_weight: 0.9
      });
    }
    if (fields.nominal_thickness !== undefined) {
      facts.push({
        field: 'nominal_thickness',
        value: String(fields.nominal_thickness),
        provenance: 'documented',
        trust_weight: 0.85
      });
    }
    if (fields.material) {
      facts.push({
        field: 'material',
        value: fields.material,
        provenance: 'reported',
        trust_weight: 0.7
      });
    }
    if (fields.diameter) {
      facts.push({
        field: 'diameter',
        value: String(fields.diameter),
        provenance: 'reported',
        trust_weight: 0.7
      });
    }
    if (fields.location) {
      facts.push({
        field: 'location',
        value: fields.location,
        provenance: 'reported',
        trust_weight: 0.7
      });
    }
    if (fields.clock_position) {
      facts.push({
        field: 'clock_position',
        value: fields.clock_position,
        provenance: 'observed',
        trust_weight: 0.8
      });
    }
    if (fields.nde_method) {
      facts.push({
        field: 'nde_method',
        value: fields.nde_method,
        provenance: 'observed',
        trust_weight: 0.9
      });
    }
  }

  if (evidenceProvenanceResult && evidenceProvenanceResult.overall_trust_score !== undefined) {
    var trustMultiplier = evidenceProvenanceResult.overall_trust_score;
    if (trustMultiplier < 0.7) {
      for (var i = 0; i < facts.length; i++) {
        if (facts[i].provenance === 'reported' || facts[i].provenance === 'inferred') {
          facts[i].trust_weight = facts[i].trust_weight * trustMultiplier;
        }
      }
    }
  }

  return facts;
}

// ============================================================================
// SUPABASE PERSISTENCE (using sbInsert / sbUpdate from supabase.ts)
// ============================================================================

export async function persistHardeningSnapshot(
  caseId: string,
  runId: string,
  challengeResult: RealityChallengeResult,
  unknownStateResult: UnknownStateResult
): Promise<boolean> {
  try {
    await sbInsert('case_hardening_snapshots', {
      id: generateId(),
      case_id: caseId,
      run_id: runId,
      challenge_result: challengeResult,
      unknown_state_result: unknownStateResult
    });
    return true;
  } catch (err) {
    console.error('[HardeningPipeline] Snapshot persist error:', err);
    return false;
  }
}

export async function persistTrustedFacts(
  caseId: string,
  runId: string,
  facts: TrustedFact[]
): Promise<boolean> {
  if (!facts || facts.length === 0) return true;

  try {
    for (var i = 0; i < facts.length; i++) {
      var fact = facts[i];
      var status = 'trusted';
      if (fact.trust_weight < 0.3) {
        status = 'discarded';
      } else if (fact.trust_weight < 0.7) {
        status = 'deweighted';
      }

      await sbInsert('case_trusted_facts', {
        id: generateId(),
        case_id: caseId,
        run_id: runId,
        field_name: fact.field,
        field_value: fact.value,
        provenance_class: fact.provenance,
        trust_weight: fact.trust_weight,
        status: status
      });
    }
    return true;
  } catch (err) {
    console.error('[HardeningPipeline] Trusted facts persist error:', err);
    return false;
  }
}

export async function updateCaseHardeningState(
  caseId: string,
  runId: string,
  unknownStateResult: UnknownStateResult,
  challengeResult: RealityChallengeResult
): Promise<boolean> {
  try {
    var confidence = 0;
    if (challengeResult.primary_reality_hypothesis && challengeResult.primary_reality_hypothesis.confidence !== undefined) {
      confidence = challengeResult.primary_reality_hypothesis.confidence;
    }
    var confidenceBand = 'unknown';
    if (confidence >= 0.85) { confidenceBand = 'high'; }
    else if (confidence >= 0.6) { confidenceBand = 'moderate'; }
    else if (confidence >= 0.35) { confidenceBand = 'low'; }
    else { confidenceBand = 'very_low'; }

    await sbUpdate('cases', caseId, {
      latest_reality_state: unknownStateResult.reality_state,
      unknown_triggered: unknownStateResult.unknown_triggered,
      latest_confidence_band: confidenceBand,
      latest_run_id: runId
    });
    return true;
  } catch (err) {
    console.error('[HardeningPipeline] Case update error:', err);
    return false;
  }
}

// ============================================================================
// FULL HARDENING PIPELINE RUNNER
// ============================================================================

export interface HardeningPipelineResult {
  challengeResult: RealityChallengeResult;
  unknownStateResult: UnknownStateResult;
  trustedFacts: TrustedFact[];
  auditReport: any;
  runId: string;
}

export async function runHardeningPipeline(
  transcript: string,
  parsedIncident: any,
  resolvedAsset: any,
  grammarBridgeResult: any,
  evidenceProvenanceResult: any,
  damageResult: any,
  methodSufficiencyResult: any,
  authorityResult: any,
  contradictionResult: any,
  consequenceResult: any,
  decisionCoreResult: any,
  caseId?: string
): Promise<HardeningPipelineResult> {
  var runId = generateId();

  var trustedFacts = extractTrustedFacts(
    parsedIncident, grammarBridgeResult, evidenceProvenanceResult
  );

  var challengeResult = await callRealityChallenge(
    transcript, parsedIncident, resolvedAsset,
    grammarBridgeResult, evidenceProvenanceResult
  );

  var unknownStateResult = await callUnknownState(
    challengeResult, evidenceProvenanceResult, damageResult,
    methodSufficiencyResult, authorityResult,
    contradictionResult, consequenceResult
  );

  var auditReport = await callCaseAuditReport(
    challengeResult, unknownStateResult, decisionCoreResult,
    evidenceProvenanceResult, contradictionResult,
    trustedFacts, runId
  );

  if (caseId) {
    await persistHardeningSnapshot(caseId, runId, challengeResult, unknownStateResult);
    await persistTrustedFacts(caseId, runId, trustedFacts);
    await updateCaseHardeningState(caseId, runId, unknownStateResult, challengeResult);
  }

  return {
    challengeResult: challengeResult,
    unknownStateResult: unknownStateResult,
    trustedFacts: trustedFacts,
    auditReport: auditReport,
    runId: runId
  };
}
