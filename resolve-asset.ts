/**
 * DEPLOY79 — resolve-asset.ts
 * FORGED NDT Intelligence OS
 * Universal Asset Alias Resolver v1
 *
 * PURPOSE: Resolve spoken language, slang, shorthand, and
 * ambiguous asset descriptions into a canonical asset class
 * with confidence scoring and disambiguation.
 *
 * "oil rig" -> offshore_platform
 * "causeway" -> bridge_structure
 * "line" + refinery -> process_piping
 * "line" + transmission -> pipeline
 * "vessel" + hull -> marine_vessel
 * "vessel" + nozzle -> pressure_vessel
 *
 * This runs UPSTREAM of governance-matrix and
 * code-authority-resolution. Those engines accept
 * asset_class as input and skip internal detection
 * when provided.
 *
 * DEPLOY NOTES:
 *   - String concatenation only (no backtick template literals)
 *   - All logic inlined (no lib/ imports)
 *   - Target: netlify/functions/resolve-asset.ts
 */

import { Handler } from "@netlify/functions";

/* =========================================================
   TYPES
   ========================================================= */

type CanonicalAssetClass =
  | "offshore_fixed_platform"
  | "offshore_floating_facility"
  | "offshore_renewable_facility"
  | "marine_vessel"
  | "bridge_civil_structure"
  | "pressure_vessel"
  | "storage_tank"
  | "process_piping"
  | "pipeline"
  | "structural_steel"
  | "heat_exchanger"
  | "boiler"
  | "heater"
  | "refinery_process_facility"
  | "chemical_process_facility"
  | "power_generation_equipment"
  | "relief_device"
  | "civil_structure"
  | "subsea_structure"
  | "rotating_equipment"
  | "unknown_asset";

interface MatchedAlias {
  alias: string;
  asset_class: CanonicalAssetClass;
  match_kind: string;
  weight: number;
}

interface AssetCandidate {
  asset_class: CanonicalAssetClass;
  score: number;
  matches: MatchedAlias[];
}

interface AssetResolutionOutput {
  engine: "Universal Asset Alias Resolver v1";
  canonical_asset_class: CanonicalAssetClass;
  confidence_score: number;
  confidence_band: string;
  resolution_status: string;
  detected_aliases: string[];
  alternative_candidates: { asset_class: CanonicalAssetClass; score: number }[];
  ambiguity_flags: string[];
  clarification_questions: string[];
  explanation: string;
}

/* =========================================================
   HELPERS
   ========================================================= */

function lower(text: string): string {
  return (text || "").toLowerCase().replace(/[_\/,\-]+/g, " ").replace(/\s+/g, " ").trim();
}

function textContains(text: string, phrase: string): boolean {
  return (" " + text + " ").indexOf(" " + phrase + " ") !== -1;
}

function addScore(store: Record<string, AssetCandidate>, assetClass: CanonicalAssetClass, alias: string, kind: string, weight: number): void {
  if (!store[assetClass]) {
    store[assetClass] = { asset_class: assetClass, score: 0, matches: [] };
  }
  store[assetClass].score += weight;
  store[assetClass].matches.push({ alias: alias, asset_class: assetClass, match_kind: kind, weight: weight });
}

/* =========================================================
   ALIAS LIBRARY — 300+ terms across 20 asset classes
   ========================================================= */

