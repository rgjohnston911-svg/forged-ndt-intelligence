// DISPOSITION PATHWAY ENGINE v1.0
// File: netlify/functions/disposition-pathway.js
// NO TYPESCRIPT — PURE JAVASCRIPT

var handler = async function(event) {
  "use strict";

  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");

    var safeEnvelope = (body.safe_envelope || "").toUpperCase().trim();
    var governingMode = (body.governing_failure_mode || "").toUpperCase().trim();
    var governingSeverity = (body.governing_severity || "").toUpperCase().trim();
    var realityState = (body.reality_state || "").toUpperCase().trim();
    var dispositionBlocked = body.disposition_blocked || false;
    var interactionFlag = body.interaction_flag || false;
    var interactionType = (body.interaction_type || "").toUpperCase().trim();
    var brittleFractureRisk = body.brittle_fracture_risk || false;
    var wallLossPercent = body.wall_loss_percent || 0;
    var operatingRatio = body.operating_ratio || 0;
    var pressureReductionRequired = body.pressure_reduction_required || 0;
    var hasCracking = body.has_cracking || false;
    var confidenceBand = (body.confidence_band || "").toUpperCase().trim();
    var consequenceTier = (body.consequence_tier || "").toUpperCase().trim();

    // ====================================================================
    // DISPOSITION DECISION TREE
    // ====================================================================

    var disposition = "ENGINEERING_ASSESSMENT";
    var actions = [];
    var interval = "";
    var conditions = [];
    var escalationTriggers = [];
    var dispositionBasis = "";
    var urgency = "STANDARD";
    var temporaryControls = [];

    // ----------------------------------------------------------------
    // TIER 1: IMMEDIATE ACTION (highest priority checks)
    // ----------------------------------------------------------------

    if (safeEnvelope === "EXCEEDS") {
      disposition = "IMMEDIATE_ACTION";
      urgency = "EMERGENCY";
      dispositionBasis = "Operating pressure EXCEEDS calculated MAOP - immediate intervention required";
      actions.push({
        priority: 1,
        action: "REDUCE OPERATING PRESSURE",
        detail: "Immediate pressure reduction of " + pressureReductionRequired + " psi to achieve 80% of governing MAOP",
        who: "Operations / Control Room",
        timeframe: "IMMEDIATE"
      });
      actions.push({
        priority: 2,
        action: "ENGINEERING ASSESSMENT",
        detail: "Mandatory FFS assessment per API 579-1 before resuming normal operations",
        who: "Level III Inspector / Integrity Engineer",
        timeframe: "Within 24 hours"
      });
      actions.push({
        priority: 3,
        action: "ESTABLISH SAFE ZONE",
        detail: "Implement exclusion zone and leak monitoring around affected area",
        who: "HSE / Operations",
        timeframe: "IMMEDIATE"
      });
      temporaryControls.push("Pressure cap at 80% of calculated MAOP until engineering assessment complete");
      temporaryControls.push("Continuous leak monitoring");
      temporaryControls.push("Exclusion zone around affected area");
      escalationTriggers.push("Any pressure exceedance above reduced limit");
      escalationTriggers.push("Any indication of leak or weep");
      escalationTriggers.push("Discovery of additional damage during assessment");
    }

    // Brittle fracture risk = always immediate
    else if (brittleFractureRisk) {
      disposition = "IMMEDIATE_ACTION";
      urgency = "EMERGENCY";
      dispositionBasis = "Brittle fracture risk identified - failure mode produces sudden catastrophic failure with no leak-before-break warning";
      actions.push({
        priority: 1,
        action: "PRESSURE REDUCTION OR SHUTDOWN",
        detail: "Reduce operating pressure to minimum safe level or shut down if hardness/material verification cannot be completed",
        who: "Operations / Engineering",
        timeframe: "IMMEDIATE"
      });
      actions.push({
        priority: 2,
        action: "MATERIAL VERIFICATION",
        detail: "Hardness testing of base metal + HAZ per NACE MR0175. PMI of material grade.",
        who: "Level II/III Inspector",
        timeframe: "Within 24 hours"
      });
      actions.push({
        priority: 3,
        action: "CRACK CHARACTERIZATION",
        detail: "TOFD or PAUT to determine crack dimensions for API 579-1 Part 9 assessment",
        who: "Level II UT/PAUT Technician",
        timeframe: "Within 48 hours"
      });
      temporaryControls.push("Operating pressure reduced to minimum");
      temporaryControls.push("No thermal or pressure cycling permitted");
      temporaryControls.push("Continuous monitoring for propagation");
      escalationTriggers.push("Hardness exceeds NACE MR0175 limits");
      escalationTriggers.push("Crack growth detected on follow-up");
      escalationTriggers.push("Material does not meet sour service requirements");
    }

    // ----------------------------------------------------------------
    // TIER 2: HOLD FOR DATA (unknown state blocks disposition)
    // ----------------------------------------------------------------

    else if (dispositionBlocked || realityState === "UNKNOWN") {
      disposition = "HOLD_FOR_DATA";
      urgency = "EXPEDITED";
      dispositionBasis = "Reality state is UNKNOWN - insufficient data to support confident disposition. Additional inspection required before any decision.";

      if (safeEnvelope === "MARGINAL") {
        actions.push({
          priority: 1,
          action: "PRECAUTIONARY PRESSURE REDUCTION",
          detail: "Reduce operating pressure by " + (pressureReductionRequired > 0 ? pressureReductionRequired + " psi" : "10-15%") + " as precautionary measure while data is gathered",
          who: "Operations",
          timeframe: "Within 4 hours"
        });
        temporaryControls.push("Precautionary pressure reduction in effect");
      }

      actions.push({
        priority: safeEnvelope === "MARGINAL" ? 2 : 1,
        action: "GATHER MISSING DATA",
        detail: "Complete all minimum data requirements identified by Unknown State Engine before re-evaluation",
        who: "Inspection Team",
        timeframe: safeEnvelope === "MARGINAL" ? "Within 48 hours" : "Within 7 days"
      });
      actions.push({
        priority: safeEnvelope === "MARGINAL" ? 3 : 2,
        action: "RE-EVALUATE WITH COMPLETE DATA",
        detail: "Re-run full pipeline assessment once minimum data requirements are satisfied",
        who: "Level III Inspector / Integrity Engineer",
        timeframe: "After data collection complete"
      });

      temporaryControls.push("Current operating conditions maintained with enhanced monitoring");
      escalationTriggers.push("Any change in observed condition (new leaks, growth, etc.)");
      escalationTriggers.push("Operating conditions change (pressure excursion, temperature change)");
      conditions.push("Disposition cannot be finalized until reality state advances to KNOWN or PARTIALLY_KNOWN");
    }

    // ----------------------------------------------------------------
    // TIER 3: SAFE ENVELOPE MARGINAL + KNOWN STATE
    // ----------------------------------------------------------------

    else if (safeEnvelope === "MARGINAL" && (realityState === "KNOWN" || realityState === "CONFIRMED" || realityState === "PROBABLE" || realityState === "PARTIALLY_KNOWN")) {

      if (hasCracking || governingMode === "CRACKING" || governingMode === "COMPOUND") {
        disposition = "ENGINEERING_ASSESSMENT";
        urgency = "PRIORITY";
        dispositionBasis = "Marginal safe envelope with cracking present - engineering assessment required to determine if continued operation is acceptable";

        actions.push({
          priority: 1,
          action: "CRACK SIZING AND CHARACTERIZATION",
          detail: "TOFD or PAUT to determine crack length, depth, and orientation for API 579-1 Part 9",
          who: "Level II UT/PAUT Technician",
          timeframe: "Within 7 days"
        });
        actions.push({
          priority: 2,
          action: "FFS ASSESSMENT",
          detail: "API 579-1 Level 2 or Level 3 assessment to determine acceptability for continued service",
          who: "Integrity Engineer",
          timeframe: "Within 14 days"
        });
        actions.push({
          priority: 3,
          action: "DEFINE MONITORING PLAN",
          detail: "Establish crack monitoring intervals based on FFS results and crack growth projections",
          who: "Integrity Engineer",
          timeframe: "After FFS assessment"
        });

        temporaryControls.push("Pressure cap at current operating level - no increases permitted");
        temporaryControls.push("No thermal cycling or startup/shutdown without engineering approval");
        escalationTriggers.push("Any crack growth detected");
        escalationTriggers.push("Operating pressure must increase");
        escalationTriggers.push("New mechanisms discovered");
      } else {
        disposition = "MONITOR";
        urgency = "ELEVATED";
        dispositionBasis = "Marginal safe envelope with corrosion-only damage and known reality state. Monitoring with defined interval and conditions.";

        actions.push({
          priority: 1,
          action: "ESTABLISH MONITORING BASELINE",
          detail: "Grid UT survey to establish thickness baseline at critical measurement locations (CMLs)",
          who: "Level II UT Technician",
          timeframe: "Within 30 days"
        });
        actions.push({
          priority: 2,
          action: "CALCULATE CORROSION RATE",
          detail: "Determine short-term and long-term corrosion rates from historical thickness data",
          who: "Integrity Engineer",
          timeframe: "After baseline established"
        });
        actions.push({
          priority: 3,
          action: "SET RE-INSPECTION INTERVAL",
          detail: "Define interval per API 510/570/653 based on corrosion rate and remaining life calculation",
          who: "Level III Inspector",
          timeframe: "After corrosion rate determined"
        });

        interval = "6 months (initial monitoring interval - adjust based on corrosion rate)";
        temporaryControls.push("Pressure cap at current operating level");
        escalationTriggers.push("Corrosion rate exceeds predicted value");
        escalationTriggers.push("Wall loss reaches code minimum retirement thickness");
        escalationTriggers.push("New damage mechanisms appear");
        conditions.push("Continued operation acceptable only if monitoring confirms stable or declining corrosion rate");
      }
    }

    // ----------------------------------------------------------------
    // TIER 4: WITHIN SAFE ENVELOPE
    // ----------------------------------------------------------------

    else if (safeEnvelope === "WITHIN") {

      if (hasCracking || governingMode === "CRACKING") {
        // Cracking always requires engineering assessment regardless of envelope
        disposition = "ENGINEERING_ASSESSMENT";
        urgency = "STANDARD";
        dispositionBasis = "Within safe envelope but cracking detected - engineering assessment required per API 579-1 Part 9. Cracking failure modes cannot be dispositioned by pressure envelope alone.";

        actions.push({
          priority: 1,
          action: "CRACK CHARACTERIZATION",
          detail: "Size all detected cracks using TOFD or PAUT. Determine orientation, length, and through-wall depth.",
          who: "Level II UT/PAUT Technician",
          timeframe: "Within 30 days"
        });
        actions.push({
          priority: 2,
          action: "ROOT CAUSE DETERMINATION",
          detail: "Identify cracking mechanism (fatigue, SCC, HIC, etc.) and driving environment/stress conditions",
          who: "Integrity Engineer / Metallurgist",
          timeframe: "Within 30 days"
        });
        actions.push({
          priority: 3,
          action: "FFS ASSESSMENT",
          detail: "API 579-1 Part 9 assessment based on crack dimensions, material toughness, and loading",
          who: "Integrity Engineer",
          timeframe: "Within 60 days"
        });

        interval = "Per FFS assessment results";
        escalationTriggers.push("Crack growth on follow-up inspection");
        escalationTriggers.push("Root cause indicates active/ongoing mechanism");
        conditions.push("Continued operation pending FFS results showing crack is subcritical with adequate remaining life");
      }
      else if (interactionFlag && interactionType === "SYNERGY") {
        // Compound mechanisms with synergy = monitor closely
        disposition = "MONITOR";
        urgency = "ELEVATED";
        dispositionBasis = "Within safe envelope but synergistic mechanism interaction detected. Close monitoring required to detect acceleration.";

        actions.push({
          priority: 1,
          action: "ENHANCED MONITORING",
          detail: "Increase inspection frequency to detect any acceleration from mechanism interaction",
          who: "Level II Inspector",
          timeframe: "Establish within 30 days"
        });
        actions.push({
          priority: 2,
          action: "ROOT CAUSE INVESTIGATION",
          detail: "Investigate and confirm mechanism interaction. Consider laboratory analysis.",
          who: "Integrity Engineer / Metallurgist",
          timeframe: "Within 60 days"
        });

        interval = "3-6 months (elevated due to mechanism interaction)";
        escalationTriggers.push("Corrosion rate acceleration detected");
        escalationTriggers.push("New damage indications appear between intervals");
        conditions.push("Continue service with enhanced monitoring. Escalate if synergistic acceleration confirmed.");
      }
      else {
        // Standard corrosion within envelope, no cracking, no interaction
        disposition = "CONTINUE_SERVICE";
        urgency = "ROUTINE";
        dispositionBasis = "Within safe envelope with corrosion-only damage, no cracking, no mechanism interaction, and known reality state. Standard inspection interval applies.";

        actions.push({
          priority: 1,
          action: "CONTINUE NORMAL INSPECTION PROGRAM",
          detail: "Follow existing inspection plan per API 510/570/653. Update thickness data at next scheduled inspection.",
          who: "Level II Inspector",
          timeframe: "Per existing schedule"
        });
        actions.push({
          priority: 2,
          action: "TREND CORROSION DATA",
          detail: "Update corrosion rate trending with new data points. Verify rate is stable or declining.",
          who: "Integrity Engineer",
          timeframe: "At next inspection"
        });

        interval = "Per API 510/570/653 calculated interval (typically 2-5 years based on corrosion rate)";
        escalationTriggers.push("Corrosion rate increases significantly");
        escalationTriggers.push("New damage mechanism identified");
        escalationTriggers.push("Operating conditions change (new service, higher pressure, etc.)");
        conditions.push("Standard continued service. Re-evaluate if any escalation trigger fires.");
      }
    }

    // ----------------------------------------------------------------
    // FALLBACK: No safe envelope data
    // ----------------------------------------------------------------

    else {
      disposition = "ENGINEERING_ASSESSMENT";
      urgency = "PRIORITY";
      dispositionBasis = "Insufficient data to determine safe operating envelope. Engineering assessment required before disposition.";

      actions.push({
        priority: 1,
        action: "COMPLETE ASSESSMENT DATA",
        detail: "Gather wall thickness, flaw sizing, operating conditions, and material data needed for FFS evaluation",
        who: "Inspection Team",
        timeframe: "Within 14 days"
      });
      actions.push({
        priority: 2,
        action: "FFS ASSESSMENT",
        detail: "Perform API 579-1 fitness-for-service evaluation once data is complete",
        who: "Integrity Engineer",
        timeframe: "After data collection"
      });

      temporaryControls.push("Maintain current operating conditions - no increases");
      escalationTriggers.push("Any observed deterioration");
    }

    // ====================================================================
    // CONSEQUENCE MODIFIER
    // ====================================================================

    if (consequenceTier === "CRITICAL" && urgency !== "EMERGENCY") {
      urgency = "PRIORITY";
      temporaryControls.push("CRITICAL consequence tier: all timeframes compressed by 50%");
      escalationTriggers.push("Any deviation from disposition actions triggers immediate re-evaluation");
    }

    // Low confidence modifier
    if (confidenceBand === "LOW" || confidenceBand === "UNRESOLVED") {
      conditions.push("LOW confidence band: disposition is provisional pending improved data quality");
      if (disposition === "CONTINUE_SERVICE") {
        disposition = "MONITOR";
        dispositionBasis = dispositionBasis + " [UPGRADED from CONTINUE_SERVICE due to LOW confidence]";
        interval = "Reduced interval (50% of standard) due to low confidence";
      }
    }

    // ====================================================================
    // RESPONSE
    // ====================================================================

    var result = {
      disposition: disposition,
      urgency: urgency,
      disposition_basis: dispositionBasis,
      actions: actions,
      interval: interval,
      conditions: conditions,
      temporary_controls: temporaryControls,
      escalation_triggers: escalationTriggers,
      inputs_used: {
        safe_envelope: safeEnvelope,
        governing_failure_mode: governingMode,
        governing_severity: governingSeverity,
        reality_state: realityState,
        disposition_blocked: dispositionBlocked,
        interaction_flag: interactionFlag,
        brittle_fracture_risk: brittleFractureRisk,
        has_cracking: hasCracking,
        wall_loss_percent: wallLossPercent,
        operating_ratio: operatingRatio,
        consequence_tier: consequenceTier,
        confidence_band: confidenceBand
      },
      metadata: {
        engine: "disposition-pathway",
        version: "1.0",
        timestamp: new Date().toISOString()
      }
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Disposition pathway error: " + (err.message || String(err)) }) };
  }
};

module.exports = { handler: handler };
