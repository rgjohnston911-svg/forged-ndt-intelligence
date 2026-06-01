// ============================================================================
// governingAxes.ts - the THREE-AXIS governing-reality model (Stabilization
// Directive v2.0, section 3). Replaces the growing single-ladder of named
// classes. Governing reality is the TUPLE (physical, assurance, operational),
// not one winner. Three closed, low-cardinality enums => ~48 combinations with
// ZERO enumeration growth. A new scenario slots into existing axis values
// instead of demanding a new class.
//
// Pure module: no imports, no network, no side effects. Safe to require from
// the frontend, the reconciliation layer, and the offline gates.
// ============================================================================

export type PhysicalCondition = "ACCEPTABLE" | "SUSPECTED" | "CONFIRMED_DAMAGE" | "UNKNOWN";
export type AssuranceState = "ESTABLISHED" | "DEGRADED" | "UNKNOWN_STATE" | "LOST_DESIGN_BASIS";
export type OperationalChange = "STABLE" | "CHANGED_UNREASSESSED" | "FLEET_PATTERN";

export var PHYSICAL_CONDITIONS: PhysicalCondition[] = ["ACCEPTABLE", "SUSPECTED", "CONFIRMED_DAMAGE", "UNKNOWN"];
export var ASSURANCE_STATES: AssuranceState[] = ["ESTABLISHED", "DEGRADED", "UNKNOWN_STATE", "LOST_DESIGN_BASIS"];
export var OPERATIONAL_CHANGES: OperationalChange[] = ["STABLE", "CHANGED_UNREASSESSED", "FLEET_PATTERN"];

export interface GoverningTuple {
  physical: PhysicalCondition;
  assurance: AssuranceState;
  operational: OperationalChange;
}

// ---- coercion (never throws; unknown/missing -> the safe default) ----
export function toPhysicalCondition(x: any): PhysicalCondition {
  var v = String(x == null ? "" : x).toUpperCase();
  return (PHYSICAL_CONDITIONS.indexOf(v as PhysicalCondition) >= 0) ? (v as PhysicalCondition) : "UNKNOWN";
}
export function toAssuranceState(x: any): AssuranceState {
  var v = String(x == null ? "" : x).toUpperCase();
  return (ASSURANCE_STATES.indexOf(v as AssuranceState) >= 0) ? (v as AssuranceState) : "UNKNOWN_STATE";
}
export function toOperationalChange(x: any): OperationalChange {
  var v = String(x == null ? "" : x).toUpperCase();
  return (OPERATIONAL_CHANGES.indexOf(v as OperationalChange) >= 0) ? (v as OperationalChange) : "STABLE";
}

export function clampConfidence(x: any): number {
  var n = Number(x);
  if (!isFinite(n)) { return 0; }
  if (n < 0) { return 0; }
  if (n > 1) { return 1; }
  return n;
}

// ---- the FINAL PRINCIPLE (success criterion 10): the platform must be able to
// conclude simultaneously "physically acceptable today" AND "not acceptable for
// final disposition". This predicate is that dual conclusion, expressed on the tuple. ----
export function isPhysicallyAcceptableButNotDispositionable(t: GoverningTuple): boolean {
  if (!t) { return false; }
  if (t.physical !== "ACCEPTABLE") { return false; }
  return (t.assurance === "UNKNOWN_STATE" || t.assurance === "LOST_DESIGN_BASIS" || t.operational === "CHANGED_UNREASSESSED");
}

// ---- damage governs when any axis confirms damage ----
export function damageGoverns(t: GoverningTuple): boolean {
  return !!t && t.physical === "CONFIRMED_DAMAGE";
}

// ---- a compact, human-readable label for the tuple (display/debug only;
// NOT a return to named classes - it is derived from the tuple every time) ----
export function describeTuple(t: GoverningTuple): string {
  if (!t) { return "UNKNOWN/UNKNOWN_STATE/STABLE"; }
  return t.physical + "/" + t.assurance + "/" + t.operational;
}
