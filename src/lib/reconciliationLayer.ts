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
import { deriveAuthority, checkAuthorityConsistency } from "./authorityDerivation";
import { Claim, reduceClaims, ConflictRecord } from "./noDestructiveOverride";

// ---- refused scopes (Tier-1 terminal) ----
var REFUSED_SCOPE_RE = /\b(?:nuclear|reactor core|spent fuel|aerospace|spacecraft|satellite|rocket|launch vehicle|medical|implant|surgical)\b/i;

// ---- small deterministic signal scans (facts only) ----
function dynamicSignalCount(t: string): number {
  var cats = [/vibrat/i, /slug/i, /transient|excursion|pressure (?:fluctuation|spike)/i, /unsupported span|free[- ]?span|loss of support/i, /cyclic/i, /throughput (?:increase|increased)|production increased|rate increased|increased flow/i, /reciprocating/i];
  var n = 0; for (var i = 0; i < cats.length; i++) { if (cats[i].test(t)) { n++; } } return n;
}
function withinLimitsLanguage(t: string): boolean {
  return /\bwithin (?:design )?(?:limits?|allowable|tolerance)\b|\bbelow (?:the )?(?:concern|allowable|threshold)\b|\bno significant (?:wall ?loss|metal ?loss|corrosion|crack)\b|\bno crack indications?\b|\bremain(?:s)? normal\b|\bno (?:coating|corrosion|tower tilt)\b/i.test(t);
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
    /never reviewed against/i
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
  var changed = /\b(?:throughput|production|rate|operating|feed|software|control)[^.]{0,40}(?:increas|chang|upgrad|modif|re-?rat)/i.test(t);
  var noReassess = /\bno (?:management[- ]of[- ]change|moc|reassessment|re-?assessment|review|re-?rate|engineering review)\b|without (?:a )?(?:management[- ]of[- ]change|moc|reassessment|review)/i.test(t);
  return changed && noReassess;
}

// ---- DETERMINISTIC AXIS FLOOR ----
export interface AxisDerivation extends GoverningTuple {
  evidence: { physical: string[]; assurance: string[]; operational: string[] };
}

export function deriveAxesDeterministic(transcript: string): AxisDerivation {
  var t = String(transcript || "");

  // PHYSICAL
  var fams = ["corrosion", "cracking", "structural"];
  var confirmed: string[] = []; var suspected: string[] = [];
  for (var i = 0; i < fams.length; i++) {
    var ev = classifyMechanismEvidence(fams[i], t);
    if (ev.level === "CONFIRMED") { confirmed.push(fams[i]); }
    else if (ev.level === "SUSPECTED") { suspected.push(fams[i]); }
  }
  var strongSuspected = dynamicSignalCount(t) >= 2;
  var physical: PhysicalCondition;
  var physEv: string[] = [];
  if (confirmed.length > 0) { physical = "CONFIRMED_DAMAGE"; physEv = confirmed.slice(); }
  else if (strongSuspected) { physical = "SUSPECTED"; physEv = ["dynamic-loading signals (" + dynamicSignalCount(t) + ")"]; }
  else if (withinLimitsLanguage(t)) { physical = "ACCEPTABLE"; physEv = ["findings within limits / non-finding"]; }
  else if (suspected.length > 0) { physical = "SUSPECTED"; physEv = suspected.slice(); }
  else { physical = "UNKNOWN"; }

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
  physicallyAcceptableNotDispositionable: boolean;
  finalMechanism: string | null;
  finalDisposition: string;
  conflicts: ConflictRecord[];
  vetoes: Veto[];
  confidenceAdjustment: number;
  requiresHumanReview: boolean;
}

var CONFIDENCE_FLOOR = 0.60;

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
  var det = deriveAxesDeterministic(t);
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

  // ---- DISPOSITION (function of the tuple) ----
  var tuple: GoverningTuple = { physical: physical, assurance: assurance, operational: operational };
  var dualHold = isPhysicallyAcceptableButNotDispositionable(tuple);
  var disposition: string;
  if (vetoes.length && vetoes[0].type === "scope") { disposition = "refer_out_of_scope"; }
  else if (physical === "CONFIRMED_DAMAGE") { disposition = "fitness_for_service_required"; }
  else if (dualHold) { disposition = "restricted_reassessment_required"; }
  else if (physical === "SUSPECTED") { disposition = "monitor_and_inspect"; }
  else if (physical === "UNKNOWN") { disposition = "hold_for_review"; }
  else { disposition = "continue_with_conditions"; }

  // ---- TIER-1: hard confidence floor ----
  var agg = (typeof input.aggregateConfidence === "number") ? input.aggregateConfidence : (hypOk ? (Number(hyp.asset && hyp.asset.confidence) || 0.7) : 0.7);
  if (agg < CONFIDENCE_FLOOR && disposition.indexOf("hold") < 0 && disposition !== "refer_out_of_scope") {
    vetoes.push({ tier: 1, type: "confidence_floor", reason: "Tier-1 confidence floor: aggregate confidence " + agg + " < " + CONFIDENCE_FLOOR + "; forced HOLD." });
    disposition = "hold_for_review";
    requiresHumanReview = true;
  }

  // ---- TIER-2: a surfaced asset conflict raises review ----
  if (conflicts.length > 0) { requiresHumanReview = true; }

  return {
    finalAsset: finalAsset,
    finalAuthority: derived.primary,
    authorityCodes: derived.codes,
    governingReality: tuple,
    governingLabel: describeTuple(tuple),
    physicallyAcceptableNotDispositionable: dualHold,
    finalMechanism: finalMechanism,
    finalDisposition: disposition,
    conflicts: conflicts,
    vetoes: vetoes,
    confidenceAdjustment: conflicts.length ? -0.15 * conflicts.length : 0,
    requiresHumanReview: requiresHumanReview
  };
}
