// ============================================================================
// governingReality.ts — GOVERNING REALITY ENGINE (deterministic arbiter)
// ----------------------------------------------------------------------------
// Answers the top-level question the platform exists to answer: "What is
// actually controlling the decision?" — distinct from "what defect was found"
// and "what mechanism exists".
//
// DISCIPLINE (non-negotiable):
//  - FACTS AND PHYSICS ONLY. It consumes already-computed deterministic outputs
//    (decision-core, FMD, convergence, organizational facts, future-state) and
//    documented facts from the transcript. It NEVER infers human motive, mindset,
//    or behavior (complacency, ego, fear, etc.) — those are unprovable, vary
//    worldwide, and would make the system unreliable.
//  - It produces NO new evidence. It SELECTS and NAMES which already-established
//    reality governs, by a fixed precedence, and composes a statement ONLY from
//    signals that are actually present (anti-contamination, same as convergence).
//  - Honest fallback: if no class signature is satisfied, returns NONE.
// ============================================================================

export interface GoverningRealityInput {
  consequenceTier?: string | null;          // decision-core consequence_reality.consequence_tier
  disposition?: string | null;              // decision-core decision_reality.disposition
  hardLockCount?: number;                   // decision-core hard locks
  governingFailureMode?: string | null;     // FMD governing_failure_mode (measured/confirmed)
  governingSeverity?: string | null;        // FMD governing_severity
  suspectedGoverning?: string[] | null;     // FMD suspected_governing_mechanism[]
  dispositionDriver?: string | null;        // FMD disposition_driver
  convergencePrimaryId?: string | null;     // convergence primary_hypothesis.id
  convergenceStreamIds?: string[] | null;   // ids of the matched convergence streams
  orgFailureScore?: number;                 // organizational_failure_score (documented gaps)
  orgIndicatorCount?: number;               // count of documented org indicators
  futureVerdict?: string | null;            // future-state verdict
  futureDominantDriver?: string | null;     // future-state dominant driver label
  futureAdjustedLifeMonths?: number | null;
  futureNextInterventionMonths?: number | null;
  transcript?: string | null;               // for DOCUMENTED-FACT phrase scan only
}

export interface GoverningReality {
  class: string;                 // enum (see below); "NONE" when nothing qualifies
  governs: boolean;
  statement: string;             // composed only from present facts
  disposition_driver: string | null;
  contributing: string[];        // subordinate factual realities also present
  provenance: string[];          // which engines/facts drove the selection
}

// Documented-FACT phrases only. Each is an observable record fact (a document
// present, or a required document ABSENT) — never a behavioral interpretation.
var REASSESSMENT_GAP_FACTS: Array<{ re: RegExp; fact: string }> = [
  { re: /no vibration study|vibration study (?:not|never) (?:performed|conducted|done)/i, fact: "no vibration study on record since the change" },
  { re: /no dynamic stress|dynamic stress assessment (?:not|never)|no flexibility (?:review|analysis)/i, fact: "no dynamic-stress / flexibility assessment on record" },
  { re: /no moc|no management of change|management of change (?:not|missing)|no moc documentation/i, fact: "no Management-of-Change documentation on file" },
  { re: /no engineering (?:calculation|calc|reassessment|assessment|review)|engineering (?:review|assessment) (?:not completed|incomplete|outstanding)/i, fact: "no engineering reassessment on record" },
  { re: /review (?:requested .* not completed|not completed|outstanding|incomplete)/i, fact: "a requested engineering review remains incomplete" },
  { re: /not (?:conducted|performed|completed|reviewed)/i, fact: "a required assessment is documented as not performed" }
];

var OPERATIONAL_CHANGE_FACTS: Array<{ re: RegExp; fact: string }> = [
  { re: /(?:throughput|charge rate|rate|reinjection|injection|production|flow|velocity)[^.]{0,30}increased[^.]{0,20}(\d{1,3})\s*%/i, fact: "operating duty increased (documented %)" },
  { re: /increased\s+(\d{1,3})\s*%|(\d{1,3})\s*%\s+(?:increase|higher)/i, fact: "operating duty increased (documented %)" },
  { re: /throughput increased|charge rate (?:increase|raised)|rate increased|reinjection rates increased|revamp|increased severity|increased flow|higher rate/i, fact: "operating duty / throughput increased" }
];

