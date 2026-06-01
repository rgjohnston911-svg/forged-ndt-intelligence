// ============================================================================
// noDestructiveOverride.ts - PHASE 7: the seven rules that stop an automated
// step from silently replacing a better-grounded finding with a worse one.
// This is the safety spine the reconciliation layer (Phase 9) sits on. It is the
// generalization of the TEST 22 lesson: a weak/default/keyword signal may NEVER
// overwrite a confident, explicit, component-level finding - and any conflict is
// SURFACED, never hidden.
//
// The seven rules:
//   1. Low confidence cannot override high confidence.
//   2. Defaults (isDefault) cannot override explicit findings.
//   3. Facility classification cannot override component classification.
//   4. Domain keyword cannot override an explicit asset.
//   5. Jurisdiction keyword cannot override an explicit asset.
//   6. Conflicts are surfaced.
//   7. Conflicts are never hidden.
//
// Pure module. No imports, no network.
// ============================================================================

// kinds, ranked by how grounded the signal is (lower index = stronger basis)
export type ClaimKind =
  | "explicit-asset"      // named by an explicit asset/component noun
  | "component"           // component-level finding (piping/nozzle/spool ...)
  | "facility"            // facility/equipment context (reactor/unit/plant)
  | "domain-keyword"      // matched a domain keyword tally
  | "jurisdiction-keyword"// matched a jurisdiction keyword
  | "default";            // fell back to a default; no evidence

export interface Claim {
  value: string;
  confidence: number;        // 0..1
  kind: ClaimKind;
  isDefault?: boolean;
  evidence?: string[];
  source?: string;
}

export interface OverrideDecision {
  winner: Claim;
  overridden: boolean;       // did `proposed` replace `current`?
  conflict: boolean;         // do the two claims disagree on value?
  reasons: string[];         // human-readable, always populated when there is a conflict
}

var CONFIDENCE_MARGIN = 0.10; // proposed must beat current by this to win on confidence alone

function isExplicit(k: ClaimKind): boolean { return k === "explicit-asset" || k === "component"; }
function isKeywordOrDefault(k: ClaimKind): boolean {
  return k === "domain-keyword" || k === "jurisdiction-keyword" || k === "default";
}

// Decide whether `proposed` may override `current`. `current` is the incumbent
// (treated as the better-grounded default to protect); `proposed` is the challenger.
export function resolveOverride(current: Claim, proposed: Claim): OverrideDecision {
  var reasons: string[] = [];
  var conflict = String(current.value) !== String(proposed.value);

  // Rules that BLOCK the override regardless of confidence:
  // 2. a default cannot override an explicit/non-default finding
  if (proposed.isDefault && !current.isDefault) {
    if (conflict) { reasons.push("Rule 2: a default ('" + proposed.value + "') cannot override an explicit finding ('" + current.value + "')."); }
    return { winner: current, overridden: false, conflict: conflict, reasons: reasons };
  }
  // 3. facility cannot override component
  if (proposed.kind === "facility" && current.kind === "component") {
    if (conflict) { reasons.push("Rule 3: facility classification ('" + proposed.value + "') cannot override component classification ('" + current.value + "')."); }
    return { winner: current, overridden: false, conflict: conflict, reasons: reasons };
  }
  // 4 & 5. a domain/jurisdiction keyword cannot override an explicit asset
  if (isKeywordOrDefault(proposed.kind) && isExplicit(current.kind)) {
    if (conflict) {
      var rule = proposed.kind === "jurisdiction-keyword" ? "Rule 5" : "Rule 4";
      reasons.push(rule + ": a " + proposed.kind + " ('" + proposed.value + "', conf " + proposed.confidence + ") cannot override an explicit asset ('" + current.value + "', conf " + current.confidence + ").");
    }
    return { winner: current, overridden: false, conflict: conflict, reasons: reasons };
  }
  // 1. low confidence cannot override high confidence
  if (proposed.confidence < current.confidence + CONFIDENCE_MARGIN) {
    if (conflict) { reasons.push("Rule 1: proposed confidence " + proposed.confidence + " does not exceed current " + current.confidence + " by the margin; no override."); }
    return { winner: current, overridden: false, conflict: conflict, reasons: reasons };
  }

  // Otherwise the challenger is better grounded AND meaningfully more confident -> it wins.
  if (conflict) { reasons.push("Override accepted: '" + proposed.value + "' (conf " + proposed.confidence + ", " + proposed.kind + ") supersedes '" + current.value + "' (conf " + current.confidence + ", " + current.kind + ")."); }
  return { winner: proposed, overridden: true, conflict: conflict, reasons: reasons };
}

export interface ConflictRecord {
  current: string;
  proposed: string;
  outcome: string;          // value that won
  overridden: boolean;
  reasons: string[];
}

// Fold an ordered list of claims (first = initial incumbent) into a single winner,
// accumulating every conflict (rules 6 & 7: surfaced, never hidden).
export interface ReduceResult {
  winner: Claim;
  conflicts: ConflictRecord[];
}
export function reduceClaims(claims: Claim[]): ReduceResult {
  var conflicts: ConflictRecord[] = [];
  if (!claims || claims.length === 0) {
    return { winner: { value: "unknown", confidence: 0, kind: "default", isDefault: true }, conflicts: conflicts };
  }
  var current = claims[0];
  for (var i = 1; i < claims.length; i++) {
    var d = resolveOverride(current, claims[i]);
    if (d.conflict) {
      conflicts.push({
        current: current.value, proposed: claims[i].value,
        outcome: d.winner.value, overridden: d.overridden, reasons: d.reasons
      });
    }
    current = d.winner;
  }
  return { winner: current, conflicts: conflicts };
}