var ALIAS_MAP: { asset: CanonicalAssetClass; phrases: string[]; ambiguous: string[] }[] = [
  {
    asset: "offshore_fixed_platform",
    phrases: [
      "offshore platform", "offshore oil platform", "oil platform", "gas platform",
      "production platform", "fixed platform", "jacket platform", "jacket structure",
      "offshore structure", "offshore facility", "offshore installation",
      "oil rig", "drilling rig", "production rig", "offshore rig",
      "topside", "topsides", "splash zone", "splash zone brace",
      "node joint", "jacket leg", "boat landing", "helideck support",
      "cellar deck", "production deck", "drilling deck"
    ],
    ambiguous: ["platform", "rig", "structure", "installation"]
  },
  {
    asset: "offshore_floating_facility",
    phrases: [
      "floating facility", "fpso", "fso", "spar platform", "spar",
      "semi submersible", "semisubmersible", "semi sub", "drillship",
      "tension leg platform", "tlp", "jack up", "jackup", "jack-up",
      "modu", "floating production", "floater", "moored vessel"
    ],
    ambiguous: []
  },
  {
    asset: "offshore_renewable_facility",
    phrases: [
      "offshore wind", "wind farm", "offshore renewable", "wind turbine foundation",
      "monopile", "transition piece", "offshore solar", "tidal energy",
      "wave energy", "offshore wind platform"
    ],
    ambiguous: []
  },
  {
    asset: "marine_vessel",
    phrases: [
      "cargo ship", "tanker ship", "bulk carrier", "container ship",
      "supply vessel", "support vessel", "workboat", "tug", "tugboat",
      "barge", "ship hull", "hull plating", "rudder", "propeller",
      "marine vessel", "osv", "psv", "ahts"
    ],
    ambiguous: ["vessel", "ship", "boat", "hull"]
  },
  {
    asset: "bridge_civil_structure",
    phrases: [
      "bridge", "bridge support", "bridge pier", "bridge span",
      "overpass", "underpass", "viaduct", "causeway", "trestle",
      "bridge girder", "bridge deck", "bridge abutment", "bridge bent",
      "railroad bridge", "highway bridge", "pedestrian bridge",
      "elevated roadway", "bridge column"
    ],
    ambiguous: ["pier", "span", "crossing"]
  },
  {
    asset: "pressure_vessel",
    phrases: [
      "pressure vessel", "separator", "scrubber", "knockout drum",
      "flash drum", "surge drum", "reactor", "reactor vessel",
      "accumulator", "receiver", "fractionator", "debutanizer",
      "absorber", "stripper column", "distillation column",
      "pressure tank", "bullet tank", "autoclave"
    ],
    ambiguous: ["vessel", "drum", "column", "tower", "shell", "can"]
  },
  {
    asset: "storage_tank",
    phrases: [
      "storage tank", "atmospheric tank", "fixed roof tank",
      "floating roof tank", "cone roof tank", "dome roof tank",
      "crude tank", "product tank", "fuel tank", "diesel tank",
      "water tank", "tank shell", "tank floor", "tank roof",
      "tank bottom", "annular ring", "tank farm tank"
    ],
    ambiguous: ["tank"]
  },
  {
    asset: "process_piping",
    phrases: [
      "process piping", "process line", "piping circuit", "pipe circuit",
      "pipe spool", "spool piece", "header", "branch line",
      "pipe rack line", "rack piping", "small bore piping",
      "injection point", "sample point", "drain line"
    ],
    ambiguous: ["piping", "pipe", "line", "tube", "tubing"]
  },
  {
    asset: "pipeline",
    phrases: [
      "pipeline", "transmission line", "gas pipeline", "oil pipeline",
      "crude pipeline", "product pipeline", "flowline", "gathering line",
      "export line", "trunk line", "mainline", "subsea pipeline",
      "cross country line", "pipeline crossing", "right of way",
      "pig launcher", "pig receiver"
    ],
    ambiguous: []
  },
  {
    asset: "structural_steel",
    phrases: [
      "structural steel", "steel structure", "pipe rack", "pipe support",
      "steel frame", "steel beam", "steel column", "steel brace",
      "moment connection", "gusset plate", "base plate",
      "column splice", "fillet weld connection"
    ],
    ambiguous: ["beam", "brace", "member", "frame", "support", "connection"]
  },
  {
    asset: "heat_exchanger",
    phrases: [
      "heat exchanger", "shell and tube", "tube bundle",
      "cooler", "condenser", "reboiler", "air cooler", "fin fan",
      "plate exchanger", "u tube"
    ],
    ambiguous: ["exchanger", "bundle"]
  },
  {
    asset: "boiler",
    phrases: [
      "boiler", "steam boiler", "package boiler", "fire tube boiler",
      "water tube boiler", "steam drum", "mud drum", "steam generator",
      "hrsg", "waste heat boiler"
    ],
    ambiguous: []
  },
  {
    asset: "heater",
    phrases: [
      "fired heater", "process heater", "furnace", "reformer furnace",
      "heater tube", "radiant section", "convection section",
      "heater coil"
    ],
    ambiguous: ["heater"]
  },
  {
    asset: "refinery_process_facility",
    phrases: [
      "refinery", "refinery unit", "process unit", "crude unit",
      "cat cracker", "fcc", "coker", "hydrotreater",
      "reformer", "alkylation unit"
    ],
    ambiguous: ["unit", "facility", "plant"]
  },
  {
    asset: "chemical_process_facility",
    phrases: [
      "chemical plant", "chemical processing", "chemical facility",
      "petrochemical plant", "olefins plant", "ethylene plant",
      "polymerization unit"
    ],
    ambiguous: []
  },
  {
    asset: "power_generation_equipment",
    phrases: [
      "turbine", "gas turbine", "steam turbine", "power plant",
      "power generation", "generator", "power station"
    ],
    ambiguous: []
  },
  {
    asset: "relief_device",
    phrases: [
      "relief valve", "safety valve", "pressure relief valve",
      "prv", "psv", "relief device", "rupture disk"
    ],
    ambiguous: []
  },
  {
    asset: "civil_structure",
    phrases: [
      "dam", "dam face", "spillway", "intake structure",
      "outfall", "culvert", "headwall", "retaining wall",
      "concrete structure", "foundation", "caisson",
      "pile cap", "pedestal", "seawall", "bulkhead"
    ],
    ambiguous: []
  },
  {
    asset: "subsea_structure",
    phrases: [
      "subsea manifold", "subsea tree", "christmas tree",
      "wellhead", "riser base", "plem", "plet",
      "subsea template", "umbilical", "subsea connector"
    ],
    ambiguous: []
  },
  {
    asset: "rotating_equipment",
    phrases: [
      "pump", "compressor", "blower", "fan",
      "centrifugal pump", "reciprocating compressor",
      "motor", "gearbox", "coupling"
    ],
    ambiguous: []
  }
];