// Control / network-behaviour drift signals (documented facts only, DOMAIN-AGNOSTIC).
// A cluster of >=3 of these with NO confirmed material defect means the governing
// reality is loss of the validated operating envelope - not a damage mechanism
// (TEST 17 hub / TEST 18 hydrogen network / TEST 19 power grid). Facts only.
var SYSTEM_DRIFT_SIGNALS: Array<{ re: RegExp; fact: string }> = [
  { re: /instability index|stability index|resilience margin|stability margin|resilience[^.]{0,20}declin|margin[^.]{0,15}declin/i, fact: "a declining system stability / resilience margin" },
  { re: /emergent[^.]{0,15}behaviou?r|cross-unit|cross-domain|cross unit|cross domain|behaviou?r correlation|correlation (?:increasing|confidence|rising)|correlation[^.]{0,15}(?:increasing|\d{2}\s*%)/i, fact: "rising emergent / cross-system correlated behaviour" },
  { re: /\bapc\b|advanced process control|optimization (?:software|ai|algorithm)|optimisation (?:software|ai|algorithm)|network optimization|network optimisation|dispatch software|automatic dispatch|autonomous dispatch|machine-to-machine|automated control interaction/i, fact: "an optimization / automated-dispatch software change" },
  { re: /control loops?[^.]{0,25}(?:adjust|hunt)|hunts more|continuously adjusting|loop hunting|harder to predict|frequency correction|near-?miss[^.]{0,25}(?:relay|intervention)|balancing[^.]{0,18}harder|anti-?surge|surge event/i, fact: "control-instability proxies (hunting / corrections / near-miss interventions / surge)" },
  { re: /analy[sz]ers?[^.]{0,30}(?:disagree|differ|disagreement)|intermittent disagreement|latency increased|communication failure|comms? failure/i, fact: "conflicting measured reality / degraded comms" },
  { re: /no single owner|ownership[^.]{0,20}(?:distributed|gap|unclear)|position (?:eliminated|vacant|remains vacant)|no group (?:believes|owns)|distributed among|operator experience[^.]{0,20}(?:declin|to \d)|no[^.]{0,5}owner/i, fact: "loss of single-system ownership / experienced personnel" },
  { re: /machine learning|ml anomaly|analytics engine|analytics platform|anomaly detection|ml (?:output|alert|warning|finding)/i, fact: "an ML / analytics cross-correlation alert" },
  { re: /renewable penetration increased|penetration increased[^.]{0,12}\d|trading activity increased|autonomous|automated (?:control|dispatch)/i, fact: "a documented operating-regime change (automation / penetration / market activity)" }
];

// "Loss of ability to know" facts (documented gaps in the integrity-assurance
// BASIS itself: missing baseline, lost records, failed monitoring, unreviewed
// external change). >=2 of these with NO confirmed mechanism means UNCERTAINTY
// is the governing risk - the asset is in an UNKNOWN state (TEST 21). Facts only.
var LOSS_OF_KNOWLEDGE_FACTS: Array<{ re: RegExp; fact: string }> = [
  { re: /baseline[^.]{0,25}(?:missing|destroyed|lost|unavailable)|foundation report[^.]{0,25}(?:missing|destroyed|lost)|original[^.]{0,25}report[^.]{0,15}(?:missing|destroyed|lost)/i, fact: "the design / foundation baseline is missing or destroyed" },
  { re: /records?[^.]{0,20}(?:lost|destroyed|missing|unavailable)|lost \d+ years|history[^.]{0,15}(?:lost|missing|unavailable)|database migration lost|trend data unavailable|historical[^.]{0,15}(?:lost|unavailable)/i, fact: "historical / trend records have been lost" },
  { re: /monitoring (?:system )?(?:failed|out of service|offline|inoperative|not working)|monitoring[^.]{0,18}(?:failed|out of service|offline)/i, fact: "a monitoring system has failed / is out of service" },
  { re: /never reviewed|not reviewed by|study never reviewed|nobody (?:investigated|reviewed)|no determination made/i, fact: "a known external change was never reviewed" },
  { re: /no details available|destroyed during (?:corporate )?acquisition|sensitivity concern[^.]{0,25}no details/i, fact: "a documented prior concern has no retrievable detail" }
];

