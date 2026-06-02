/**
 * FORGED GOVERNANCE PIPELINE — REFERENCE CONTRACT
 * File: src/lib/governancePipeline.ts  (companion to src/lib/roleAuthority.ts)
 *
 * WHAT THIS IS
 * The explicit three-stage structure for "core does its technical job first,
 * then the situation is evaluated." It encodes the one rule that fixes TEST 24/25:
 *
 *     Order of COMPUTATION is sequential (physics first, clean).
 *     Order of AUTHORITY is NOT — governance is a peer contest, decided after.
 *     "No physical defect" is an INPUT to governance, never an automatic CONTINUE.
 *
 * STAGES
 *   1. Technical evaluation  — existing engines (FMD + non-physical guard, mechanism
 *      catalog, remaining-life, code engines). Clean, isolated, SA never touches it.
 *      Output may legitimately be "no physical defect."
 *   2. Governance contest    — THE NEW CODE BELOW. Physical / Operational / Assurance
 *      axes compete as peers on EVIDENCE, not on running order. Determines what governs.
 *   3. Disposition + RAE      — roleAuthority.ts (roles, conflicts, escalation, hard locks).
 *
 * INTEGRATION NOTES FOR THE BUILDING INSTANCE
 *   - Stage 1 and Stage 3 are typed ADAPTERS. Bind `evaluateTechnical` to the real
 *     engine output and `runRoleAuthority` to roleAuthority.ts. Do not reimplement them.
 *   - If the reconciliation layer ALREADY computes a three-axis governing reality, this
 *     module formalizes that contest — FOLD IT IN, do not add a parallel governance path.
 *     One governance authority only. (Guardrail: no parallel disposition paths.)
 *   - This is src/lib TypeScript (like roleAuthority.ts). If any part lands in
 *     netlify/functions/*.js instead, that file must be pure JS: no template literals,
 *     var only, string concat, module.exports.
 *   - No manufactured scores anywhere. The contest ranks by EVIDENCE TIER (an enum),
 *     never a synthesized 0-100 risk/confidence number.
 *
 * THE NO-DEFAULT GUARANTEE (why this fixes the bias)
 *   Physical ACCEPTABLE never produces CONTINUE just because it ran first. CONTINUE is
 *   only reached when (a) nothing adverse bids AND (b) assurance is ESTABLISHED. An
 *   adverse operational or assurance bid GOVERNS over a clean physical pass.
 */

/* ----------------------------------------------------------------------------
 * AXIS STATES (closed enums — these are the three-axis tuple, not new buckets)
 * -------------------------------------------------------------------------- */

// DEPLOY455: axis-state enums are IMPORTED from governingAxes.ts (the live, authoritative
// definitions), not redefined here. One enum source of truth - redefining them locally is the
// drift this phase exists to kill, and it is why FLEET_PATTERN (live) was missing from the
// contract's first draft. isAdverse() treats any operational state != STABLE as adverse, so
// FLEET_PATTERN and any future operational state govern uniformly with no list to maintain.
import {
  PhysicalCondition as PhysicalState,
  AssuranceState,
  OperationalChange as OperationalState
} from "./governingAxes";

export type { PhysicalState, AssuranceState, OperationalState };

export type Axis = "PHYSICAL" | "ASSURANCE" | "OPERATIONAL";

/* ----------------------------------------------------------------------------
 * EVIDENCE TIER (provenance, not a score). Ranking is by tier, never a number.
 * -------------------------------------------------------------------------- */

export type EvidenceTier =
  | "DIRECT_MEASURED"    // instrument/inspection datum (UT thickness, flow/power)
  | "DOCUMENTED"         // records (MOC status, cert expiry, maintenance backlog)
  | "ABSENCE_CONFIRMED"  // a clean exam that affirmatively shows no defect
  | "NONE";              // no admissible evidence -> the axis cannot bid

const TIER_RANK: Record<EvidenceTier, number> = {
  DIRECT_MEASURED: 3,
  DOCUMENTED: 2,
  ABSENCE_CONFIRMED: 1,
  NONE: 0,
};

/* ----------------------------------------------------------------------------
 * BIDS — each axis submits at most one bid. An axis with only inferred/forbidden
 * inputs (e.g., assumed "production pressure") supplies tier NONE and cannot govern.
 * -------------------------------------------------------------------------- */

