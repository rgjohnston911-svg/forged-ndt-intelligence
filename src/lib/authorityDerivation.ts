// ============================================================================
// authorityDerivation.ts - PHASE 5 (with Phase 7 rule 3): authority is DERIVED,
// never keyword-selected. The chain is:
//
//        Component  ->  Asset  ->  Jurisdiction  ->  Authority
//
// 1. applyComponentPrecedence (Phase 7 rule 3): the COMPONENT under inspection
//    governs the asset class. A facility/equipment context (large process equipment,
//    FCC, air cooler, refinery unit) may NOT override an explicit piping/component
//    noun. Inlet piping that happens to belong to an equipment
//    circuit is inspected as piping (API 570), not as the parent vessel.
//    This is a GENERAL rule keyed on component vs facility nouns - no asset-specific
//    or equipment-specific keyword.
// 2. deriveAuthority (Phase 5): asset class -> governing code(s), by a fixed map.
//    A loose domain keyword can never select authority.
// 3. checkAuthorityConsistency (Tier-1 veto): if a cited code's asset family
//    disagrees with the asset class, raise a veto WITH a cited reason.
//
// Pure module. No imports, no network. Testable offline and consumed by the
// reconciliation layer (Phase 9).
// ============================================================================

// ---- 1. COMPONENT PRECEDENCE (Phase 7 rule 3) ----

// Equipment / facility classes that a smaller inspected component can belong to.
// When one of these is the winning class AND an explicit piping component noun is
// present, the piping component governs.
var FACILITY_OR_EQUIPMENT_CLASSES: { [k: string]: boolean } = {
  "pressure_vessel": true,
  "heat_exchanger": true,
  "refinery_process_facility": true
};

// Explicit PIPING component nouns. Deliberately excludes bare "pipe"/"line"
// (too broad: "pipeline", "loading line") and anything that would reclassify a
// genuine pipeline. pipeline is itself a component-level class and is never
// rewritten by this rule.
var PIPING_COMPONENT_RE = /\b(?:process piping|inlet piping|outlet piping|suction piping|discharge piping|piping|pipe header|process line|transfer line|recycle line|small[- ]bore|dead leg|injection point)\b/i;

export interface ComponentPrecedenceResult {
  assetClass: string;
  overridden: boolean;
  reason: string;
}

export function applyComponentPrecedence(assetClass: string, transcript: string): ComponentPrecedenceResult {
  var ac = String(assetClass || "").toLowerCase();
  var t = String(transcript || "");
  if (FACILITY_OR_EQUIPMENT_CLASSES[ac] && PIPING_COMPONENT_RE.test(t)) {
    var m = t.match(PIPING_COMPONENT_RE);
    var phrase = m ? m[0] : "piping";
    return {
      assetClass: "process_piping",
      overridden: true,
      reason: "Component precedence: an explicit piping component (\"" + phrase + "\") governs over the facility/equipment context (" + ac + "); the inspected item is piping."
    };
  }
  return { assetClass: ac, overridden: false, reason: "" };
}

// ---- 2. ASSET -> AUTHORITY derivation (Phase 5) ----

var ASSET_AUTHORITY: { [k: string]: string[] } = {
  "process_piping": ["API 570", "ASME B31.3"],
  "pipeline": ["ASME B31.8", "ASME B31.4", "API 1111"],
  "pressure_vessel": ["API 510", "ASME BPVC Section VIII"],
  "heat_exchanger": ["API 510", "ASME BPVC Section VIII"],
  "storage_tank": ["API 653", "API 650"],
  "fired_heater": ["API 530", "API 573"],
  "offshore_platform": ["API RP 2A"],
  "wind_turbine": ["IEC 61400", "DNVGL-ST-0376"],
  "bridge_steel": ["AASHTO MBE", "AWS D1.5"],
  "bridge_concrete": ["AASHTO MBE"],
  "rail_bridge": ["AREMA"],
  "structural_steel": ["AISC 360"]
};

export interface DerivedAuthority {
  assetClass: string;
  codes: string[];
  primary: string | null;
  derived: boolean;   // false => no mapping; authority must NOT be keyword-guessed
}

export function deriveAuthority(assetClass: string): DerivedAuthority {
  var ac = String(assetClass || "").toLowerCase();
  var codes = ASSET_AUTHORITY[ac] || [];
  return {
    assetClass: ac,
    codes: codes.slice(),
    primary: codes.length ? codes[0] : null,
    derived: codes.length > 0
  };
}

// ---- 3. Tier-1 internal-consistency veto ----
// Each known in-service code maps to the asset FAMILY it governs. If a hypothesis
// cites a code whose family disagrees with the asset class family, that is a hard
// contradiction (e.g. cites API 653 tank code on piping) -> veto with cited reason.

var CODE_FAMILY: { [k: string]: string } = {
  "API 570": "piping",
  "ASME B31.3": "piping",
  "ASME B31.8": "pipeline",
  "ASME B31.4": "pipeline",
  "API 1111": "pipeline",
  "API 510": "vessel",
  "ASME BPVC Section VIII": "vessel",
  "API 653": "tank",
  "API 650": "tank",
  "API 530": "fired_heater",
  "API 573": "fired_heater",
  "API RP 2A": "offshore",
  "IEC 61400": "wind",
  "AREMA": "rail",
  "AWS D1.5": "bridge",
  "AASHTO MBE": "bridge"
};

var ASSET_FAMILY: { [k: string]: string } = {
  "process_piping": "piping",
  "pipeline": "pipeline",
  "pressure_vessel": "vessel",
  "heat_exchanger": "vessel",
  "storage_tank": "tank",
  "fired_heater": "fired_heater",
  "offshore_platform": "offshore",
  "wind_turbine": "wind",
  "rail_bridge": "rail",
  "bridge_steel": "bridge",
  "bridge_concrete": "bridge"
};

export interface ConsistencyVeto {
  ok: boolean;            // true => consistent; false => veto
  vetoed: boolean;
  reason: string;
  conflictingCode: string | null;
}

export function checkAuthorityConsistency(assetClass: string, citedCodes: string[]): ConsistencyVeto {
  var ac = String(assetClass || "").toLowerCase();
  var fam = ASSET_FAMILY[ac];
  if (!fam) { return { ok: true, vetoed: false, reason: "asset family unknown; no consistency claim", conflictingCode: null }; }
  var codes = citedCodes || [];
  for (var i = 0; i < codes.length; i++) {
    var code = String(codes[i] || "").trim();
    var cfam = CODE_FAMILY[code];
    if (cfam && cfam !== fam) {
      return {
        ok: false, vetoed: true, conflictingCode: code,
        reason: "Tier-1 internal-consistency veto: cited code " + code + " governs " + cfam + " but the asset is " + ac + " (" + fam + "). The cited authority does not apply to this asset class."
      };
    }
  }
  return { ok: true, vetoed: false, reason: "cited codes consistent with asset class " + ac, conflictingCode: null };
}
