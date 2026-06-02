/**
 * FORGED GOVERNANCE CONTEST — CORRECTED CONTRACT (v2)
 * File: src/lib/governancePipeline.ts  (REPLACE the v1 module wholesale)
 *
 * WHY v2 EXISTS — the CP2 correction.
 * v1 conflated "multiple adverse axes" with "conflict": §4.2 defined conflict as
 * directional incompatibility, but runGovernanceContest implemented it as
 * `adverse.length > 1` (a count). That over-fired on causally-linked, same-direction
 * cases (TEST 25/E, F, D) and made the contest fail its own golden traces.
 *
 * THE FIX, in one idea:
 *   Among the three axes, EVERY adverse state points the same coarse direction —
 *   "do not simply continue; investigate." (assurance→VERIFY, operational→REASSESS,
 *   physical→ASSESS/FFS). None maps to CONTINUE. So two adverse axes can never be
 *   directionally incompatible. The axis contest therefore NEVER emits
 *   ESCALATE_CONFLICT — it always resolves adverse axes by MERGE.
 *
 *   Directional conflict (CONTINUE/FFS vs RESTRICT/STOP) is a ROLE-layer phenomenon
 *   — the RAE cross-discipline conflict engine (Engineer "Fit For Service" vs Safety
 *   "Restricted"). ESCALATE_CONFLICT is emitted there and composed ON TOP of the axis
 *   governing reality by the caller. It does not live in this module.
 *
 *   "Physical-lead" is NOT a rule. Physical governs only when it is the causal
 *   manifestation (D) or the strongest-evidence concern in a compound — never because
 *   it is physical. There is no physical default anywhere in this file.
 */

/* ----------------------------------------------------------------------------
 * AXIS STATES (closed enums — the three-axis tuple)
 * -------------------------------------------------------------------------- */

// DEPLOY456: axis-state enums IMPORTED from governingAxes.ts (one source of truth, the CP1
// fix). Redefining them here is the drift this phase kills. OperationalChange (live) is
// STABLE | CHANGED_UNREASSESSED | FLEET_PATTERN; OUTSIDE_ENVELOPE is a future state - add it to
// governingAxes when a recognizer needs it. isAdverse() checks != STABLE, so no literal needed.
import {
  PhysicalCondition as PhysicalState,
  AssuranceState,
  OperationalChange as OperationalState
} from "./governingAxes";

export type { PhysicalState, AssuranceState, OperationalState };

export type Axis = "PHYSICAL" | "ASSURANCE" | "OPERATIONAL";

/* ----------------------------------------------------------------------------
 * EVIDENCE TIER (provenance, NOT a synthesized risk score)
 * -------------------------------------------------------------------------- */

export type EvidenceTier =
  | "DIRECT_MEASURED" | "DOCUMENTED" | "ABSENCE_CONFIRMED" | "NONE";

const TIER_RANK: Record<EvidenceTier, number> = {
  DIRECT_MEASURED: 3, DOCUMENTED: 2, ABSENCE_CONFIRMED: 1, NONE: 0,
};

/* ----------------------------------------------------------------------------
 * (Q1) AXIS BID — with the causal field.
 *
 * causedBy is set ONLY on the EFFECT bid, and names the CAUSE axis. Semantics:
 *   "My adverse state shares a causal root with <causedBy>; I am the effect/
 *    manifestation, <causedBy> is the cause."
 * It is set by PERCEPTION (the bid producer), never inferred by the contest.
 * It is one-directional (effect -> cause); perception sets it on one bid only.
 * -------------------------------------------------------------------------- */

export interface AxisBid {
  axis: Axis;
  state: PhysicalState | AssuranceState | OperationalState;
  tier: EvidenceTier;
  evidenceRefs: string[];
  rationale: string;            // factual; no motive/feeling language
  causedBy?: Axis;              // set on the EFFECT bid only; names the cause axis
}

/** Adverse = state departs from the clean baseline for its axis. */
function isAdverse(bid: AxisBid): boolean {
  if (bid.tier === "NONE") return false;
  switch (bid.axis) {
    case "PHYSICAL":    return bid.state === "SUSPECTED" || bid.state === "CONFIRMED_DAMAGE";
    case "ASSURANCE":   return bid.state !== "ESTABLISHED";
    case "OPERATIONAL": return bid.state !== "STABLE";
  }
}