/* =========================================================
   CONTEXT CLUE MAPS — disambiguate ambiguous terms
   ========================================================= */

var CONTEXT_RULES: { term: string; context_phrases: string[]; resolves_to: CanonicalAssetClass; weight: number }[] = [
  /* "vessel" disambiguation */
  { term: "vessel", context_phrases: ["hull", "rudder", "propeller", "ship", "dock", "marine", "cargo", "tanker", "port", "harbor", "berth"], resolves_to: "marine_vessel", weight: 22 },
  { term: "vessel", context_phrases: ["separator", "reactor", "nozzle", "shell", "head", "skirt", "tray", "pressure", "insulation", "corrosion"], resolves_to: "pressure_vessel", weight: 22 },

  /* "platform" disambiguation */
  { term: "platform", context_phrases: ["offshore", "gulf", "ocean", "sea", "subsea", "topside", "jacket", "splash", "wave", "hurricane", "storm", "oil", "gas", "production"], resolves_to: "offshore_fixed_platform", weight: 24 },

  /* "rig" disambiguation */
  { term: "rig", context_phrases: ["offshore", "gulf", "oil", "gas", "drilling", "production", "platform", "ocean", "sea"], resolves_to: "offshore_fixed_platform", weight: 24 },

  /* "structure" disambiguation */
  { term: "structure", context_phrases: ["offshore", "topside", "jacket", "splash zone", "subsea", "platform"], resolves_to: "offshore_fixed_platform", weight: 20 },
  { term: "structure", context_phrases: ["bridge", "overpass", "causeway", "roadway", "highway", "span"], resolves_to: "bridge_civil_structure", weight: 20 },
  { term: "structure", context_phrases: ["dam", "spillway", "concrete", "foundation", "culvert", "civil"], resolves_to: "civil_structure", weight: 20 },

  /* "line" disambiguation */
  { term: "line", context_phrases: ["refinery", "process", "pipe rack", "unit", "plant", "facility", "header", "branch"], resolves_to: "process_piping", weight: 18 },
  { term: "line", context_phrases: ["transmission", "pipeline", "right of way", "cross country", "gathering", "export", "mainline", "pig"], resolves_to: "pipeline", weight: 18 },

  /* "tank" disambiguation */
  { term: "tank", context_phrases: ["roof", "floor", "bottom", "annular", "floating", "cone", "dome", "crude", "product", "fuel", "storage", "farm"], resolves_to: "storage_tank", weight: 20 },
  { term: "tank", context_phrases: ["pressure", "bullet", "separator", "accumulator"], resolves_to: "pressure_vessel", weight: 18 },

  /* "column" disambiguation */
  { term: "column", context_phrases: ["tray", "distillation", "fractionator", "absorber", "stripper", "pressure", "internals"], resolves_to: "pressure_vessel", weight: 18 },
  { term: "column", context_phrases: ["steel", "splice", "base plate", "structural", "support"], resolves_to: "structural_steel", weight: 16 },
  { term: "column", context_phrases: ["bridge", "pier", "roadway", "overpass"], resolves_to: "bridge_civil_structure", weight: 16 },

  /* "tower" disambiguation */
  { term: "tower", context_phrases: ["distillation", "process", "tray", "packing", "absorber", "stripper"], resolves_to: "pressure_vessel", weight: 18 },
  { term: "tower", context_phrases: ["wind", "turbine", "nacelle", "offshore wind"], resolves_to: "offshore_renewable_facility", weight: 20 },

  /* "drum" disambiguation */
  { term: "drum", context_phrases: ["flash", "surge", "knockout", "separator", "pressure", "vessel"], resolves_to: "pressure_vessel", weight: 18 },
  { term: "drum", context_phrases: ["steam", "boiler", "mud"], resolves_to: "boiler", weight: 16 },

  /* "shell" disambiguation */
  { term: "shell", context_phrases: ["vessel", "nozzle", "head", "pressure", "separator"], resolves_to: "pressure_vessel", weight: 16 },
  { term: "shell", context_phrases: ["tank", "roof", "floor", "bottom", "storage"], resolves_to: "storage_tank", weight: 16 },
  { term: "shell", context_phrases: ["hull", "ship", "marine"], resolves_to: "marine_vessel", weight: 16 },

  /* "pier" disambiguation */
  { term: "pier", context_phrases: ["bridge", "roadway", "highway", "overpass", "span"], resolves_to: "bridge_civil_structure", weight: 16 },
  { term: "pier", context_phrases: ["dock", "marine", "harbor", "port", "berth"], resolves_to: "marine_vessel", weight: 14 },

  /* "member" / "brace" disambiguation */
  { term: "member", context_phrases: ["offshore", "jacket", "topside", "platform", "splash zone", "node"], resolves_to: "offshore_fixed_platform", weight: 18 },
  { term: "member", context_phrases: ["steel", "structural", "frame", "rack"], resolves_to: "structural_steel", weight: 14 },
  { term: "brace", context_phrases: ["offshore", "jacket", "splash zone", "node", "platform", "subsea"], resolves_to: "offshore_fixed_platform", weight: 20 },
  { term: "brace", context_phrases: ["steel", "structural", "frame"], resolves_to: "structural_steel", weight: 14 },

  /* "installation" disambiguation */
  { term: "installation", context_phrases: ["offshore", "oil", "gas", "platform", "gulf"], resolves_to: "offshore_fixed_platform", weight: 18 },

  /* "facility" / "plant" / "unit" disambiguation */
  { term: "facility", context_phrases: ["refinery", "crude", "process", "chemical"], resolves_to: "refinery_process_facility", weight: 16 },
  { term: "plant", context_phrases: ["refinery", "crude", "hydrocarbon", "process"], resolves_to: "refinery_process_facility", weight: 16 },
  { term: "plant", context_phrases: ["chemical", "petrochemical", "olefins", "ethylene"], resolves_to: "chemical_process_facility", weight: 16 },
  { term: "plant", context_phrases: ["power", "generation", "turbine"], resolves_to: "power_generation_equipment", weight: 14 },
  { term: "unit", context_phrases: ["refinery", "process", "crude", "fcc", "coker"], resolves_to: "refinery_process_facility", weight: 14 },

  /* "heater" disambiguation */
  { term: "heater", context_phrases: ["fired", "furnace", "tube", "radiant", "convection", "coil", "process"], resolves_to: "heater", weight: 18 },
  { term: "heater", context_phrases: ["water", "electric", "domestic"], resolves_to: "unknown_asset", weight: 4 }
];

