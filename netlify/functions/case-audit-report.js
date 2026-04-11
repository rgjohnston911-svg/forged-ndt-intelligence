// ============================================================================
// FORGED NDT INTELLIGENCE OS — CASE AUDIT REPORT v1.0
// Netlify Function: case-audit-report
// DEPLOY: netlify/functions/case-audit-report.js
// ============================================================================
// PURPOSE: Build human-readable audit bundle for UI/PDF from all module outputs.
// ============================================================================

var handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    var body = JSON.parse(event.body);

    // ========================================================================
    // DEPLOY171.7: DOMAIN REFUSAL SHORT-CIRCUIT
    // ========================================================================
    var domainRefused = false;
    if (body.domain_not_supported === true) { domainRefused = true; }
    if (body.decision_core_result && body.decision_core_result.domain_not_supported === true) { domainRefused = true; }
    if (domainRefused) {
      var refusalHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json"
      };
      return {
        statusCode: 200,
        headers: refusalHeaders,
        body: JSON.stringify({
          domain_not_supported: true,
          refusal_reason: "Upstream decision-core refused this asset domain. Case audit report not generated.",
          audit_summary: {
            run_id: body.run_id || "unspecified",
            timestamp: new Date().toISOString(),
            modules_present: [],
            overall_confidence: "DOMAIN_NOT_SUPPORTED",
            reality_state: "DOMAIN_NOT_SUPPORTED",
            decision_class: "domain_not_supported",
            hardening_version: "1.0-deploy171.7"
          },
          trace_cards: [],
          gaps: [],
          confidence_breakdown: null,
          engine_version: "case-audit-report-v1.0-deploy171.7"
        })
      };
    }

    var challengeResult = body.challenge_result || null;
    var unknownStateResult = body.unknown_state_result || null;
    var decisionCoreResult = body.decision_core_result || null;
    var provenanceResult = body.evidence_provenance_result || null;
    var contradictionResult = body.contradiction_result || null;

    // ---- BUILD AUDIT SUMMARY ----
    var auditSummary = {
      run_id: body.run_id || 'unspecified',
      timestamp: new Date().toISOString(),
      modules_present: [],
      overall_confidence: 'unknown',
      reality_state: 'unknown',
      decision_class: 'unknown',
      hardening_version: '1.0'
    };

    if (challengeResult) { auditSummary.modules_present.push('reality_challenge_v1'); }
    if (unknownStateResult) { auditSummary.modules_present.push('unknown_state_v1'); }
    if (decisionCoreResult) { auditSummary.modules_present.push('decision_core'); }
    if (provenanceResult) { auditSummary.modules_present.push('evidence_provenance'); }
    if (contradictionResult) { auditSummary.modules_present.push('contradiction_engine'); }

    if (unknownStateResult) {
      auditSummary.reality_state = unknownStateResult.reality_state || 'unknown';
    }
    if (challengeResult && challengeResult.primary_reality_hypothesis) {
      auditSummary.overall_confidence = challengeResult.primary_reality_hypothesis.confidence;
    }
    if (decisionCoreResult && decisionCoreResult.decision) {
      auditSummary.decision_class = decisionCoreResult.decision;
    }

    // ---- BUILD TRACE CARDS ----
    var traceCards = [];

    // Card 1: Reality Challenge Trace
    if (challengeResult) {
      traceCards.push({
        card_id: 'reality_challenge',
        card_title: 'Reality Challenge Engine',
        card_type: 'trace',
        status: challengeResult.challenge_triggered ? 'ACTIVE' : 'CLEAR',
        summary: challengeResult.challenge_triggered
          ? 'Challenge triggered — ' + challengeResult.alternate_hypotheses.length + ' alternate hypotheses generated. Recommendation: ' + challengeResult.reality_lock_recommendation
          : 'No significant ambiguity detected. Primary interpretation accepted.',
        ambiguity_score: challengeResult.ambiguity_score || 0,
        flags: challengeResult.ambiguity_flags || [],
        trace: challengeResult.challenge_reasoning_trace || [],
        recommendation: challengeResult.reality_lock_recommendation || 'accept_primary'
      });
    }

    // Card 2: Unknown State Trace
    if (unknownStateResult) {
      traceCards.push({
        card_id: 'unknown_state',
        card_title: 'Unknown State Engine',
        card_type: 'state',
        status: unknownStateResult.unknown_triggered ? unknownStateResult.reality_state : 'RESOLVED',
        summary: unknownStateResult.unknown_triggered
          ? 'Unknown state active — ' + unknownStateResult.unknown_reason_codes.length + ' reason codes. ' + (unknownStateResult.unknown_blocks_final_disposition ? 'BLOCKS final disposition.' : 'Does not block disposition.')
          : 'All required data present. No unknown state triggered.',
        reason_codes: unknownStateResult.unknown_reason_codes || [],
        unresolved_questions: unknownStateResult.unresolved_questions || [],
        blocked_questions: unknownStateResult.blocked_questions || [],
        blocks_disposition: unknownStateResult.unknown_blocks_final_disposition || false
      });
    }

    // Card 3: Provenance Trace
    if (provenanceResult) {
      traceCards.push({
        card_id: 'evidence_provenance',
        card_title: 'Evidence Provenance',
        card_type: 'trust',
        status: (provenanceResult.overall_trust_score || 0) >= 0.7 ? 'TRUSTED' : 'LOW_TRUST',
        summary: 'Overall provenance trust: ' + ((provenanceResult.overall_trust_score || 0) * 100).toFixed(0) + '%',
        trust_score: provenanceResult.overall_trust_score || 0,
        trace: provenanceResult.provenance_trace || []
      });
    }

    // Card 4: Contradiction Trace
    if (contradictionResult) {
      var contrScore = contradictionResult.contradiction_score || contradictionResult.score || 0;
      traceCards.push({
        card_id: 'contradiction',
        card_title: 'Contradiction Engine',
        card_type: 'conflict',
        status: contrScore > 0.4 ? 'CONTRADICTIONS_FOUND' : 'CLEAR',
        summary: contrScore > 0.4
          ? 'Contradiction score: ' + (contrScore * 100).toFixed(0) + '% — review required'
          : 'No significant contradictions detected.',
        contradiction_score: contrScore,
        trace: contradictionResult.contradiction_trace || contradictionResult.trace || []
      });
    }

    // ---- CONFIDENCE EXPLANATION ----
    var confidenceExplanation = {
      overall_confidence: auditSummary.overall_confidence,
      factors: []
    };

    if (challengeResult) {
      if (challengeResult.challenge_triggered) {
        confidenceExplanation.factors.push({
          factor: 'Reality Challenge',
          effect: 'reduces',
          detail: 'Ambiguity score ' + (challengeResult.ambiguity_score || 0).toFixed(2) + ' triggered alternate hypothesis generation'
        });
      }
      if (challengeResult.highest_risk_plausible_hypothesis) {
        confidenceExplanation.factors.push({
          factor: 'Higher-Risk Alternate',
          effect: 'reduces',
          detail: challengeResult.highest_risk_plausible_hypothesis.reason
        });
      }
    }

    if (unknownStateResult && unknownStateResult.unknown_triggered) {
      confidenceExplanation.factors.push({
        factor: 'Unknown State',
        effect: 'reduces',
        detail: unknownStateResult.unknown_reason_codes.length + ' unresolved data requirements'
      });
    }

    if (provenanceResult && (provenanceResult.overall_trust_score || 1) < 0.7) {
      confidenceExplanation.factors.push({
        factor: 'Evidence Provenance',
        effect: 'reduces',
        detail: 'Provenance trust at ' + ((provenanceResult.overall_trust_score || 0) * 100).toFixed(0) + '%'
      });
    }

    // ---- HOLD/UNKNOWN EXPLANATION ----
    var holdOrUnknownExplanation = null;
    if (unknownStateResult && unknownStateResult.unknown_triggered) {
      holdOrUnknownExplanation = {
        state: unknownStateResult.reality_state,
        blocks_disposition: unknownStateResult.unknown_blocks_final_disposition,
        reason_summary: unknownStateResult.unknown_reason_codes.join(', '),
        what_is_needed: unknownStateResult.minimum_data_required || [],
        next_actions: unknownStateResult.next_best_inspection_actions || []
      };
    }

    // ---- TRUSTED FACT SUMMARY ----
    var trustedFactSummary = {
      total_facts: 0,
      trusted_count: 0,
      deweighted_count: 0,
      discarded_count: 0,
      facts: []
    };
    if (body.trusted_facts && Array.isArray(body.trusted_facts)) {
      trustedFactSummary.total_facts = body.trusted_facts.length;
      for (var tf = 0; tf < body.trusted_facts.length; tf++) {
        var fact = body.trusted_facts[tf];
        if (fact.trust_weight >= 0.7) {
          trustedFactSummary.trusted_count++;
        } else if (fact.trust_weight >= 0.3) {
          trustedFactSummary.deweighted_count++;
        } else {
          trustedFactSummary.discarded_count++;
        }
        trustedFactSummary.facts.push({
          field: fact.field,
          value: fact.value,
          provenance: fact.provenance,
          trust_weight: fact.trust_weight
        });
      }
    }

    // ---- WHY SYSTEM THINKS THIS ----
    var whyDecision = [];
    if (decisionCoreResult) {
      if (decisionCoreResult.hard_locks && decisionCoreResult.hard_locks.length > 0) {
        for (var hl = 0; hl < decisionCoreResult.hard_locks.length; hl++) {
          whyDecision.push('Hard Lock: ' + decisionCoreResult.hard_locks[hl]);
        }
      }
      if (decisionCoreResult.decision_basis) {
        whyDecision.push('Decision Basis: ' + decisionCoreResult.decision_basis);
      }
    }
    if (challengeResult && challengeResult.reality_lock_recommendation) {
      whyDecision.push('Reality Challenge Recommendation: ' + challengeResult.reality_lock_recommendation);
    }
    if (unknownStateResult && unknownStateResult.reality_state) {
      whyDecision.push('Reality State: ' + unknownStateResult.reality_state);
    }

    // ---- WHAT WOULD CHANGE THIS DECISION ----
    var whatChanges = [];
    if (unknownStateResult && unknownStateResult.minimum_data_required) {
      for (var md = 0; md < unknownStateResult.minimum_data_required.length; md++) {
        whatChanges.push({
          change: 'Provide: ' + unknownStateResult.minimum_data_required[md].required_data,
          impact: 'Could resolve: ' + unknownStateResult.minimum_data_required[md].question,
          priority: unknownStateResult.minimum_data_required[md].priority
        });
      }
    }
    if (challengeResult && challengeResult.highest_risk_plausible_hypothesis) {
      whatChanges.push({
        change: 'Rule out alternate mechanism: ' + challengeResult.highest_risk_plausible_hypothesis.hypothesis_id,
        impact: 'Would increase primary confidence and may change recommendation',
        priority: 'high'
      });
    }

    // ---- ASSEMBLE FINAL BUNDLE ----
    var auditBundle = {
      audit_summary: auditSummary,
      trace_cards: traceCards,
      confidence_explanation: confidenceExplanation,
      hold_or_unknown_explanation: holdOrUnknownExplanation,
      trusted_fact_summary: trustedFactSummary,
      why_this_decision: whyDecision,
      what_changes_decision: whatChanges
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auditBundle)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Case Audit Report error: ' + (err.message || 'unknown')
      })
    };
  }
};

module.exports = { handler: handler };