/* ----------------------------------------------------------------------------
 * (Q2) DIRECTION MAP — and why no axis pairing is "incompatible".
 *
 * Coarse direction is used ONLY to decide merge-vs-conflict. A non-adverse axis is
 * CONTINUE; every adverse axis is INVESTIGATE. Two adverse axes are therefore always
 * INVESTIGATE/INVESTIGATE = SAME direction = MERGE. There is no axis state that maps
 * to a direction opposing another axis, so the axis contest has no conflict branch.
 *
 * (If a future axis state ever mapped to an opposing direction, the conflict branch
 * would belong here. Today none does — conflict is a role-layer concept.)
 * -------------------------------------------------------------------------- */

type Direction = "CONTINUE" | "INVESTIGATE";

function axisDirection(bid: AxisBid): Direction {
  return isAdverse(bid) ? "INVESTIGATE" : "CONTINUE";
}

export type DispositionClass =
  | "CONTINUE"
  | "REASSESS_OPERATION"     // operational governs
  | "VERIFY_ASSURANCE"       // assurance governs
  | "FITNESS_FOR_SERVICE"    // physical governs (suspected -> screening; confirmed -> FFS)
  | "HOLD_FOR_INPUT"
  | "ESCALATE_CONFLICT";     // emitted by the ROLE layer, composed on top — not by this contest

/** Per-state disposition for an adverse axis (the fine-grained action). */
function dispositionForAxisState(bid: AxisBid): DispositionClass {
  switch (bid.axis) {
    case "PHYSICAL":    return "FITNESS_FOR_SERVICE";
    case "ASSURANCE":   return "VERIFY_ASSURANCE";
    case "OPERATIONAL": return "REASSESS_OPERATION";
  }
}

/* ----------------------------------------------------------------------------
 * GOVERNANCE RESULT
 * -------------------------------------------------------------------------- */

export interface GovernanceResult {
  governingAxis: Axis | "MULTIPLE" | "NONE";
  governingState: AxisBid["state"] | "ACCEPTABLE";
  disposition: DispositionClass;             // lead disposition (manifestation / strongest-tier)
  compound: boolean;                         // true when >1 independent same-direction axis governs
  governingBids: AxisBid[];                  // manifestation(s) that govern, ordered by evidence tier
  basisBids: AxisBid[];                      // causes absorbed as basis (render "X, driven by Y")
  additionalDispositions: DispositionClass[];// compound: the other governing axes' actions (the union)
  escalationRequired: boolean;
  // Directional ESCALATE_CONFLICT from the role layer is composed by the caller, not here.
}

/* ----------------------------------------------------------------------------
 * THE CONTEST — merge-only over the axes. No escalate branch.
 * -------------------------------------------------------------------------- */

export function runGovernanceContest(bids: AxisBid[]): GovernanceResult {
  var adverse = bids.filter(isAdverse);

  // (0) Nothing adverse. CONTINUE must be EARNED (assurance established), else HOLD.
  if (adverse.length === 0) {
    var assurance = bids.find(function (b) { return b.axis === "ASSURANCE"; });
    var established = !!assurance && assurance.state === "ESTABLISHED" && assurance.tier !== "NONE";
    if (established) {
      return {
        governingAxis: "PHYSICAL", governingState: "ACCEPTABLE", disposition: "CONTINUE",
        compound: false,
        governingBids: bids.filter(function (b) { return b.axis === "PHYSICAL"; }),
        basisBids: [], additionalDispositions: [], escalationRequired: false,
      };
    }
    return {
      governingAxis: "ASSURANCE", governingState: "UNKNOWN_STATE", disposition: "HOLD_FOR_INPUT",
      compound: false, governingBids: assurance ? [assurance] : [],
      basisBids: [], additionalDispositions: [], escalationRequired: false,
    };
  }

  // All adverse axes share the INVESTIGATE direction (see axisDirection). They MERGE.

  // (Q3) CAUSAL MERGE: an effect bid (causedBy points at another *adverse* bid) absorbs
  //      that cause. The cause is removed from the governing set and carried as basis.
  var absorbedCause: Record<string, boolean> = {};
  adverse.forEach(function (b) {
    if (b.causedBy && adverse.some(function (c) { return c.axis === b.causedBy; })) {
      absorbedCause[b.causedBy] = true;
    }
  });
  var governing = adverse.filter(function (b) { return !absorbedCause[b.axis]; });
  var basisBids = adverse.filter(function (b) { return absorbedCause[b.axis]; });

  // One manifestation governs (causal merge collapsed to one, or only one adverse axis).
  if (governing.length === 1) {
    var g = governing[0];
    return {
      governingAxis: g.axis, governingState: g.state, disposition: dispositionForAxisState(g),
      compound: false, governingBids: [g],
      basisBids: basisBids.filter(function (c) { return c.axis === g.causedBy; }),
      additionalDispositions: [],
      // Non-physical governing realities default to human-review escalation.
      escalationRequired: g.axis !== "PHYSICAL",
    };
  }

  // (Q4) COMPOUND MERGE: >1 governing axis, all same-direction, no causal link between them.
  //      ALL govern — none is dropped. No weighting: order is by EVIDENCE TIER for
  //      presentation only; every governing axis's action is in the disposition union.
  var ranked = governing.slice().sort(function (x, y) {
    return TIER_RANK[y.tier] - TIER_RANK[x.tier];   // tie -> stable order; display only, never drops a concern
  });
  return {
    governingAxis: "MULTIPLE",
    governingState: ranked[0].state,
    disposition: dispositionForAxisState(ranked[0]),                 // lead, by evidence tier
    compound: true,
    governingBids: ranked,
    basisBids: basisBids,
    additionalDispositions: ranked.slice(1).map(dispositionForAxisState), // the rest of the union
    escalationRequired: true,
  };
}