export interface AxisBid {
  axis: Axis;
  state: PhysicalState | AssuranceState | OperationalState;
  tier: EvidenceTier;
  evidenceRefs: string[]; // pointers to transcript facts / inspection data
  rationale: string;      // factual, no motive/feeling language
}

/** A bid is adverse if its state departs from the clean baseline for its axis. */
function isAdverse(bid: AxisBid): boolean {
  if (bid.tier === "NONE") return false;
  switch (bid.axis) {
    case "PHYSICAL":
      return bid.state === "SUSPECTED" || bid.state === "CONFIRMED_DAMAGE";
    case "ASSURANCE":
      return bid.state !== "ESTABLISHED";
    case "OPERATIONAL":
      return bid.state !== "STABLE";
  }
}

/* ----------------------------------------------------------------------------
 * HARD AUTHORITY — supplied by RAE roles. Safety hazard / code nonconformance /
 * not-fit-for-service gate the disposition regardless of the axis contest.
 * -------------------------------------------------------------------------- */

export interface HardLock {
  source: "SAFETY" | "CODE" | "ENGINEER";
  citation: string;     // e.g. "OSHA 1910.119(l)", "API 579 Level 2"
  statement: string;    // factual nonconformance / hazard statement
}

/* ----------------------------------------------------------------------------
 * STAGE 2 OUTPUT
 * -------------------------------------------------------------------------- */

export type DispositionClass =
  | "CONTINUE"               // earned: no adverse bid AND assurance established
  | "REASSESS_OPERATION"     // operational governs (TEST 24)
  | "VERIFY_ASSURANCE"       // assurance governs (TEST 25)
  | "FITNESS_FOR_SERVICE"    // physical damage governs
  | "HOLD_FOR_INPUT"         // basis insufficient to dispose
  | "ESCALATE_CONFLICT";     // multiple adverse governing concerns

export interface GovernanceResult {
  governingAxis: Axis | "MULTIPLE" | "NONE";
  governingState: AxisBid["state"] | "ACCEPTABLE";
  disposition: DispositionClass;
  hardLocked: boolean;
  governingBids: AxisBid[];  // the bid(s) that drove the result
  hardLocks: HardLock[];
  escalationRequired: boolean;
}

/* ----------------------------------------------------------------------------
 * STAGE 2 — THE GOVERNANCE CONTEST (the new logic)
 * -------------------------------------------------------------------------- */

export function runGovernanceContest(
  bids: AxisBid[],
  hardLocks: HardLock[]
): GovernanceResult {
  // (0) Hard authority gates first — a safety hazard or code nonconformance
  //     forces escalation regardless of the axis contest.
  if (hardLocks.length > 0) {
    return {
      governingAxis: "MULTIPLE",
      governingState: "ACCEPTABLE",
      disposition: "HOLD_FOR_INPUT",
      hardLocked: true,
      governingBids: [],
      hardLocks: hardLocks,
      escalationRequired: true,
    };
  }

  var adverse = bids.filter(isAdverse);

  // (1) No adverse bid anywhere. CONTINUE must still be EARNED, not defaulted.
  if (adverse.length === 0) {
    var assurance = bids.find(function (b) { return b.axis === "ASSURANCE"; });
    var assuranceEstablished =
      !!assurance && assurance.state === "ESTABLISHED" && assurance.tier !== "NONE";

    if (assuranceEstablished) {
      // Clean physics + verified basis -> continue is legitimately earned.
      return {
        governingAxis: "PHYSICAL",
        governingState: "ACCEPTABLE",
        disposition: "CONTINUE",
        hardLocked: false,
        governingBids: bids.filter(function (b) { return b.axis === "PHYSICAL"; }),
        hardLocks: [],
        escalationRequired: false,
      };
    }

    // No defect found, but we cannot confirm the basis -> NOT continue.
    return {
      governingAxis: "ASSURANCE",
      governingState: "UNKNOWN_STATE",
      disposition: "HOLD_FOR_INPUT",
      hardLocked: false,
      governingBids: assurance ? [assurance] : [],
      hardLocks: [],
      escalationRequired: false,
    };
  }

  // (2) Exactly one adverse bid -> that axis governs. (No physical default:
  //     an adverse operational/assurance bid governs over a clean physical pass.)
  if (adverse.length === 1) {
    var b = adverse[0];
    return {
      governingAxis: b.axis,
      governingState: b.state,
      disposition: dispositionForAxis(b),
      hardLocked: false,
      governingBids: [b],
      hardLocks: [],
      escalationRequired: b.axis !== "PHYSICAL", // non-physical governance escalates by default
    };
  }

  // (3) Multiple adverse bids -> multiple governing concerns. Do NOT pick a winner
  //     by weighting. Surface all and escalate; RAE's conflict engine renders them.
  var ranked = adverse.slice().sort(function (x, y) {
    return TIER_RANK[y.tier] - TIER_RANK[x.tier];
  });
  return {
    governingAxis: "MULTIPLE",
    governingState: ranked[0].state,
    disposition: "ESCALATE_CONFLICT",
    hardLocked: false,
    governingBids: ranked,
    hardLocks: [],
    escalationRequired: true,
  };
}