// Convergence hypothesis id -> readable mechanism name + the FMD-mode "family" it
// belongs to (so a single-mode FMD finding of a DIFFERENT family is named a
// contributing cause, not the governing mechanism).
var CONV_MECH_NAME: { [k: string]: string } = {
  VIBRATION_INDUCED_FATIGUE: "vibration-induced fatigue",
  MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS: "external mechanical-displacement-driven integrity loss",
  INTERNAL_CORROSION_PROGRESSION: "internal corrosion progression"
};
var CONV_FAMILY: { [k: string]: string } = {
  VIBRATION_INDUCED_FATIGUE: "FATIGUE",
  MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS: "STRUCTURAL",
  INTERNAL_CORROSION_PROGRESSION: "CORROSION"
};

function has(re: RegExp, t: string): boolean { return re.test(t); }
function nz(s: string | null | undefined): string { return (s == null) ? "" : String(s); }
function up(s: string | null | undefined): string { return nz(s).toUpperCase(); }

function matchedFacts(rules: Array<{ re: RegExp; fact: string }>, t: string): string[] {
  var out: string[] = [];
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].re.test(t) && out.indexOf(rules[i].fact) < 0) { out.push(rules[i].fact); }
  }
  return out;
}

export function resolveGoverningReality(input: GoverningRealityInput): GoverningReality {
  var i = input || {};
  var t = nz(i.transcript);
  var tier = up(i.consequenceTier);
  var disp = nz(i.disposition).toLowerCase();
  var hardLocks = i.hardLockCount || 0;
  var suspected = (i.suspectedGoverning && i.suspectedGoverning.length) ? i.suspectedGoverning : [];
  var streamIds = i.convergenceStreamIds || [];
  var hasOpChangeStream = streamIds.indexOf("OPERATIONAL_CHANGE") >= 0;
  var convId = nz(i.convergencePrimaryId);

  var reassessmentGaps = matchedFacts(REASSESSMENT_GAP_FACTS, t);
  var opChangeFacts = matchedFacts(OPERATIONAL_CHANGE_FACTS, t);
  var operationalChangePresent = hasOpChangeStream || opChangeFacts.length > 0;

  var contributing: string[] = [];
  var provenance: string[] = [];

  // ---- Precedence ladder. First satisfied signature wins. -----------------

  // 1. CONFIRMED CRITICAL DAMAGE — a decisive, measured reality.
  if (hardLocks > 0 || disp === "no_go" || disp === "repair_before_restart") {
    provenance.push("decision-core: hard-lock / decisive disposition");
    var sev1 = i.governingFailureMode ? (nz(i.governingFailureMode).replace(/_/g, " ")) : "a confirmed integrity defect";
    return {
      class: "CONFIRMED_CRITICAL_DAMAGE",
      governs: true,
      statement: "Governing reality: a confirmed, decision-controlling defect (" + sev1 + ") governs. The measured condition is itself disqualifying.",
      disposition_driver: i.dispositionDriver || (i.governingFailureMode || null),
      contributing: contributing,
      provenance: provenance
    };
  }

  // 1b. CONTROL-SYSTEM / SOFTWARE FAILURE (fleet-convergent). The strongest evidence
  //     is FLEET HISTORY, not inspection: a software / controller change followed by
  //     multiple sister-asset failures (same software/controller), while this asset's
  //     inspection findings are within limits. The governing mechanism is not physical;
  //     weak-but-convergent fleet evidence outranks isolated, acceptable inspection
  //     results (TEST 22). Gated on BOTH a software change AND fleet-convergent failures.
  var softwareChange = /software (?:upgrade|update|version|change|modification|patch)|control software|control-system software|pitch controller|firmware|vendor tuning/i.test(t);
  var fleetAfterChange = /(?:three|two|multiple|several|sister|other|fleet)[^.]{0,40}(?:turbine|unit|asset|pump|compressor|line)s?[^.]{0,30}fail|failures?[^.]{0,45}after[^.]{0,20}(?:software|upgrade|update)|same software (?:version|upgrade|revision)|common factors?[^.]{0,70}(?:software|controller|contractor)/i.test(t);
  if (softwareChange && fleetAfterChange) {
    provenance.push("transcript: software/controller change + fleet-convergent failures (fact)");
    if (/anomalous (?:network )?traffic|cyber|network traffic|machine-to-machine/i.test(t)) contributing.push("anomalous network / cyber activity under investigation");
    if (/(?:impossible|implausible|invalid) position|reports impossible|self-clear/i.test(t)) contributing.push("controller reporting implausible / self-clearing faults");
    if (/root cause (?:never|not) (?:determined|found)|no physical defect (?:ever )?found/i.test(t)) contributing.push("prior fleet failures had no physical root cause found");
    if (i.governingFailureMode && nz(i.governingFailureMode) !== "NONE") contributing.push("This asset's inspection findings are within limits and are NOT the governing mechanism");
    return {
      class: "CONTROL_SOFTWARE_FLEET_FAILURE",
      governs: true,
      statement: "Governing reality: a control-system / software-induced failure mechanism governs - the strongest evidence is FLEET CONVERGENCE (multiple sister assets failed after the same software / controller change), not the inspection findings, which are within limits. The governing risk is software / control behaviour, not a physical defect; weak-but-convergent fleet evidence outranks the isolated, acceptable inspection results. Hold pending a control-system / software investigation - the physical inspection cannot clear this.",
      disposition_driver: i.dispositionDriver || "control-system / software failure mechanism (fleet-convergent) - not a physical inspection finding",
      contributing: contributing,
      provenance: provenance
    };
  }

  // 2. SYSTEM DRIFT / CONTROL-NETWORK INSTABILITY (no material mechanism).
  //    >= 3 distinct control/network drift signals + no confirmed critical defect ->
  //    the governing reality is loss of the validated operating envelope, NOT a
  //    damage mechanism. Gated high enough that mechanical-fatigue cases (which lack
  //    this control-instability cluster) never trigger it.
  var driftFacts = matchedFacts(SYSTEM_DRIFT_SIGNALS, t);
  if (driftFacts.length >= 3) {
    provenance.push("transcript: " + driftFacts.length + " distinct control / network drift signals (facts)");
    if (i.governingFailureMode && nz(i.governingFailureMode) !== "NONE") {
      contributing.push("Inspection mechanism (" + nz(i.governingFailureMode).replace(/_/g, " ").toLowerCase() + ") is within limits / not the controlling risk");
    }
    if (operationalChangePresent) { contributing.push("Operating duty increased without a corresponding systemwide reassessment"); }
    return {
      class: "SYSTEM_DRIFT_NO_MECHANISM",
      governs: true,
      statement: "Governing reality: the system has drifted toward instability - multiple independent control / network-behaviour signals are moving together (" + driftFacts.join("; ") + "), with no single defect responsible. No material damage mechanism governs; the controlling risk is loss of the validated operating envelope / system-level (control / network) instability - not corrosion or a measured defect. Resolution requires a multidisciplinary systems review, not an inspection.",
      disposition_driver: i.dispositionDriver || "system-level control / network instability (loss of validated operating envelope)",
      contributing: contributing,
      provenance: provenance
    };
  }

  // 2. OPERATIONAL CHANGE WITHOUT ENGINEERING REASSESSMENT — the root condition.
  //    Signature (all factual): operating duty increased AND a reassessment is
  //    documented as absent/incomplete. The suspected mechanism (if any) is the
  //    consequence, named as the controlling risk.
  var reassessmentGapPresent = reassessmentGaps.length > 0 || streamIds.indexOf("DEFERRED_MAINTENANCE") >= 0;
  if (operationalChangePresent && reassessmentGapPresent) {
    provenance.push("convergence/transcript: operating-duty change (fact)");
    provenance.push("reassessment/assurance gap (documented absence)");
    var oc = opChangeFacts.length ? opChangeFacts[0] : "operating duty increased";
    var gapText = reassessmentGaps.length ? reassessmentGaps.join("; ") : "documented engineering-reassessment / maintenance gaps recorded in the situational-awareness layer";
    var mechClause = suspected.length
      ? " The controlling risk is the resulting " + suspected.join(", ").toLowerCase() + ", which is not measured by the current wall-loss data and remains unconfirmed."
      : " The current condition is therefore not engineering-validated for the changed duty.";
    if (suspected.length) { contributing.push("Suspected governing mechanism: " + suspected.join(", ")); provenance.push("FMD: suspected_governing_mechanism"); }
    if (i.orgFailureScore && i.orgFailureScore >= 3) { contributing.push("Documented assurance gaps present (org score " + i.orgFailureScore + ")"); }
    return {
      class: "OPERATIONAL_CHANGE_WITHOUT_REASSESSMENT",
      governs: true,
      statement: "Governing reality: an operational change (" + oc + ") has altered the asset's duty without a corresponding engineering reassessment (" + gapText + ")." + mechClause,
      disposition_driver: i.dispositionDriver || (suspected.length ? suspected[0] : null),
      contributing: contributing,
      provenance: provenance
    };
  }

  // 5b. CONVERGENT MECHANISM GOVERNS - a strong multi-stream convergence hypothesis
  //     (>= 3 independent streams) names the governing MECHANISM and outranks a
  //     single-mode FMD finding. When the FMD single mode is a DIFFERENT family
  //     (e.g. structural instability from a tilt) it is a contributing CAUSE, not
  //     the governing mechanism (TEST 20: settlement/tilt is the cause; vibration-
  //     induced fatigue is the mechanism). Convergence draws on many independent
  //     streams, so it is the more trustworthy basis for the governing mechanism.
  if (convId && streamIds.length >= 3 && CONV_MECH_NAME[convId]) {
    var mechName = CONV_MECH_NAME[convId];
    var fmdMode = nz(i.governingFailureMode);
    var differs = fmdMode && fmdMode !== "NONE" && up(fmdMode).indexOf(CONV_FAMILY[convId] || "___NONE___") < 0;
    provenance.push("convergence: " + streamIds.length + " independent streams -> " + convId);
    var stmt2 = "Governing reality: " + mechName + " governs, supported by " + streamIds.length + " independent converging evidence streams.";
    if (differs) {
      contributing.push("Single-mode inspection finding (" + fmdMode.replace(/_/g, " ").toLowerCase() + ") is a contributing CAUSE, not the governing mechanism");
      stmt2 += " The single-mode inspection finding (" + fmdMode.replace(/_/g, " ").toLowerCase() + ") is a contributing cause, not the governing mechanism.";
    }
    return {
      class: "CONVERGENT_MECHANISM_GOVERNS",
      governs: true,
      statement: stmt2,
      disposition_driver: i.dispositionDriver || mechName,
      contributing: contributing,
      provenance: provenance
    };
  }

  // 3. SUSPECTED GOVERNING MECHANISM (without the operational-change root).
  if (suspected.length > 0) {
    provenance.push("FMD: suspected_governing_mechanism + disposition_driver");
    if (i.governingFailureMode) { contributing.push("Confirmed measured mechanism: " + nz(i.governingFailureMode).replace(/_/g, " ")); }
    return {
      class: "SUSPECTED_GOVERNING_MECHANISM",
      governs: true,
      statement: "Governing reality: a suspected higher-consequence mechanism (" + suspected.join(", ").toLowerCase() + ") governs the disposition pending confirmation — distinct from, and not measured by, the confirmed wall-loss finding.",
      disposition_driver: i.dispositionDriver || suspected[0],
      contributing: contributing,
      provenance: provenance
    };
  }

  // 4. FORWARD TRAJECTORY GOVERNS — acceptable today, forecast to breach.
  if (nz(i.futureVerdict) === "BREACH_BEFORE_NEXT_INTERVENTION") {
    provenance.push("future-state: BREACH_BEFORE_NEXT_INTERVENTION");
    var fwd = i.futureAdjustedLifeMonths != null ? (" forecast to reach the limit in ~" + i.futureAdjustedLifeMonths + " months") : "";
    var bni = i.futureNextInterventionMonths != null ? (", before the next planned intervention (" + i.futureNextInterventionMonths + " months)") : "";
    return {
      class: "FORWARD_TRAJECTORY_GOVERNS",
      governs: true,
      statement: "Governing reality: the asset is acceptable today but its forward trajectory governs (" + nz(i.futureDominantDriver) + ")" + fwd + bni + ". Today's remaining thickness is not the controlling risk.",
      disposition_driver: i.dispositionDriver || "forward-trajectory",
      contributing: contributing,
      provenance: provenance
    };
  }

  // 4b. ASSURANCE FAILURE / UNKNOWN STATE - uncertainty is the governing risk.
  //     >= 2 documented "loss of ability to know" facts (missing baseline, lost
  //     records, failed monitoring, unreviewed external change) + no confirmed
  //     critical defect: the asset is in an UNKNOWN state. Physical findings may be
  //     within limits, but they cannot be trusted as a basis for continued service.
  //     No damage mechanism is demonstrated (TEST 21). Facts only.
  var knowledgeGaps = matchedFacts(LOSS_OF_KNOWLEDGE_FACTS, t);
  if (knowledgeGaps.length >= 2) {
    provenance.push("transcript: " + knowledgeGaps.length + " documented loss-of-assurance-basis facts");
    if (i.governingFailureMode && nz(i.governingFailureMode) !== "NONE") {
      contributing.push("Inspection finding (" + nz(i.governingFailureMode).replace(/_/g, " ").toLowerCase() + ") is within limits and NOT a demonstrated governing mechanism");
    }
    return {
      class: "ASSURANCE_FAILURE_UNKNOWN_STATE",
      governs: true,
      statement: "Governing reality: the facility has lost the ability to know the asset's condition - documented gaps in the integrity-assurance basis (" + knowledgeGaps.join("; ") + "). No damage mechanism is demonstrated and the physical findings are within limits, but they cannot be trusted as a basis for continued service. The governing risk is the loss of assurance / unknown state itself - hold pending restoration of the ability to know (recover baseline & records, restore monitoring, review the external changes).",
      disposition_driver: i.dispositionDriver || "loss of integrity-assurance basis (unknown state) - not a demonstrated damage mechanism",
      contributing: contributing,
      provenance: provenance
    };
  }

  // 5. ORGANIZATIONAL ASSURANCE FAILURE — documented gaps, no specific mechanism.
  if ((i.orgFailureScore && i.orgFailureScore >= 5) || (i.orgIndicatorCount && i.orgIndicatorCount >= 2)) {
    provenance.push("organizational-failure: documented assurance gaps");
    return {
      class: "ORGANIZATIONAL_ASSURANCE_FAILURE",
      governs: true,
      statement: "Governing reality: documented integrity-assurance gaps (deferred inspections / incomplete reviews / missing MOC) govern — the asset's current condition is not assured by the management-of-integrity record. No specific damage mechanism is the controlling risk.",
      disposition_driver: i.dispositionDriver || "assurance-gap",
      contributing: contributing,
      provenance: provenance
    };
  }

  // 6. MEASURED DAMAGE GOVERNS — the confirmed mechanism is genuinely controlling.
  if (i.governingFailureMode && nz(i.governingFailureMode) !== "NONE") {
    provenance.push("FMD: governing_failure_mode (measured)");
    return {
      class: "MEASURED_DAMAGE_GOVERNS",
      governs: true,
      statement: "Governing reality: the measured mechanism (" + nz(i.governingFailureMode).replace(/_/g, " ").toLowerCase() + (i.governingSeverity ? ", " + nz(i.governingSeverity).toLowerCase() + " severity" : "") + ") is the controlling risk.",
      disposition_driver: i.dispositionDriver || nz(i.governingFailureMode),
      contributing: contributing,
      provenance: provenance
    };
  }

  // 7. INSUFFICIENT EVIDENCE — a HOLD with nothing else established.
  if (disp === "hold_for_review" || disp === "hold_for_input") {
    provenance.push("decision-core: hold_for_review");
    return {
      class: "INSUFFICIENT_EVIDENCE_HOLD",
      governs: true,
      statement: "Governing reality: insufficient evidence to establish a governing condition — the disposition is held pending the missing data.",
      disposition_driver: i.dispositionDriver || "insufficient-evidence",
      contributing: contributing,
      provenance: provenance
    };
  }

  // 8. NONE — honest fallback; assert nothing.
  return {
    class: "NONE",
    governs: false,
    statement: "No single governing reality is established from the available facts.",
    disposition_driver: i.dispositionDriver || null,
    contributing: contributing,
    provenance: provenance
  };
}
