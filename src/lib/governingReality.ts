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

// Control / network-behaviour drift signals (documented facts only). A cluster of
// these with NO confirmed material defect means the governing reality is loss of the
// validated operating envelope - not a damage mechanism (TEST 17/18).
var SYSTEM_DRIFT_SIGNALS: Array<{ re: RegExp; fact: string }> = [
  { re: /instability index|stability index/i, fact: "a rising system-stability index" },
  { re: /cross-unit|cross-domain|cross unit|cross domain/i, fact: "rising cross-unit / cross-domain correlation" },
  { re: /correlation (?:increasing|confidence|rising)|correlation.{0,15}(?:increasing|\d{2}%)/i, fact: "rising behavioural correlation across systems" },
  { re: /\bapc\b|advanced process control|optimization software|optimisation software|network optimization|network optimisation/i, fact: "an advanced-process-control / optimization software change" },
  { re: /control loops?[^.]{0,25}(?:adjust|hunt)|hunts more|continuously adjusting|loop hunting|system .?hunts/i, fact: "control loops hunting / continuously adjusting" },
  { re: /anti-?surge|surge event/i, fact: "increased anti-surge / surge activity" },
  { re: /analy[sz]ers?[^.]{0,30}(?:disagree|differ|disagreement)|disagreement[^.]{0,20}analy[sz]er|intermittent disagreement/i, fact: "analyzer disagreement (conflicting measured reality)" },
  { re: /no single owner|ownership[^.]{0,20}(?:distributed|gap|unclear)|position eliminated|no group (?:believes|owns)|no.{0,5}owner/i, fact: "loss of single-system ownership" },
  { re: /machine learning|ml anomaly|analytics engine|anomaly detection|ml (?:output|alert|warning)/i, fact: "an ML / analytics cross-correlation alert" }
];

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
