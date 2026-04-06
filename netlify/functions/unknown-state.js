// ============================================================================
// FORGED NDT INTELLIGENCE OS — UNKNOWN STATE + MINIMUM DATA ENGINE v1.0
// Netlify Function: unknown-state
// DEPLOY129b: netlify/functions/unknown-state.js
// ============================================================================
// PURPOSE: Evaluate reality state of the inspection assessment.
// Determines if enough is known to disposition, identifies gaps,
// generates minimum data requirements and next-best inspection actions.
// DETERMINISTIC — no AI calls. Pure logic from structured inputs.
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY
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
    var challengeResult = body.challenge_result || {};
    var provenance = body.evidence_provenance_result || {};
    var damageResult = body.damage_result || {};
    var methodSufficiency = body.method_sufficiency_result || {};
    var authorityResult = body.authority_result || {};
    var contradictionResult = body.contradiction_result || {};
    var consequenceResult = body.consequence_result || {};

    // ---- COLLECT REASON CODES ----
    var reasonCodes = [];
    var unresolvedQuestions = [];
    var blockedQuestions = [];
    var minimumData = [];
    var nextActions = [];
    var actionCounter = 0;

    // ---- EVALUATE EVIDENCE PROVENANCE ----
    var provSummary = provenance.provenance_summary || provenance;
    var trustBand = provSummary.trust_band || 'UNKNOWN';
    var compositeTrust = provSummary.composite_trust_score || 0;
    var measuredFraction = provSummary.measured_fraction || 0;

    if (trustBand === 'LOW' || compositeTrust < 0.45) {
      reasonCodes.push('LOW_EVIDENCE_TRUST');
      unresolvedQuestions.push('Evidence trust band is LOW (' + Math.round(compositeTrust * 100) + '%) — most claims are inferred or reported, not measured');
      minimumData.push({
        question: 'Can inspection evidence be upgraded from inferred/reported to measured?',
        required_data: 'Calibrated NDE measurement results for primary damage claims',
        preferred_method: 'UT thickness + PAUT/TOFD for crack sizing',
        reason: 'Measured evidence carries trust weight 1.0 vs reported 0.6 or inferred 0.45',
        priority: 'critical'
      });
    }

    if (measuredFraction < 0.2) {
      reasonCodes.push('INSUFFICIENT_MEASURED_DATA');
      unresolvedQuestions.push('Only ' + Math.round(measuredFraction * 100) + '% of evidence is from calibrated measurements');
    }

    // ---- EVALUATE METHOD ADEQUACY ----
    var methodAdequacy = provSummary.method_adequacy || 'UNKNOWN';
    var realityGaps = provenance.measurement_reality_gaps || provSummary.measurement_reality_gaps || [];

    if (methodAdequacy === 'INADEQUATE' || methodAdequacy === 'PARTIALLY_ADEQUATE') {
      reasonCodes.push('METHOD_GAPS');
      for (var gi = 0; gi < realityGaps.length; gi++) {
        var gap = realityGaps[gi];
        var gapText = typeof gap === 'string' ? gap : (gap.question || gap.gap || JSON.stringify(gap));
        unresolvedQuestions.push('Method gap: ' + gapText);
      }
    }

    // ---- EVALUATE DAMAGE STATE ----
    if (damageResult) {
      var damageState = damageResult.damage_state || '';
      var damageConfidence = damageResult.damage_confidence || 0;

      if (damageConfidence < 0.5) {
        reasonCodes.push('LOW_DAMAGE_CONFIDENCE');
        unresolvedQuestions.push('Damage characterization confidence is only ' + Math.round(damageConfidence * 100) + '%');
        minimumData.push({
          question: 'What is the actual damage mechanism and extent?',
          required_data: 'Quantitative damage measurements (depth, length, distribution)',
          preferred_method: 'UT grid scan for wall loss + MT/PT for surface cracking',
          reason: 'Current damage confidence (' + Math.round(damageConfidence * 100) + '%) insufficient for disposition',
          priority: 'critical'
        });
      }

      // Check for mixed damage modes
      var thinningScore = damageResult.thinning_score || damageResult.thinning_plausibility || 0;
      var crackingScore = damageResult.cracking_score || damageResult.cracking_plausibility || 0;

      if (thinningScore > 0.4 && crackingScore > 0.4) {
        reasonCodes.push('MIXED_DAMAGE_MODES');
        unresolvedQuestions.push('Both thinning (' + Math.round(thinningScore * 100) + '%) and cracking (' + Math.round(crackingScore * 100) + '%) are plausible — different inspection approaches required');
        blockedQuestions.push('Cannot determine single dominant mechanism without additional NDE');
        minimumData.push({
          question: 'Is the damage primarily volumetric (corrosion) or planar (cracking)?',
          required_data: 'Surface NDE for crack confirmation + volumetric NDE for wall loss mapping',
          preferred_method: 'MT for surface cracks + PAUT for subsurface + UT grid for corrosion extent',
          reason: 'Mixed damage modes require different disposition pathways',
          priority: 'critical'
        });
      }
    }

    // ---- EVALUATE CONSEQUENCE ----
    if (consequenceResult) {
      var consequenceTier = consequenceResult.consequence_tier || '';
      var failureMode = consequenceResult.failure_mode || '';

      if (consequenceTier === 'CRITICAL' || consequenceTier === 'SEVERE') {
        // High consequence raises the bar for what we need to know
        if (reasonCodes.length > 0) {
          reasonCodes.push('HIGH_CONSEQUENCE_WITH_GAPS');
          blockedQuestions.push(consequenceTier + ' consequence asset with unresolved evidence gaps — disposition blocked until gaps resolved');
        }
      }
    }

    // ---- EVALUATE CONTRADICTIONS ----
    if (contradictionResult) {
      var contradictions = contradictionResult.contradictions || contradictionResult.conflicts || [];
      if (typeof contradictionResult === 'string' && contradictionResult.indexOf('CONFLICT') !== -1) {
        reasonCodes.push('UNRESOLVED_CONTRADICTIONS');
        unresolvedQuestions.push('Decision core flagged contradictions that require resolution');
      } else if (contradictions.length > 0) {
        reasonCodes.push('UNRESOLVED_CONTRADICTIONS');
        for (var ci = 0; ci < Math.min(contradictions.length, 3); ci++) {
          var cont = contradictions[ci];
          unresolvedQuestions.push('Contradiction: ' + (typeof cont === 'string' ? cont : (cont.description || cont.conflict || JSON.stringify(cont))));
        }
      }
    }

    // ---- EVALUATE AUTHORITY GAPS ----
    if (authorityResult) {
      var authorityWarnings = authorityResult.warnings || [];
      var missingAuthorities = authorityResult.missing_authorities || [];

      if (typeof authorityResult === 'string' && authorityResult.indexOf('WARNING') !== -1) {
        reasonCodes.push('AUTHORITY_GAPS');
        unresolvedQuestions.push('Authority chain has gaps or warnings — code coverage may be incomplete');
      }

      for (var ai = 0; ai < missingAuthorities.length; ai++) {
        unresolvedQuestions.push('Missing authority: ' + missingAuthorities[ai]);
      }
    }

    // ---- EVALUATE CHALLENGE RESULT ----
    if (challengeResult.challenge_triggered) {
      if (challengeResult.ambiguity_score >= 0.50) {
        reasonCodes.push('HIGH_AMBIGUITY');
        unresolvedQuestions.push('Reality Challenge ambiguity score: ' + Math.round(challengeResult.ambiguity_score * 100) + '% — primary interpretation significantly challenged');
      }

      if (challengeResult.highest_risk_plausible_hypothesis) {
        var hrh = challengeResult.highest_risk_plausible_hypothesis;
        unresolvedQuestions.push('Higher-risk alternate hypothesis: ' + hrh.reason);
      }

      var altFlags = challengeResult.ambiguity_flags || [];
      for (var afi = 0; afi < altFlags.length; afi++) {
        if (altFlags[afi] === 'SOUR_SERVICE_CRACKING') {
          reasonCodes.push('SOUR_SERVICE_UNVERIFIED');
          blockedQuestions.push('Sour service cracking (SSC/HIC) must be ruled out before disposition');
          minimumData.push({
            question: 'Is cracking mechanism SSC, HIC, or fatigue?',
            required_data: 'Crack morphology analysis (branching pattern, orientation, location relative to welds)',
            preferred_method: 'Metallographic examination or in-situ replica + hardness survey',
            reason: 'SSC/HIC require different engineering assessment than fatigue cracking',
            priority: 'high'
          });
        }
      }
    }

    // ---- GENERATE NEXT BEST INSPECTION ACTIONS ----
    // Based on identified gaps

    if (reasonCodes.indexOf('INSUFFICIENT_MEASURED_DATA') !== -1 || reasonCodes.indexOf('LOW_EVIDENCE_TRUST') !== -1) {
      actionCounter++;
      nextActions.push({
        action_id: 'ACTION_' + actionCounter,
        method: 'UT Thickness Grid',
        target: 'Primary damage areas identified in field report',
        purpose: 'Upgrade wall loss evidence from reported to measured',
        release_condition: 'Grid data establishes measured wall thickness profile'
      });
    }

    if (reasonCodes.indexOf('MIXED_DAMAGE_MODES') !== -1 || reasonCodes.indexOf('SOUR_SERVICE_UNVERIFIED') !== -1) {
      actionCounter++;
      nextActions.push({
        action_id: 'ACTION_' + actionCounter,
        method: 'MT (Magnetic Particle Testing)',
        target: 'Pit clusters and areas with suspected cracking indications',
        purpose: 'Confirm or rule out surface-breaking cracks at pitting sites',
        release_condition: 'MT confirms crack presence/absence at identified locations'
      });

      actionCounter++;
      nextActions.push({
        action_id: 'ACTION_' + actionCounter,
        method: 'PAUT (Phased Array Ultrasonic Testing)',
        target: 'Areas with confirmed or suspected cracking',
        purpose: 'Size any confirmed cracks for fitness-for-service assessment',
        release_condition: 'Crack depth and length measured for FFS input'
      });
    }

    if (reasonCodes.indexOf('METHOD_GAPS') !== -1) {
      actionCounter++;
      nextActions.push({
        action_id: 'ACTION_' + actionCounter,
        method: 'Supplemental NDE per gap analysis',
        target: 'Identified measurement reality gaps',
        purpose: 'Close specific method gaps identified by provenance engine',
        release_condition: 'All critical reality gaps resolved with measured data'
      });
    }

    if (reasonCodes.indexOf('AUTHORITY_GAPS') !== -1) {
      actionCounter++;
      nextActions.push({
        action_id: 'ACTION_' + actionCounter,
        method: 'Engineering Review',
        target: 'Authority chain and code applicability',
        purpose: 'Confirm governing codes and FFS requirements',
        release_condition: 'Complete authority chain established with applicable codes identified'
      });
    }

    // ---- DETERMINE REALITY STATE ----
    var realityState = 'CONFIRMED';
    var unknownTriggered = false;
    var blocksDisposition = false;

    if (reasonCodes.length === 0) {
      realityState = 'CONFIRMED';
    } else if (reasonCodes.length === 1 && reasonCodes[0] === 'LOW_EVIDENCE_TRUST') {
      realityState = 'PROBABLE';
    } else if (reasonCodes.length <= 2 && blockedQuestions.length === 0) {
      realityState = 'POSSIBLE';
      unknownTriggered = true;
    } else if (blockedQuestions.length > 0) {
      // Check severity
      var hasCriticalBlock = false;
      for (var bi = 0; bi < reasonCodes.length; bi++) {
        if (reasonCodes[bi] === 'HIGH_CONSEQUENCE_WITH_GAPS' ||
            reasonCodes[bi] === 'SOUR_SERVICE_UNVERIFIED' ||
            reasonCodes[bi] === 'MIXED_DAMAGE_MODES') {
          hasCriticalBlock = true;
        }
      }

      if (hasCriticalBlock) {
        realityState = 'UNKNOWN';
        unknownTriggered = true;
        blocksDisposition = true;
      } else {
        realityState = 'UNVERIFIED';
        unknownTriggered = true;
        blocksDisposition = true;
      }
    } else if (reasonCodes.length >= 4) {
      realityState = 'UNKNOWN';
      unknownTriggered = true;
      blocksDisposition = true;
    } else {
      realityState = 'UNVERIFIED';
      unknownTriggered = true;
    }

    // Override: too many gaps on any asset = unknown
    if (minimumData.length >= 3 && unresolvedQuestions.length >= 4) {
      realityState = 'UNRESOLVABLE_WITH_CURRENT_DATA';
      unknownTriggered = true;
      blocksDisposition = true;
    }

    var result = {
      reality_state: realityState,
      unknown_triggered: unknownTriggered,
      unknown_reason_codes: reasonCodes,
      unresolved_questions: unresolvedQuestions,
      blocked_questions: blockedQuestions,
      minimum_data_required: minimumData,
      next_best_inspection_actions: nextActions,
      unknown_blocks_final_disposition: blocksDisposition
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('[unknown-state] Error:', err);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    };
  }
};

module.exports = { handler: handler };