function dispositionForAxis(b: AxisBid): DispositionClass {
  switch (b.axis) {
    case "PHYSICAL":
      return "FITNESS_FOR_SERVICE";
    case "OPERATIONAL":
      return "REASSESS_OPERATION";
    case "ASSURANCE":
      return "VERIFY_ASSURANCE";
  }
}

/* ----------------------------------------------------------------------------
 * STAGE 1 + STAGE 3 ADAPTERS — bind these to existing code, do not reimplement.
 * -------------------------------------------------------------------------- */

export interface TechnicalTruth {
  physical: AxisBid;          // from the existing FMD/mechanism/remaining-life engines
  assurance: AxisBid;         // from data-integrity / monitoring evaluation
  operational: AxisBid;       // from operating-envelope / process evaluation
  hardLocks: HardLock[];      // safety/code nonconformance surfaced by the engines
}

export interface PipelineDeps {
  // STAGE 1: existing technical engines. Must NOT see SA/role context.
  evaluateTechnical: (input: unknown) => TechnicalTruth;
  // STAGE 3: roleAuthority.ts — roles, conflicts, escalation, hard-lock application.
  runRoleAuthority: (input: unknown, gov: GovernanceResult) => unknown;
}

export interface PipelineResult {
  technical: TechnicalTruth;
  governance: GovernanceResult;
  roleAuthority: unknown; // shape owned by roleAuthority.ts
}

export function runForgedPipeline(input: unknown, deps: PipelineDeps): PipelineResult {
  // STAGE 1 — clean technical truth, isolated.
  var technical = deps.evaluateTechnical(input);

  // STAGE 2 — peer-governance contest over the three axes.
  var governance = runGovernanceContest(
    [technical.physical, technical.assurance, technical.operational],
    technical.hardLocks
  );

  // STAGE 3 — disposition, roles, conflicts, escalation.
  var roleAuthority = deps.runRoleAuthority(input, governance);

  return { technical: technical, governance: governance, roleAuthority: roleAuthority };
}

/* ----------------------------------------------------------------------------
 * WORKED TRACES (the cases that were breaking) — keep as golden tests.
 *
 * TEST 24 — Qatar LNG compressor, machine healthy, production +11% / flow +2% / power +6%
 *   physical:    ACCEPTABLE,           ABSENCE_CONFIRMED  (clean exam, no defect)
 *   assurance:   ESTABLISHED,          DOCUMENTED
 *   operational: CHANGED_UNREASSESSED, DIRECT_MEASURED    (the 11/2/6% deviation)
 *   -> one adverse bid (operational) GOVERNS -> REASSESS_OPERATION + escalate.
 *   NOT "continue", NOT manufactured corrosion.
 *
 * TEST 25 — monitoring/instrumentation system, no degradation evidence
 *   physical:    ACCEPTABLE,    ABSENCE_CONFIRMED
 *   assurance:   UNKNOWN_STATE, DOCUMENTED  (unvalidated algorithm / patch lag)
 *   operational: STABLE,        DOCUMENTED
 *   -> one adverse bid (assurance) GOVERNS -> VERIFY_ASSURANCE.
 *   "Monitoring assurance failure", no invented physical mechanism.
 *
 * Normal physical case — characterized wall loss
 *   physical:    CONFIRMED_DAMAGE, DIRECT_MEASURED (UT)
 *   -> physical GOVERNS -> FITNESS_FOR_SERVICE. The 90% the platform was always good at.
 *
 * Healthy + verified — clean exam, basis confirmed
 *   physical ACCEPTABLE/ABSENCE_CONFIRMED, assurance ESTABLISHED, operational STABLE
 *   -> CONTINUE, earned (not defaulted).
 * -------------------------------------------------------------------------- */
