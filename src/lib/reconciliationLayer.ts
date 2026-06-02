// ============================================================================
// reconciliationLayer.ts - PHASES 8 + 9: the layer where the inverted flow
// becomes the governing path. It consumes the LLM hypothesis (Phase 3) + the
// deterministic suite (classification Phase 4, authority derivation Phase 5,
// evidence gate Phase 6) and reconciles them under the no-destructive-override
// rules (Phase 7), applying TIER-1 hard vetoes (with cited reasons) and TIER-2
// advisories, and emits the THREE-AXIS governing tuple (Phase 3 model).
//
// Reproducibility (section 12): a DETERMINISTIC axis-derivation floor produces a
// valid tuple even when the hypothesis is absent or degraded - a wrong/absent
// hypothesis still hits the same deterministic wall. When the hypothesis IS
// present it enriches but never escapes the Tier-1 gates.
// ============================================================================
import {
  PhysicalCondition, AssuranceState, OperationalChange, GoverningTuple,
  toPhysicalCondition, toAssuranceState, toOperationalChange,
  isPhysicallyAcceptableButNotDispositionable, describeTuple
} from "./governingAxes";
import { classifyMechanismEvidence } from "./evidenceGate";
import { AxisBid, EvidenceTier, runGovernanceContest } from "./governancePipeline";
import { deriveAuthority, checkAuthorityConsistency } from "./authorityDerivation";
import { Claim, reduceClaims, ConflictRecord } from "./noDestructiveOverride";

// ---- refused scopes (Tier-1 terminal) ----
var REFUSED_SCOPE_RE = /\b(?:nuclear|reactor core|spent fuel|aerospace|spacecraft|satellite|rocket|launch vehicle|medical|implant|surgical)\b/i;

// ---- small deterministic signal scans (facts only) ----
function dynamicSignalCount(t: string): number {
  var cats = [/vibrat/i, /slug/i, /transient|pressure (?:fluctuation|spike|excursion)/i, /unsupported span|free[- ]?span|loss of support/i, /cyclic/i, /throughput (?:increase|increased)|production increased|rate increased|increased flow/i, /reciprocating/i];
  var n = 0; for (var i = 0; i < cats.length; i++) { if (cats[i].test(t)) { n++; } } return n;
}
function withinLimitsLanguage(t: string): boolean {
  return /\bwithin (?:design )?(?:limits?|allowable|tolerance|specification|spec)\b|\bbelow (?:the )?(?:concern|allowable|threshold)\b|\bno significant (?:wall ?loss|metal ?loss|corrosion|crack)\b|\bno crack indications?\b|\bremain(?:s)? normal\b|\bno (?:coating|corrosion|tower tilt|leaks?|faults?|equipment failures?)\b|\bquality (?:excursions?|issues?) none\b|\bproduct quality (?:remains )?acceptable\b/i.test(t);
}

// ---- ASSURANCE signals ----
function designBasisLost(t: string): boolean {
  return /design[- ]basis[^.]*(?:cannot be located|lost|missing|destroyed|unavailable)|(?:firing-design|design) basis (?:records )?(?:cannot be located|lost|missing|destroyed)/i.test(t);
}
function knowledgeLossCount(t: string): number {
  var sigs = [
    /baseline[^.]*(?:destroyed|lost|missing|cannot be located)/i,
    /records[^.]*(?:lost|destroyed|cannot be located|missing|unavailable)/i,
    /monitoring[^.]*(?:failed|unrepaired|offline|not (?:working|functioning))/i,
    /(?:advisory|external (?:change|review)|subsidence advisory)[^.]*(?:never reviewed|not reviewed|unreviewed)/i,
    /never reviewed against/i,
    // DEPLOY447 - information / monitoring-system assurance-failure signals: we may no
    // longer be able to TRUST what the monitor reports (the governing risk in TEST 25).
    /no (?:current )?validation of (?:the )?(?:monitoring )?(?:algorithms?|software|system)/i,
    /(?:monitoring )?algorithms?[^.]*modified/i,
    /documentation incomplete/i,
    /software support[^.]*expired/i,
    /support contract expired/i,
    /patch (?:level )?[^.]*(?:\d+\s*months?\s*behind|behind)/i,
    /database migration/i,
    /management of change[^.]{0,40}(?:not (?:formally )?closed|opened but not)/i,
    /(?:patch|change|modification|logic)[^.]{0,50}(?:not listed|not supported|unsupported)[^.]{0,30}(?:vendor|release notes)?/i,
    /not listed in[^.]{0,30}release notes/i,
    /control[- ]?logic patch|logic patch|software patch|firmware patch/i,
    /(?:independent|separate)[^.]{0,50}(?:transmitter|instrument|sensor)[^.]{0,50}(?:still shows?|spikes|disagree)/i,
    /no corresponding[^.]{0,40}(?:spikes|events|readings)[^.]{0,20}(?:are being )?recorded/i,
    /cannot be independently validated|no longer trust|cannot independently verify|do not trust what the software/i,
    /normalization error/i,
    /software[^.]*(?:suppress|incorrectly)/i
  ];
  var n = 0; for (var i = 0; i < sigs.length; i++) { if (sigs[i].test(t)) { n++; } } return n;
}