/* =========================================================
   SCORING ENGINE
   ========================================================= */

function scoreAliases(text: string, store: Record<string, AssetCandidate>): void {
  for (var a = 0; a < ALIAS_MAP.length; a++) {
    var entry = ALIAS_MAP[a];
    /* Score exact phrases (high weight) */
    for (var p = 0; p < entry.phrases.length; p++) {
      var phrase = entry.phrases[p];
      if (textContains(text, phrase)) {
        addScore(store, entry.asset, phrase, "exact_phrase", 30);
      }
    }
    /* Score ambiguous terms (low weight — need context) */
    for (var b = 0; b < entry.ambiguous.length; b++) {
      var amb = entry.ambiguous[b];
      if (textContains(text, amb)) {
        addScore(store, entry.asset, amb, "ambiguous_token", 5);
      }
    }
  }
}

function scoreContextRules(text: string, store: Record<string, AssetCandidate>): void {
  for (var r = 0; r < CONTEXT_RULES.length; r++) {
    var rule = CONTEXT_RULES[r];
    if (!textContains(text, rule.term)) continue;

    var contextHit = false;
    for (var c = 0; c < rule.context_phrases.length; c++) {
      if (textContains(text, rule.context_phrases[c])) {
        contextHit = true;
        break;
      }
    }
    if (contextHit) {
      addScore(store, rule.resolves_to, rule.term + " + context", "context_disambiguation", rule.weight);
    }
  }
}