/* ----------------------------------------------------------------------------
 * (Q5) HOW PERCEPTION RECORDS CAUSALITY  (bid-producer guidance — NOT contest logic)
 *
 * causedBy is set in the bid producer (reconciliation / the §3 recognizers), where the
 * evidence lives. The contest only reads it.
 *
 *  - change -> assurance (TEST 25 / E / F): STRUCTURALLY detectable on the deterministic
 *    floor. When the same unreviewed-change signal that raises the assurance
 *    loss-of-knowledge count also sets operational = CHANGED_UNREASSESSED, set
 *      assuranceBid.causedBy = "OPERATIONAL".
 *    This is also exactly the §3 assurance recognizer's job — build it once.
 *
 *  - change -> physical (D): generally NOT establishable on the deterministic floor
 *    (it is a physics/causal inference). RULE: NEVER fabricate the link.
 *      * If the LLM hypothesis supplies it (with a basis), honor it:
 *        physicalBid.causedBy = "OPERATIONAL".
 *      * If neither floor nor LLM establishes it, leave causedBy UNSET. The two adverse
 *        axes then COMPOUND-merge (both govern, tier-ordered). This is SAFE and still
 *        leads with the stronger-evidence axis — for D, physical (DIRECT_MEASURED) leads
 *        operational (DOCUMENTED), giving "fatigue lead, throughput contributing" with no
 *        invented link and no escalate.
 *
 *  The causal link is an ENHANCEMENT (collapses a compound into a single manifestation,
 *  cleaner output). Its ABSENCE never produces a conflict and never blocks a result.
 * -------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
 * WORKED TRACES (frozen golden) — verify CP2 against these.
 *
 * TEST 25 / BREAKER_E (monitoring):
 *   physical ACCEPTABLE/ABSENCE_CONFIRMED (non-adverse)
 *   assurance UNKNOWN_STATE/DOCUMENTED, causedBy=OPERATIONAL
 *   operational CHANGED_UNREASSESSED/DOCUMENTED
 *   -> causal merge absorbs OPERATIONAL -> ASSURANCE governs -> VERIFY_ASSURANCE,
 *      basis = the change. (not ESCALATE_CONFLICT) ✓
 *
 * BREAKER_F (flare-gas trust): same shape as E -> VERIFY_ASSURANCE. ✓
 *
 * BREAKER_D (vibration fatigue):
 *   physical SUSPECTED/DIRECT_MEASURED  operational CHANGED/DOCUMENTED  assurance ESTABLISHED
 *   - with causedBy (LLM): physical absorbs operational -> PHYSICAL governs -> FFS, fatigue lead. ✓
 *   - without causedBy (floor): compound, tier-ranked -> PHYSICAL leads (DIRECT_MEASURED > DOCUMENTED)
 *     -> FFS lead + REASSESS_OPERATION in the union. Still fatigue lead, safe. ✓
 *
 * BREAKER_A / B / C (single adverse): one axis governs. ✓
 *
 * Characterized wall loss: physical CONFIRMED_DAMAGE -> FITNESS_FOR_SERVICE. ✓ (no regression)
 *
 * ENGINEER (FFS) vs SAFETY (Restricted): a ROLE conflict — emitted by the RAE
 *   cross-discipline conflict engine, composed on top as ESCALATE_CONFLICT. The axis
 *   contest does not produce it. ✓
 * -------------------------------------------------------------------------- */