// ---- OPERATIONAL signals ----
function fleetPattern(t: string): boolean {
  var fleet = /\b(?:sister|fleet|multiple|several|other) (?:units?|turbines?|assets?|pumps?|compressors?|lines?|machines?)\b|rolled out across the fleet/i.test(t);
  var common = /\b(?:same software|same .{0,20}version|same .{0,20}revision|common factor|same .{0,20}contractor)\b/i.test(t);
  var failures = /\bfail(?:ure|ed|ures)?\b/i.test(t);
  return fleet && common && failures;
}
function changedUnreassessed(t: string): boolean {
  var changed = /\b(?:throughput|production|rate|operating|feed|software|control|algorithm)[^.]{0,40}(?:increas|chang|upgrad|modif|re-?rat)/i.test(t)
    || /(?:control logic |logic |software |firmware )?patch[^.]{0,20}(?:installed|applied|deployed)/i.test(t);
  var noReassess = /\bno (?:management[- ]of[- ]change|moc|reassessment|re-?assessment|review|re-?rate|engineering review)\b|without (?:a )?(?:management[- ]of[- ]change|moc|reassessment|review)/i.test(t)
    || /documentation incomplete|management of change[^.]{0,40}(?:not (?:formally )?closed|opened but not)|not listed in[^.]{0,30}release notes/i.test(t);
  // DEPLOY447 - a modified monitoring algorithm with no validation / incomplete documentation
  // is itself an unreassessed operating change (the basis for trusting the system changed).
  var unvalidatedChange = (/(?:algorithms?|software)[^.]*modif/i.test(t) || /modif[^.]*(?:algorithms?|software)/i.test(t)) && /(?:no (?:current )?validation|documentation incomplete|support[^.]*expired)/i.test(t);
  return (changed && noReassess) || unvalidatedChange;
}

// ---- DETERMINISTIC AXIS FLOOR ----
export interface AxisDerivation extends GoverningTuple {
  evidence: { physical: string[]; assurance: string[]; operational: string[] };
}

var NON_PHYSICAL_ASSETS: { [k: string]: boolean } = { "instrumentation_monitoring": true, "information_system": true, "control_system": true };