/* =========================================================
   CONFIDENCE + RESOLUTION
   ========================================================= */

function bandFromScore(score: number, delta: number): string {
  if (score >= 85 && delta >= 20) return "locked";
  if (score >= 70 && delta >= 15) return "high";
  if (score >= 55 && delta >= 10) return "moderate";
  if (score >= 40 && delta >= 5) return "low";
  if (score >= 25) return "ambiguous";
  return "manual_review";
}

function buildClarificationQuestions(top: CanonicalAssetClass, second: CanonicalAssetClass | null): string[] {
  var questions: string[] = [];
  var pair = [top];
  if (second) pair.push(second);

  var hasBoth = function(a: CanonicalAssetClass, b: CanonicalAssetClass): boolean {
    return pair.indexOf(a) !== -1 && pair.indexOf(b) !== -1;
  };

  if (hasBoth("process_piping", "pipeline")) {
    questions.push("Is this a process line inside a facility, or a transmission / cross-country pipeline?");
  }
  if (hasBoth("pressure_vessel", "marine_vessel")) {
    questions.push("Is this a pressure-containing vessel (separator, drum, reactor), or a ship / boat / marine vessel?");
  }
  if (hasBoth("storage_tank", "pressure_vessel")) {
    questions.push("Is this an atmospheric storage tank, or a pressure-containing vessel?");
  }
  if (hasBoth("offshore_fixed_platform", "structural_steel")) {
    questions.push("Is this offshore platform steel, or a general onshore structural steel?");
  }
  if (hasBoth("bridge_civil_structure", "civil_structure")) {
    questions.push("Is the asset a bridge / overpass, or another civil structure such as a dam or spillway?");
  }

  if (questions.length === 0 && top === "unknown_asset") {
    questions.push("What is the asset type: platform, bridge, vessel, tank, piping, pipeline, structural steel, or other?");
  }

  return questions;
}

/* =========================================================
   MAIN RESOLVER
   ========================================================= */

