// ============================================================================
// FORGED NDT INTELLIGENCE OS — REALITY CHALLENGE ENGINE v1.0
// Netlify Function: reality-challenge
// DEPLOY129b: netlify/functions/reality-challenge.js
// ============================================================================
// PURPOSE: Challenge the primary interpretation of inspection data.
// Generates alternate hypotheses, calculates ambiguity, recommends action.
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
    var transcript = body.transcript || '';
    var parsed = body.parsed_incident || {};
    var asset = body.resolved_asset || {};
    var grammarBridge = body.grammar_bridge_result || null;
    var provenance = body.evidence_provenance_result || null;

    // ---- EXTRACT PRIMARY INTERPRETATION ----
    var events = parsed.events || [];
    var primaryEvent = events[0] || {};
    var assetClass = asset.asset_class || primaryEvent.asset_class || 'unknown';
    var mechanisms = [];
    var findings = [];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.damage_mechanism && mechanisms.indexOf(ev.damage_mechanism) === -1) {
        mechanisms.push(ev.damage_mechanism);
      }
      if (ev.finding && findings.indexOf(ev.finding) === -1) {
        findings.push(ev.finding);
      }
      if (ev.finding_type && findings.indexOf(ev.finding_type) === -1) {
        findings.push(ev.finding_type);
      }
    }

    var primaryHypothesis = {
      asset_class: assetClass,
      scenario_type: mechanisms.length > 1 ? 'multi_mechanism' : (mechanisms[0] || 'unknown'),
      finding_frame: findings.join(' + ') || 'unspecified',
      mechanism_frame: mechanisms.join(' + ') || 'unspecified',
      confidence: 0.5,
      basis: []
    };

    // ---- CALCULATE PRIMARY CONFIDENCE ----
    var confidenceFactors = 0;
    var confidenceTotal = 0;

    // Asset resolved?
    if (assetClass !== 'unknown' && assetClass !== 'unresolved') {
      confidenceTotal += 0.85;
      primaryHypothesis.basis.push('Asset class resolved: ' + assetClass);
    } else {
      confidenceTotal += 0.3;
      primaryHypothesis.basis.push('Asset class unresolved');
    }
    confidenceFactors++;

    // Mechanisms identified?
    if (mechanisms.length > 0) {
      confidenceTotal += 0.8;
      primaryHypothesis.basis.push('Mechanisms identified: ' + mechanisms.join(', '));
    } else {
      confidenceTotal += 0.2;
      primaryHypothesis.basis.push('No mechanisms identified');
    }
    confidenceFactors++;

    // Provenance trust band?
    if (provenance && provenance.provenance_summary) {
      var trustBand = provenance.provenance_summary.trust_band || 'UNKNOWN';
      var trustScore = provenance.provenance_summary.composite_trust_score || 0;
      if (trustBand === 'HIGH' || trustScore > 0.7) {
        confidenceTotal += 0.9;
        primaryHypothesis.basis.push('Evidence trust band: HIGH');
      } else if (trustBand === 'MODERATE' || trustScore > 0.5) {
        confidenceTotal += 0.65;
        primaryHypothesis.basis.push('Evidence trust band: MODERATE');
      } else {
        confidenceTotal += 0.35;
        primaryHypothesis.basis.push('Evidence trust band: ' + trustBand + ' (' + Math.round(trustScore * 100) + '%)');
      }
    } else {
      confidenceTotal += 0.4;
      primaryHypothesis.basis.push('No provenance data available');
    }
    confidenceFactors++;

    // Grammar bridge completeness?
    if (grammarBridge && grammarBridge.completeness) {
      if (grammarBridge.completeness === 'COMPLETE') {
        confidenceTotal += 0.9;
        primaryHypothesis.basis.push('Grammar bridge: COMPLETE');
      } else if (grammarBridge.completeness === 'NEAR_COMPLETE') {
        confidenceTotal += 0.7;
        primaryHypothesis.basis.push('Grammar bridge: NEAR_COMPLETE');
      } else {
        confidenceTotal += 0.4;
        primaryHypothesis.basis.push('Grammar bridge: ' + grammarBridge.completeness);
      }
    } else {
      confidenceTotal += 0.5;
    }
    confidenceFactors++;

    primaryHypothesis.confidence = confidenceFactors > 0 ? Math.round((confidenceTotal / confidenceFactors) * 100) / 100 : 0.5;

    // ---- GENERATE ALTERNATE HYPOTHESES ----
    var alternates = [];
    var ambiguityFlags = [];
    var trace = [];

    trace.push('Primary: ' + primaryHypothesis.mechanism_frame + ' on ' + primaryHypothesis.asset_class);

    // Check for multi-mechanism ambiguity
    if (mechanisms.length > 1) {
      ambiguityFlags.push('MULTI_MECHANISM');
      trace.push('Multiple mechanisms detected: ' + mechanisms.join(', '));

      for (var mi = 0; mi < mechanisms.length; mi++) {
        var altMech = mechanisms[mi];
        var otherMechs = mechanisms.filter(function(m) { return m !== altMech; });

        alternates.push({
          hypothesis_id: 'ALT_MECH_' + (mi + 1),
          asset_class: assetClass,
          scenario_type: 'single_mechanism',
          finding_frame: 'Dominant mechanism: ' + altMech,
          mechanism_frame: altMech,
          confidence: Math.round((primaryHypothesis.confidence * 0.7) * 100) / 100,
          risk_bias: mi === 0 ? 'equal' : 'higher',
          basis: [
            altMech + ' as sole dominant mechanism',
            'Other mechanisms (' + otherMechs.join(', ') + ') may be secondary or misidentified'
          ]
        });
      }
    }

    // Check for cracking + corrosion conflict (common ambiguity)
    var hasCorrosion = false;
    var hasCracking = false;
    var transcriptLower = transcript.toLowerCase();

    for (var fi = 0; fi < findings.length; fi++) {
      var f = findings[fi].toLowerCase();
      if (f.indexOf('corrosion') !== -1 || f.indexOf('wall loss') !== -1 || f.indexOf('thinning') !== -1 || f.indexOf('pitting') !== -1) {
        hasCorrosion = true;
      }
      if (f.indexOf('crack') !== -1 || f.indexOf('scc') !== -1 || f.indexOf('hic') !== -1) {
        hasCracking = true;
      }
    }
    // Also check mechanisms
    for (var mci = 0; mci < mechanisms.length; mci++) {
      var ml = mechanisms[mci].toLowerCase();
      if (ml.indexOf('corrosion') !== -1 || ml.indexOf('thinning') !== -1) hasCorrosion = true;
      if (ml.indexOf('crack') !== -1 || ml.indexOf('scc') !== -1 || ml.indexOf('hic') !== -1 || ml.indexOf('fatigue') !== -1) hasCracking = true;
    }
    // Also check transcript
    if (transcriptLower.indexOf('crack') !== -1) hasCracking = true;
    if (transcriptLower.indexOf('corrosion') !== -1 || transcriptLower.indexOf('wall loss') !== -1 || transcriptLower.indexOf('pitting') !== -1) hasCorrosion = true;

    if (hasCorrosion && hasCracking) {
      ambiguityFlags.push('CORROSION_CRACKING_CONFLICT');
      trace.push('Both corrosion and cracking evidence present — different inspection approaches required');

      if (alternates.length === 0) {
        alternates.push({
          hypothesis_id: 'ALT_CRACK_DOMINANT',
          asset_class: assetClass,
          scenario_type: 'cracking_dominant',
          finding_frame: 'Cracking as primary damage mode',
          mechanism_frame: 'cracking (SCC/HIC/fatigue)',
          confidence: Math.round((primaryHypothesis.confidence * 0.65) * 100) / 100,
          risk_bias: 'higher',
          basis: [
            'Cracking indications present in evidence',
            'Cracking on pressure boundary = higher consequence than volumetric loss',
            'Different NDE methods required for crack characterization'
          ]
        });
        alternates.push({
          hypothesis_id: 'ALT_CORROSION_DOMINANT',
          asset_class: assetClass,
          scenario_type: 'corrosion_dominant',
          finding_frame: 'Corrosion/thinning as primary damage mode',
          mechanism_frame: 'corrosion (general/pitting/MIC)',
          confidence: Math.round((primaryHypothesis.confidence * 0.7) * 100) / 100,
          risk_bias: 'lower',
          basis: [
            'Wall loss and pitting evidence present',
            'Corrosion is volumetric — typically lower immediate risk than cracking',
            'Remaining strength calculable via B31G methods'
          ]
        });
      }
    }

    // Check for low provenance confidence
    if (provenance && provenance.provenance_summary) {
      var measuredFraction = provenance.provenance_summary.measured_fraction || 0;
      if (measuredFraction < 0.2) {
        ambiguityFlags.push('LOW_MEASURED_EVIDENCE');
        trace.push('Measured evidence fraction below 20% — interpretation relies heavily on inferred/reported data');
      }
    }

    // Check for H2S / sour service implications
    if (transcriptLower.indexOf('h2s') !== -1 || transcriptLower.indexOf('sour') !== -1 || transcriptLower.indexOf('sulfide') !== -1) {
      if (hasCracking) {
        ambiguityFlags.push('SOUR_SERVICE_CRACKING');
        trace.push('Sour service environment with cracking — SSC/HIC must be ruled out');
      }
    }

    // ---- FIND HIGHEST RISK HYPOTHESIS ----
    var highestRisk = null;
    for (var hi = 0; hi < alternates.length; hi++) {
      if (alternates[hi].risk_bias === 'higher') {
        if (!highestRisk || alternates[hi].confidence > highestRisk.confidence) {
          highestRisk = {
            hypothesis_id: alternates[hi].hypothesis_id,
            reason: alternates[hi].finding_frame + ' — ' + alternates[hi].basis[0],
            risk_bias: 'higher',
            confidence: alternates[hi].confidence
          };
        }
      }
    }

    // ---- CALCULATE AMBIGUITY SCORE ----
    var ambiguityScore = 0;
    if (ambiguityFlags.length > 0) {
      ambiguityScore = Math.min(100, ambiguityFlags.length * 25);
    }
    // Adjust for primary confidence
    if (primaryHypothesis.confidence < 0.5) {
      ambiguityScore = Math.min(100, ambiguityScore + 15);
      ambiguityFlags.push('LOW_PRIMARY_CONFIDENCE');
    }

    var challengeTriggered = ambiguityScore > 20 || alternates.length > 0;

    // ---- DETERMINE RECOMMENDATION ----
    var recommendation = 'accept_primary';
    if (ambiguityScore >= 70) {
      recommendation = 'defer_to_unknown';
    } else if (ambiguityScore >= 40) {
      recommendation = 'accept_with_guard';
    } else if (ambiguityScore >= 20) {
      recommendation = 'accept_with_guard';
    }
    if (highestRisk && highestRisk.confidence > primaryHypothesis.confidence) {
      recommendation = 'escalate_for_more_data';
    }

    trace.push('Ambiguity score: ' + ambiguityScore + '% | Flags: ' + ambiguityFlags.length + ' | Alternates: ' + alternates.length);
    trace.push('Recommendation: ' + recommendation);

    var result = {
      primary_reality_hypothesis: primaryHypothesis,
      alternate_hypotheses: alternates,
      highest_risk_plausible_hypothesis: highestRisk,
      ambiguity_flags: ambiguityFlags,
      ambiguity_score: ambiguityScore,
      challenge_triggered: challengeTriggered,
      reality_lock_recommendation: recommendation,
      challenge_reasoning_trace: trace
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
    console.error('[reality-challenge] Error:', err);
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