export function deriveAxesDeterministic(transcript: string, assetClass?: string): AxisDerivation {
  var t = String(transcript || "");
  var nonPhysical = !!(assetClass && NON_PHYSICAL_ASSETS[String(assetClass).toLowerCase()]);

  // PHYSICAL
  var physical: PhysicalCondition;
  var physEv: string[] = [];
  if (nonPhysical) {
    // a confidence-generating system (analyzers/monitors/software) has no physical damage
    // mechanism; its physical condition is ACCEPTABLE when findings are within spec, else UNKNOWN.
    physical = withinLimitsLanguage(t) ? "ACCEPTABLE" : "UNKNOWN";
    physEv = nonPhysical ? ["non-physical asset: no damage mechanism applies"] : [];
  } else {
    var fams = ["corrosion", "cracking", "structural"];
    var confirmed: string[] = []; var suspected: string[] = [];
    for (var i = 0; i < fams.length; i++) {
      var ev = classifyMechanismEvidence(fams[i], t);
      if (ev.level === "CONFIRMED") { confirmed.push(fams[i]); }
      else if (ev.level === "SUSPECTED") { suspected.push(fams[i]); }
    }
    var strongSuspected = dynamicSignalCount(t) >= 2;
    if (confirmed.length > 0) { physical = "CONFIRMED_DAMAGE"; physEv = confirmed.slice(); }
    else if (strongSuspected) { physical = "SUSPECTED"; physEv = ["dynamic-loading signals (" + dynamicSignalCount(t) + ")"]; }
    else if (withinLimitsLanguage(t)) { physical = "ACCEPTABLE"; physEv = ["findings within limits / non-finding"]; }
    else if (suspected.length > 0) { physical = "SUSPECTED"; physEv = suspected.slice(); }
    else { physical = "UNKNOWN"; }
  }

  // ASSURANCE
  var assurance: AssuranceState; var assEv: string[] = [];
  var kl = knowledgeLossCount(t);
  if (designBasisLost(t)) { assurance = "LOST_DESIGN_BASIS"; assEv = ["design basis records lost/destroyed"]; }
  else if (kl >= 2) { assurance = "UNKNOWN_STATE"; assEv = [kl + " loss-of-knowledge signals (baseline/records/monitoring/unreviewed change)"]; }
  else if (kl === 1) { assurance = "DEGRADED"; assEv = ["1 loss-of-knowledge signal"]; }
  else { assurance = "ESTABLISHED"; }

  // OPERATIONAL
  var operational: OperationalChange; var opEv: string[] = [];
  if (fleetPattern(t)) { operational = "FLEET_PATTERN"; opEv = ["common change + failures across sister/fleet units"]; }
  else if (changedUnreassessed(t)) { operational = "CHANGED_UNREASSESSED"; opEv = ["operating/throughput/software change without reassessment"]; }
  else { operational = "STABLE"; }

  return { physical: physical, assurance: assurance, operational: operational, evidence: { physical: physEv, assurance: assEv, operational: opEv } };
}

// ---- RECONCILE (Phases 8 + 9) ----
export interface Veto { tier: number; type: string; reason: string; }
export interface ReconcileInput {
  transcript: string;
  hypothesis?: any;             // LLMHypothesis | degraded; optional
  assetClaims?: Claim[];        // ordered classification claims (deterministic first)
  citedCodes?: string[];        // codes the hypothesis/legacy proposed
  aggregateConfidence?: number; // 0..1
}
export interface Reconciliation {
  finalAsset: string;
  finalAuthority: string | null;
  authorityCodes: string[];
  governingReality: GoverningTuple;
  governingLabel: string;
  governingStatement: string;
  physicallyAcceptableNotDispositionable: boolean;
  finalMechanism: string | null;
  finalDisposition: string;
  conflicts: ConflictRecord[];
  vetoes: Veto[];
  confidenceAdjustment: number;
  requiresHumanReview: boolean;
  // DEPLOY455 CP1 - perception output: the three axes as AxisBids for the governance contest.
  // Emitted now; the contest becomes the sole arbiter in CP2. Disposition above is unchanged here.
  bids: AxisBid[];
}

var CONFIDENCE_FLOOR = 0.60;

// DEPLOY455 CP1 - BID PRODUCER. Map each axis state + its evidence to an AxisBid. The tier is
// PROVENANCE (how do we know), never a score: DIRECT_MEASURED (instrument/inspection datum),
// DOCUMENTED (a recorded signal), ABSENCE_CONFIRMED (an affirmative clean/no-change finding),
// NONE (no admissible evidence -> the axis cannot bid). reconciliation = perception only.
function physicalTier(state: PhysicalCondition, refs: string[]): EvidenceTier {
  if (state === "CONFIRMED_DAMAGE") { return "DIRECT_MEASURED"; }
  if (state === "SUSPECTED") { return "DOCUMENTED"; }
  if (state === "ACCEPTABLE") { return refs.length > 0 ? "ABSENCE_CONFIRMED" : "NONE"; }
  return "NONE"; // UNKNOWN - not examined / insufficient
}
function assuranceTier(state: AssuranceState): EvidenceTier {
  // ESTABLISHED is inferred from the ABSENCE of loss-of-knowledge signals; the adverse states
  // each carry a documented signal (lost basis / records / monitoring / unreviewed change).
  return state === "ESTABLISHED" ? "ABSENCE_CONFIRMED" : "DOCUMENTED";
}
function operationalTier(state: OperationalChange): EvidenceTier {
  return state === "STABLE" ? "ABSENCE_CONFIRMED" : "DOCUMENTED";
}
function buildBids(tuple: GoverningTuple, ev: { physical: string[]; assurance: string[]; operational: string[] }): AxisBid[] {
  // CP2 (Q5): record the change->assurance causal link at PERCEPTION. When an operating/process/
  // software change made the operation adverse AND the assurance basis is doubted via loss-of-
  // knowledge signals (UNKNOWN_STATE/DEGRADED - the change is among those signals), the change is
  // the BASIS of the assurance doubt -> tag the assurance (effect) bid causedBy OPERATIONAL
  // (cause). The contest merges operational into assurance. NOT set for LOST_DESIGN_BASIS
  // (records loss, not the change) - that assurance concern stands on its own.
  var assuranceCausedByChange = (tuple.operational !== "STABLE")
    && (tuple.assurance === "UNKNOWN_STATE" || tuple.assurance === "DEGRADED");
  var assuranceBid: AxisBid = {
    axis: "ASSURANCE", state: tuple.assurance, tier: assuranceTier(tuple.assurance),
    evidenceRefs: ev.assurance.slice(), rationale: ev.assurance.join("; ") || "no loss-of-knowledge signals detected"
  };
  if (assuranceCausedByChange) { assuranceBid.causedBy = "OPERATIONAL"; }
  return [
    { axis: "PHYSICAL", state: tuple.physical, tier: physicalTier(tuple.physical, ev.physical),
      evidenceRefs: ev.physical.slice(), rationale: ev.physical.join("; ") || "no physical evidence in the account" },
    assuranceBid,
    { axis: "OPERATIONAL", state: tuple.operational, tier: operationalTier(tuple.operational),
      evidenceRefs: ev.operational.slice(), rationale: ev.operational.join("; ") || "no operating/process/software change detected" }
  ];
}