function resolveAsset(rawText: string): AssetResolutionOutput {
  var text = lower(rawText);
  var store: Record<string, AssetCandidate> = {};

  /* Score all aliases and context rules */
  scoreAliases(text, store);
  scoreContextRules(text, store);

  /* Sort candidates by score */
  var candidates: AssetCandidate[] = [];
  var keys = Object.keys(store);
  for (var k = 0; k < keys.length; k++) {
    candidates.push(store[keys[k]]);
  }
  candidates.sort(function(a, b) { return b.score - a.score; });

  var top = candidates.length > 0 ? candidates[0] : null;
  var second = candidates.length > 1 ? candidates[1] : null;

  if (!top || top.score < 5) {
    return {
      engine: "Universal Asset Alias Resolver v1",
      canonical_asset_class: "unknown_asset",
      confidence_score: 10,
      confidence_band: "manual_review",
      resolution_status: "manual_review_required",
      detected_aliases: [],
      alternative_candidates: [],
      ambiguity_flags: ["No recognized asset clues found in input."],
      clarification_questions: ["What is the asset type: platform, bridge, vessel, tank, piping, pipeline, structural steel, or other?"],
      explanation: "The resolver did not find enough alias or context evidence to classify the asset."
    };
  }

  var topScore = top.score;
  var secondScore = second ? second.score : 0;
  var delta = topScore - secondScore;

  var confidence = topScore;
  if (confidence > 99) confidence = 99;
  if (confidence < 15) confidence = 15;

  var band = bandFromScore(confidence, delta);

  var status = "resolved";
  var ambiguityFlags: string[] = [];

  if (band === "ambiguous" || band === "manual_review") {
    status = band === "manual_review" ? "manual_review_required" : "ambiguous";
    ambiguityFlags.push("Top candidate is not sufficiently separated from alternatives.");
  }
  if (second && delta < 10) {
    ambiguityFlags.push("Close competing candidate: " + second.asset_class.replace(/_/g, " "));
  }

  var clarifications: string[] = [];
  if (status !== "resolved") {
    clarifications = buildClarificationQuestions(top.asset_class, second ? second.asset_class : null);
  }

  /* Collect detected alias names */
  var detectedAliases: string[] = [];
  var seen: Record<string, boolean> = {};
  for (var m = 0; m < top.matches.length; m++) {
    var aliasName = top.matches[m].alias;
    if (!seen[aliasName]) {
      seen[aliasName] = true;
      detectedAliases.push(aliasName);
    }
  }

  /* Build alternatives */
  var alts: { asset_class: CanonicalAssetClass; score: number }[] = [];
  for (var alt = 1; alt < candidates.length && alt <= 3; alt++) {
    alts.push({ asset_class: candidates[alt].asset_class, score: candidates[alt].score });
  }

  var explanation = status === "resolved"
    ? "Asset resolved to " + top.asset_class.replace(/_/g, " ") + " based on " + detectedAliases.length + " alias matches and context disambiguation."
    : "Asset classification is not fully locked. Best candidate is " + top.asset_class.replace(/_/g, " ") + " but clarification is recommended.";

  return {
    engine: "Universal Asset Alias Resolver v1",
    canonical_asset_class: top.asset_class,
    confidence_score: confidence,
    confidence_band: band,
    resolution_status: status,
    detected_aliases: detectedAliases,
    alternative_candidates: alts,
    ambiguity_flags: ambiguityFlags,
    clarification_questions: clarifications,
    explanation: explanation
  };
}

/* =========================================================
   NETLIFY FUNCTION HANDLER
   ========================================================= */

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var rawText = body.raw_text || body.transcript || body.asset_description || "";

    if (!rawText.trim()) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: "Universal Asset Alias Resolver v1",
          canonical_asset_class: "unknown_asset",
          confidence_score: 0,
          confidence_band: "manual_review",
          resolution_status: "manual_review_required",
          detected_aliases: [],
          alternative_candidates: [],
          ambiguity_flags: ["No input text provided."],
          clarification_questions: ["What is the asset type?"],
          explanation: "No input text was provided for asset resolution."
        })
      };
    }

    var result = resolveAsset(rawText);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (err) {
    var errMsg = (err && typeof err === "object" && "message" in err) ? (err as any).message : "Unknown error";
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Asset Alias Resolver failed", detail: errMsg })
    };
  }
};

export { handler };