export function reconcile(input: ReconcileInput): Reconciliation {
  var t = String(input.transcript || "");
  var hyp = input.hypothesis || null;
  var hypOk = !!(hyp && hyp.meta && hyp.meta.ok);
  var vetoes: Veto[] = [];
  var conflicts: ConflictRecord[] = [];

  // ---- ASSET: reduce claims under the override rules ----
  var claims = (input.assetClaims && input.assetClaims.length) ? input.assetClaims.slice() : [];
  if (hypOk && hyp.asset && hyp.asset.value) {
    claims.push({ value: String(hyp.asset.value), confidence: Number(hyp.asset.confidence) || 0, kind: "explicit-asset", evidence: hyp.asset.evidence || [] });
  }
  var assetReduce = reduceClaims(claims.length ? claims : [{ value: "unknown", confidence: 0, kind: "default", isDefault: true }]);
  var finalAsset = assetReduce.winner.value;
  conflicts = conflicts.concat(assetReduce.conflicts);

  // ---- AXES: deterministic floor, optionally enriched by an ok hypothesis ----
  var det = deriveAxesDeterministic(t, finalAsset);
  var physical = det.physical, assurance = det.assurance, operational = det.operational;
  if (hypOk) {
    var hPhys = toPhysicalCondition(hyp.physicalCondition);
    var hAss = toAssuranceState(hyp.assuranceState);
    var hOp = toOperationalChange(hyp.operationalChange);
    // assurance/operational are reasoning-heavy: prefer the hypothesis when it is more
    // specific than the deterministic floor's default.
    if (hAss !== "ESTABLISHED" && assurance === "ESTABLISHED") { assurance = hAss; }
    if (hOp !== "STABLE" && operational === "STABLE") { operational = hOp; }
    // physical: take the hypothesis only if it does not CLAIM MORE than the evidence allows.
    if (hPhys === "CONFIRMED_DAMAGE" && physical !== "CONFIRMED_DAMAGE") {
      vetoes.push({ tier: 1, type: "evidence", reason: "Tier-1 evidence veto: hypothesis asserts CONFIRMED_DAMAGE but no direct evidence is present; downgraded to " + physical + "." });
      // keep deterministic physical (no direct evidence)
    } else if (physical === "UNKNOWN" && hPhys !== "UNKNOWN") {
      physical = hPhys; // hypothesis may resolve an UNKNOWN downward to ACCEPTABLE/SUSPECTED
    }
  }

  // ---- TIER-1: scope refusal ----
  var requiresHumanReview = false;
  if (REFUSED_SCOPE_RE.test(t)) {
    vetoes.push({ tier: 1, type: "scope", reason: "Tier-1 scope refusal: asset falls in a refused domain (nuclear/aerospace/spacecraft/medical); deterministic chain does not apply." });
    requiresHumanReview = true;
  }

  // ---- AUTHORITY: derived from the final asset; cited codes checked for consistency ----
  var derived = deriveAuthority(finalAsset);
  var cited = input.citedCodes || [];
  if (cited.length) {
    var cons = checkAuthorityConsistency(finalAsset, cited);
    if (cons.vetoed) {
      vetoes.push({ tier: 1, type: "consistency", reason: cons.reason });
      requiresHumanReview = true;
    }
  }

  // ---- MECHANISM (governing): only a CONFIRMED physical names a confirmed mechanism ----
  var finalMechanism: string | null = null;
  if (physical === "CONFIRMED_DAMAGE") { finalMechanism = det.evidence.physical[0] || "confirmed damage"; }
  else if (physical === "SUSPECTED") { finalMechanism = (det.evidence.physical[0] || "suspected mechanism") + " (suspected)"; }

  // ---- DISPOSITION: the GOVERNANCE CONTEST is the sole arbiter (DEPLOY456 CP2) ----
  // reconciliation = perception (the bids). runGovernanceContest = judgment. The enumerated
  // predicates (dualHold / assuranceGoverns) and the DEPLOY453 FLEET stopgap are DELETED:
  // isAdverse() treats any operational state != STABLE as adverse, so FLEET_PATTERN governs by
  // construction with no list to maintain. Directional ESCALATE_CONFLICT is a role-layer concern
  // (RAE), composed on top by the caller - the axis contest is merge-only.
  var tuple: GoverningTuple = { physical: physical, assurance: assurance, operational: operational };
  var __bids = buildBids(tuple, det.evidence);
  var gov = runGovernanceContest(__bids);
  // Map the contest DispositionClass -> the legacy disposition vocabulary the report/tests use.
  // Physical lead distinguishes CONFIRMED (FFS) from SUSPECTED (monitor) by the governing state.
  var disposition: string;
  if (gov.disposition === "CONTINUE") { disposition = "continue_with_conditions"; }
  else if (gov.disposition === "HOLD_FOR_INPUT") { disposition = "hold_for_review"; }
  else if (gov.disposition === "FITNESS_FOR_SERVICE") {
    disposition = (gov.governingState === "CONFIRMED_DAMAGE") ? "fitness_for_service_required" : "monitor_and_inspect";
  }
  else { disposition = "restricted_reassessment_required"; } // VERIFY_ASSURANCE / REASSESS_OPERATION / compound
  if (gov.escalationRequired) { requiresHumanReview = true; }
  // Tier-1 scope refusal overrides the contest (an out-of-scope asset is never dispositioned here).
  if (vetoes.length && vetoes[0].type === "scope") { disposition = "refer_out_of_scope"; }

  // ---- TIER-1: hard confidence floor ----
  var agg = (typeof input.aggregateConfidence === "number") ? input.aggregateConfidence : (hypOk ? (Number(hyp.asset && hyp.asset.confidence) || 0.7) : 0.7);
  if (agg < CONFIDENCE_FLOOR && disposition.indexOf("hold") < 0 && disposition !== "refer_out_of_scope") {
    vetoes.push({ tier: 1, type: "confidence_floor", reason: "Tier-1 confidence floor: aggregate confidence " + agg + " < " + CONFIDENCE_FLOOR + "; forced HOLD." });
    disposition = "hold_for_review";
    requiresHumanReview = true;
  }

  // ---- TIER-2: a surfaced asset conflict raises review ----
  if (conflicts.length > 0) { requiresHumanReview = true; }

  // Human-readable governing-reality statement (FACTS/PHYSICS ONLY; no behavioral inference).
  // This is what the live report renders as the top line - generated from the tuple, not a
  // legacy mechanism string, so an assurance/operational reality is never laundered into "corrosion".
  var gStmt = "";
  var assuranceClause = (tuple.assurance === "LOST_DESIGN_BASIS")
    ? "the design basis cannot be established (records lost)"
    : (tuple.assurance === "UNKNOWN_STATE")
      ? "the integrity-assurance basis cannot be established (monitoring/records/validation gaps)"
      : (tuple.assurance === "DEGRADED") ? "the integrity-assurance basis is degraded" : "";
  var opClause = (tuple.operational === "FLEET_PATTERN")
    ? "a fleet-wide pattern (common change with failures across sister units) governs the risk"
    : (tuple.operational === "CHANGED_UNREASSESSED") ? "an operating/process/software change was made without reassessment" : "";
  var assurancePresent = (tuple.assurance !== "ESTABLISHED");
  if (vetoes.length && vetoes[0].type === "scope") {
    gStmt = "Out of deterministic scope: " + vetoes[0].reason;
  } else if (gov.governingAxis === "PHYSICAL" && tuple.physical === "CONFIRMED_DAMAGE") {
    gStmt = "A confirmed physical damage mechanism governs" + (finalMechanism ? " (" + finalMechanism + ")" : "") + "; run fitness-for-service per the applicable code.";
  } else if (gov.governingAxis === "ASSURANCE") {
    // assurance governs (single, or operational absorbed as its causal basis)
    gStmt = "A monitoring/assurance failure governs: " + [assuranceClause, opClause].filter(function (x) { return !!x; }).join("; ")
      + ". The reported state cannot be independently validated (loss of confidence in the basis for continued service); this is the controlling risk, not a physical damage mechanism (" + describeTuple(tuple) + "). Disposition: continue physical operation with elevated, independent monitoring; reassessment/validation and escalation required.";
  } else if (gov.governingAxis === "OPERATIONAL" && tuple.operational === "FLEET_PATTERN") {
    gStmt = "A fleet-level pattern governs: " + opClause + ". The controlling risk is systemic, not a single-unit physical defect (" + describeTuple(tuple) + ").";
  } else if (gov.governingAxis === "OPERATIONAL") {
    gStmt = "The asset is physically acceptable on current findings, but it is NOT dispositionable: " + opClause
      + ". The governing reality is an operating/process change not yet reassessed (" + describeTuple(tuple) + "), not a physical damage mechanism. Disposition: restricted - reassessment required before continued service can be affirmed.";
  } else if (gov.governingAxis === "MULTIPLE") {
    // compound: >1 same-direction concern governs (no causal link collapsed them). Name them all,
    // and if assurance is among them keep the monitoring/assurance framing so a monitoring-trust
    // case still reads as assurance-governed alongside any suspected physical signal.
    var compoundParts: string[] = [];
    if (tuple.physical === "SUSPECTED" || tuple.physical === "CONFIRMED_DAMAGE") { compoundParts.push("a " + (tuple.physical === "CONFIRMED_DAMAGE" ? "confirmed" : "suspected") + " physical mechanism" + (finalMechanism ? " (" + finalMechanism + ")" : "")); }
    if (assuranceClause) { compoundParts.push(assuranceClause); }
    if (opClause) { compoundParts.push(opClause); }
    gStmt = "Multiple same-direction concerns govern (compound): " + compoundParts.join("; ") + ". "
      + (assurancePresent ? "A monitoring/assurance failure governs alongside the physical signal; the reported state cannot be independently validated. " : "")
      + "No single confirmed physical mechanism is established (" + describeTuple(tuple) + "). Disposition: restricted - reassessment/validation required; all governing concerns must be resolved.";
  } else if (gov.disposition === "HOLD_FOR_INPUT") {
    gStmt = "The asset is physically acceptable on current findings, but it is NOT dispositionable: "
      + [assuranceClause, opClause].filter(function (x) { return !!x; }).join("; ")
      + ". The governing reality is loss of confidence in the basis for continued service (" + describeTuple(tuple) + "), not a physical damage mechanism. Disposition: restricted - reassessment/validation required before continued service can be affirmed.";
  } else if (gov.governingAxis === "PHYSICAL" && tuple.physical === "SUSPECTED") {
    gStmt = "A suspected mechanism governs pending confirmation" + (finalMechanism ? " (" + finalMechanism + ")" : "") + (opClause ? "; " + opClause : "") + " (" + describeTuple(tuple) + "). Monitoring/inspection required; not yet a confirmed-damage disposition.";
  } else if (tuple.physical === "UNKNOWN") {
    gStmt = "The governing reality cannot be established from the available evidence (" + describeTuple(tuple) + "); HOLD for review.";
  } else {
    gStmt = "No confirmed damage mechanism governs; findings are within limits (" + describeTuple(tuple) + ").";
  }

  return {
    finalAsset: finalAsset,
    finalAuthority: derived.primary,
    authorityCodes: derived.codes,
    governingReality: tuple,
    governingLabel: describeTuple(tuple),
    governingStatement: gStmt,
    physicallyAcceptableNotDispositionable: isPhysicallyAcceptableButNotDispositionable(tuple),
    finalMechanism: finalMechanism,
    finalDisposition: disposition,
    conflicts: conflicts,
    vetoes: vetoes,
    confidenceAdjustment: conflicts.length ? -0.15 * conflicts.length : 0,
    requiresHumanReview: requiresHumanReview,
    bids: __bids
  };
}
