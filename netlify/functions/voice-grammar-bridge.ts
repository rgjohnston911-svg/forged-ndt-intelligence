// DEPLOY159 — voice-grammar-bridge.ts v1.2.1
// v1.2.1: ASSET RESOLVER HOTFIX — three surgical fixes addressing three
//         consecutive catastrophic misclassifications (SWS1/SWS2 -> pressure_vessel
//         when transcript said "piping B31.3"; Scenario 3 -> offshore_platform
//         via "jacket" matching inside "jacketing").
//
//         Fix 1: DESIGN CODE OVERRIDE — extractDesignCodes() scans transcript
//                for explicit code citations (B31.3, Section VIII, API 570,
//                API 650, AASHTO, API RP 2A, etc.) and resolveAssetFromDesignCode()
//                maps them to asset_type. This runs BEFORE keyword matching and
//                short-circuits it when an explicit code is present. Piping
//                beats pressure vessel when both codes present (SWS pattern).
//                Exposes extracted design_codes[] to downstream for Authority Lock.
//
//         Fix 2: ASSET_KEYWORDS REORDERED LONGEST-FIRST — the extractField()
//                loop breaks on first match within each category, so shortest
//                keywords were winning and blocking longer specific phrases.
//                Each category now lists most-specific phrases first.
//                Adds "overhead process line", "process piping", "process line",
//                "pipe support" to piping so Scenario 3 resolves correctly without
//                needing an explicit design code.
//
//         Fix 3: DANGEROUS SHORT KEYWORDS REMOVED —
//                  "ast" (tank)             collided with "ASTM" material specs
//                  "jacket" (offshore)      collided with "insulation jacketing"
//                Replaced with longer forms: "aboveground storage tank",
//                "jacket leg", "platform jacket".
//
//         Also adds asset_resolution_source field ("design_code_override" vs
//                "keyword_match") so downstream can trust asset_class more
//                when source = design_code_override.
//
// DEPLOY155 — v1.2: CRASH FIX on preGateRiskCheck (`lt` out of scope).
// DEPLOY124 — v1.1: Expanded keywords, clock positions, orientation, numerics.
// DEPLOY116 — v1.0: Initial grammar bridge.
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

// ============================================================================
// FIELD DEFINITIONS — what a complete inspection record needs
// ============================================================================

// v1.2.1: ASSET_KEYWORDS ordered LONGEST-FIRST within each category.
// Dangerous short substrings ("ast", "jacket") removed or replaced.
var ASSET_KEYWORDS: any = {
  "piping": [
    "overhead process line", "hydrocarbon process line", "refinery process line",
    "welded branch connection", "branch connection",
    "process piping", "process line", "hydrocarbon line", "refinery line",
    "pipe support", "pipe header", "tee fitting",
    "dead leg", "dead-leg", "piping", "header", "reducer",
    "long radius elbow", "elbow", "pipe", "line"
  ],
  "pressure_vessel": [
    "pressure vessel", "separator drum", "reactor vessel", "process reactor",
    "autoclave", "reactor", "exchanger", "separator",
    "vessel", "drum", "column", "tower"
  ],
  "pipeline": [
    "cross country pipeline", "transmission pipeline", "gas pipeline", "oil pipeline",
    "pig launcher", "right of way", "pipeline", "pigging", "burial"
  ],
  "tank": [
    "atmospheric storage tank", "aboveground storage tank", "aboveground storage",
    "storage tank", "aboveground tank", "tank bottom", "tank shell", "tank roof"
  ],
  "bridge": [
    "highway bridge", "road bridge", "abutment",
    "girder", "truss", "bridge", "deck", "span", "pier"
  ],
  "rail_bridge": [
    "railroad bridge", "railway bridge", "rail bridge", "coal train",
    "railroad", "railway", "train", "rail"
  ],
  "offshore_platform": [
    "offshore platform", "platform jacket", "jacket leg", "subsea riser",
    "splash zone", "offshore", "platform", "caisson", "subsea", "riser"
  ],
  "boiler": [
    "boiler drum", "steam drum", "superheater", "economizer", "deaerator", "boiler"
  ],
  "heat_exchanger": [
    "heat exchanger", "tube bundle", "shell side", "tube side", "floating head",
    "u-tube"
  ]
};

var MATERIAL_KEYWORDS: any = {
  "carbon_steel": ["carbon steel", "cs", "a106", "a105", "a516", "sa106", "sa516"],
  "alloy_steel": ["alloy steel", "chrome moly", "cr-mo", "1.25 chrome", "2.25 chrome", "5 chrome", "9 chrome", "p11", "p22", "p91"],
  "stainless_steel": ["stainless", "stainless steel", "ss", "304", "316", "321", "347", "austenitic"],
  "duplex": ["duplex", "2205", "2507", "super duplex"],
  "nickel_alloy": ["inconel", "incoloy", "hastelloy", "monel", "nickel alloy", "alloy 625", "alloy 825"],
  "aluminum": ["aluminum", "aluminium", "al alloy"],
  "titanium": ["titanium", "ti alloy"],
  "concrete": ["concrete", "reinforced concrete", "prestressed", "rebar"],
  "cfrp": ["cfrp", "carbon fiber", "composite"],
  "cast_iron": ["cast iron", "ductile iron", "grey iron", "gray iron"],
  "copper_alloy": ["copper", "brass", "bronze", "cupro-nickel", "cupronickel", "cu-ni"]
};

var NDE_METHOD_KEYWORDS: any = {
  "UT": ["ultrasonic", "ut ", "ut,", "ut.", "thickness gauge", "thickness reading", "a-scan", "b-scan"],
  "PAUT": ["phased array", "paut", "pa ut"],
  "TOFD": ["time of flight", "tofd"],
  "MT": ["magnetic particle", " mt ", " mt,", " mt.", "mag particle", "mag test", "yoke"],
  "PT": ["penetrant", "pt ", "pt,", "dye pen", "liquid penetrant"],
  "RT": ["radiography", "rt ", "rt,", "x-ray", "xray", "gamma"],
  "VT": ["visual", "vt ", "vt,", "visual inspection"],
  "ET": ["eddy current", " et ", " et,"],
  "AE": ["acoustic emission", "ae "],
  "HARDNESS": ["hardness", "brinell", "rockwell", "vickers", "portable hardness"],
  "ACFM": ["acfm", "alternating current field", "ac field measurement"],
  "MFL": ["mfl", "magnetic flux leakage", "flux leakage"],
  "IRIS": ["iris", "internal rotary"],
  "PMI": ["pmi", "positive material", "alloy verification", "xrf"]
};

var FINDING_TYPE_KEYWORDS: any = {
  "wall_loss": ["wall loss", "metal loss", "thinning", "thinned", "thinned out", "thickness loss", "section loss", "eaten up", "eating", "washed out"],
  "crack": ["crack", "cracking", "fissure", "fracture"],
  "pitting": ["pit", "pitting", "pitted"],
  "corrosion": ["corrosion", "corroded", "rust", "scale", "rust bleed", "oxidation"],
  "deformation": ["deformation", "dent", "buckle", "buckling", "wrinkle", "bulge", "sag", "bowing"],
  "leak": ["leak", "seep", "weep", "staining", "drip"],
  "weld_defect": ["lack of fusion", "lof", "incomplete penetration", "undercut", "overlap", "porosity", "slag"],
  "coating_damage": ["coating damage", "coating failure", "paint break", "coating's cooked", "coating loss", "disbond"],
  "lamination": ["lamination", "delamination"],
  "erosion": ["erosion", "erosion-corrosion", "impingement"],
  "cui": ["cui", "corrosion under insulation", "under insulation", "under lagging"],
  "fire_damage": ["fire damage", "fire exposure", "fire exposed", "heat damage", "burned", "discoloration"],
  "hydrogen_damage": ["hydrogen damage", "htha", "hydrogen attack", "high temperature hydrogen"],
  "creep": ["creep", "creep damage", "bulging", "swelling"],
  "fatigue": ["fatigue", "fatigue crack", "cyclic", "vibration fatigue"],
  "scc": ["stress corrosion", "scc", "intergranular", "transgranular", "branching crack"],
  "mic": [" mic ", " mic,", " mic.", "microbiological", "microbial", "under deposit", "microbiologically influenced"]
};

var SERVICE_FLUID_KEYWORDS: any = {
  "amine": ["amine", "mdea", " dea ", " mea ", "lean amine", "rich amine"],
  "hydrogen": ["hydrogen", " hydro ", " hydro,", " hydro.", "h2 "],
  "h2s": ["h2s", "sour", "hydrogen sulfide"],
  "crude": ["crude", "crude oil"],
  "steam": ["steam"],
  "water": ["water", "cooling water", "boiler feed water", "bfw"],
  "caustic": ["caustic", "naoh", "sodium hydroxide"],
  "acid": ["acid", "hcl", "sulfuric", "hydrofluoric", "hf"],
  "ammonia": ["ammonia", "nh3"],
  "natural_gas": ["natural gas", "methane"],
  "refined_product": ["refined product", "naphtha", "gasoline", "diesel", "kerosene", "jet fuel"]
};

var LOCATION_KEYWORDS: any = {
  "elbow": ["elbow", "bend", "return"],
  "weld": ["weld", "weld toe", "weld root", "girth weld", "circumferential weld", "seam weld", "fillet weld"],
  "nozzle": ["nozzle", "branch", "branch connection"],
  "flange": ["flange", "flange face"],
  "support": ["support", "saddle", "shoe", "hanger", "lug"],
  "intrados": ["intrados", "inside curve", "6 o'clock", "6 oclock"],
  "extrados": ["extrados", "outside curve", "12 o'clock", "12 oclock"],
  "dead_leg": ["dead leg", "dead-leg"],
  "tee": [" tee ", " tee,", " tee.", "pipe tee", "tee junction"],
  "reducer": ["reducer", "transition"],
  "bottom": ["bottom", "bottom flange", "floor", "tank bottom"],
  "connection": ["connection", "tie-in", "attachment"],
  "clock_12": ["12 o'clock", "12 oclock", "top dead center", "top of pipe", "crown"],
  "clock_3": ["3 o'clock", "3 oclock", "right side", "starboard"],
  "clock_6": ["6 o'clock", "6 oclock", "bottom dead center", "bottom of pipe", "invert"],
  "clock_9": ["9 o'clock", "9 oclock", "left side", "port"],
  "gusset": ["gusset", "gusset plate", "stiffener plate"],
  "web": ["web", "web plate", "web gap"],
  "chord": ["chord", "lower chord", "upper chord", "bottom chord", "top chord"],
  "diaphragm": ["diaphragm", "cross frame", "lateral brace"],
  "base_plate": ["base plate", "baseplate", "anchor bolt", "anchor"],
  "butt_weld": ["butt weld", "butt joint", "full penetration", "cjp", "complete joint"],
  "fillet_weld": ["fillet weld", "fillet", "pjp", "partial penetration"],
  "socket_weld": ["socket weld", "socket", "sw"],
  "haz": ["haz", "heat affected zone", "heat affected"],
  "shell_course": ["shell course", "shell plate", "course"],
  "head": ["head", "dished head", "elliptical head", "hemispherical head"]
};

var ORIENTATION_KEYWORDS: any = {
  "horizontal": ["horizontal", "horizontal run", "level", "flat run"],
  "vertical": ["vertical", "vertical run", "riser", "downcomer", "drop"],
  "inclined": ["inclined", "sloped", "angled", "45 degree"],
  "overhead": ["overhead", "above", "ceiling"],
  "underground": ["underground", "buried", "below grade"]
};

var WELD_CONFIG_KEYWORDS: any = {
  "circumferential": ["circumferential", "circ weld", "girth weld", "circ"],
  "longitudinal": ["longitudinal", "long seam", "long weld", "axial weld"],
  "branch": ["branch weld", "branch connection", "set-on", "set-in"],
  "attachment": ["attachment weld", "lug weld", "clip weld", "pad weld"],
  "repair": ["repair weld", "weld repair", "ground out", "gouged out"]
};

// ============================================================================
// v1.2.1 HELPERS — word-boundary matching + design code extraction/resolution
// ============================================================================

function isWordCharGB(ch: string): boolean {
  if (!ch) return false;
  var c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return true;   // 0-9
  if (c >= 65 && c <= 90) return true;   // A-Z
  if (c >= 97 && c <= 122) return true;  // a-z
  if (c === 95) return true;             // _
  return false;
}

function hasWordBoundaryMatchGB(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  var searchFrom = 0;
  var idx = text.indexOf(keyword, searchFrom);
  while (idx >= 0) {
    var before = idx === 0 ? "" : text.charAt(idx - 1);
    var afterIdx = idx + keyword.length;
    var after = afterIdx >= text.length ? "" : text.charAt(afterIdx);
    var beforeOK = (before === "") || !isWordCharGB(before);
    var afterOK = (after === "") || !isWordCharGB(after);
    if (beforeOK && afterOK) return true;
    searchFrom = idx + 1;
    idx = text.indexOf(keyword, searchFrom);
  }
  return false;
}

// v1.2.1: Extract explicit design code citations from transcript.
// Returns an array of normalized code identifiers.
function extractDesignCodes(lt: string): string[] {
  var codes: string[] = [];

  // ASME B31.x piping/pipeline codes
  if (lt.indexOf("b31.3") !== -1 || lt.indexOf("b31 3") !== -1 ||
      lt.indexOf("process piping code") !== -1) codes.push("ASME_B31.3");
  if (lt.indexOf("b31.1") !== -1 || lt.indexOf("b31 1") !== -1 ||
      lt.indexOf("power piping") !== -1) codes.push("ASME_B31.1");
  if (lt.indexOf("b31.4") !== -1 || lt.indexOf("b31 4") !== -1 ||
      lt.indexOf("liquid pipeline code") !== -1) codes.push("ASME_B31.4");
  if (lt.indexOf("b31.8") !== -1 || lt.indexOf("b31 8") !== -1 ||
      lt.indexOf("gas pipeline code") !== -1) codes.push("ASME_B31.8");

  // ASME Section VIII (pressure vessels)
  if (lt.indexOf("section viii") !== -1 || lt.indexOf("section 8") !== -1 ||
      lt.indexOf("asme viii") !== -1 || lt.indexOf("asme 8") !== -1) {
    codes.push("ASME_Section_VIII");
  }

  // API inspection codes
  if (hasWordBoundaryMatchGB(lt, "api 570") || hasWordBoundaryMatchGB(lt, "api570")) codes.push("API_570");
  if (hasWordBoundaryMatchGB(lt, "api 574") || hasWordBoundaryMatchGB(lt, "api574")) codes.push("API_574");
  if (hasWordBoundaryMatchGB(lt, "api 510") || hasWordBoundaryMatchGB(lt, "api510")) codes.push("API_510");
  if (hasWordBoundaryMatchGB(lt, "api 653") || hasWordBoundaryMatchGB(lt, "api653")) codes.push("API_653");
  if (hasWordBoundaryMatchGB(lt, "api 650") || hasWordBoundaryMatchGB(lt, "api650")) codes.push("API_650");
  if (hasWordBoundaryMatchGB(lt, "api 579") || hasWordBoundaryMatchGB(lt, "api579")) codes.push("API_579-1");

  // Bridge codes
  if (lt.indexOf("aashto") !== -1) codes.push("AASHTO");

  // Offshore codes
  if (lt.indexOf("api rp 2a") !== -1 || lt.indexOf("api rp2a") !== -1 ||
      lt.indexOf("api-rp-2a") !== -1) codes.push("API_RP_2A");
  if (lt.indexOf("api rp 2sim") !== -1 || lt.indexOf("api rp2sim") !== -1) codes.push("API_RP_2SIM");

  // NACE sour service
  if (lt.indexOf("mr0175") !== -1 || lt.indexOf("mr 0175") !== -1) codes.push("NACE_MR0175");
  if (lt.indexOf("mr0103") !== -1 || lt.indexOf("mr 0103") !== -1) codes.push("NACE_MR0103");

  return codes;
}

// v1.2.1: Resolve asset_type from extracted design codes.
// Precedence: piping beats pressure_vessel when both present (SWS pattern —
// scenarios commonly cite Section VIII for the connected vessel AND B31.3 for
// the line being inspected; the line is the target asset).
function resolveAssetFromDesignCode(codes: string[]): string | null {
  var has = function(c: string): boolean {
    for (var i = 0; i < codes.length; i++) if (codes[i] === c) return true;
    return false;
  };

  var hasB31Piping = has("ASME_B31.3") || has("ASME_B31.1");
  var hasB31Pipeline = has("ASME_B31.4") || has("ASME_B31.8");
  var hasAPIPiping = has("API_570") || has("API_574");
  var hasTank = has("API_650") || has("API_653");
  var hasOffshore = has("API_RP_2A") || has("API_RP_2SIM");
  var hasBridge = has("AASHTO");
  var hasVessel = has("ASME_Section_VIII") || has("API_510");

  // Unambiguous categories first
  if (hasOffshore) return "offshore_platform";
  if (hasBridge) return "bridge";
  if (hasTank) return "tank";

  // Piping beats vessel when both present — the asset under inspection
  // is almost always the line, not the connected vessel, when both codes
  // appear in the same transcript.
  if (hasB31Piping || hasAPIPiping) return "piping";
  if (hasB31Pipeline) return "pipeline";

  // Vessel only if no piping code present
  if (hasVessel) return "pressure_vessel";

  return null;
}

// ============================================================================
// NUMERIC EXTRACTION — pulls measurements from natural speech (unchanged)
// ============================================================================

function extractNumericValues(transcript: string): any {
  var result: any = {
    diameter_inches: null,
    wall_thickness: null,
    temperature_f: null,
    temperature_c: null,
    pressure_psi: null,
    pressure_bar: null,
    wall_loss_percent: null,
    service_years: null,
    years_since_inspection: null,
    length: null,
    depth: null
  };

  var t = transcript;

  var diaMatch = /(\d+)[\s-]*(?:inch|in\b|")\s*(?:diameter|dia|pipe|line|carbon|alloy|stainless)/i.exec(t);
  if (!diaMatch) diaMatch = /(\d+)[\s-]*(?:inch|in\b|")\s/i.exec(t);
  if (diaMatch) result.diameter_inches = parseFloat(diaMatch[1]);

  var wlMatch = /(\d+)[\s]*(?:percent|%)\s*(?:wall\s*loss|metal\s*loss|thinning|down|loss|gone|reduced)/i.exec(t);
  if (wlMatch) result.wall_loss_percent = parseFloat(wlMatch[1]);
  if (!wlMatch) {
    var rangeMatch = /(\d+)[\s]*[-\u2013\u2014][\s]*(\d+)[\s]*(?:percent|%)\s*(?:down|loss|gone|reduced)/i.exec(t);
    if (rangeMatch) result.wall_loss_percent = parseFloat(rangeMatch[2]);
  }

  var tempFMatch = /(\d+)\s*(?:degrees?\s*f|fahrenheit|°f)/i.exec(t);
  if (tempFMatch) result.temperature_f = parseFloat(tempFMatch[1]);
  var tempCMatch = /(\d+)\s*(?:degrees?\s*c|celsius|°c)/i.exec(t);
  if (tempCMatch) result.temperature_c = parseFloat(tempCMatch[1]);
  if (!tempFMatch && !tempCMatch) {
    var tempPlain = /(?:operating\s*)?(?:temperature|temp)\s*(?:is\s*)?(\d+)\s*(?:degrees?)/i.exec(t);
    if (tempPlain) result.temperature_f = parseFloat(tempPlain[1]);
  }

  var psiMatch = /(\d+)\s*(?:psi|psig)/i.exec(t);
  if (psiMatch) result.pressure_psi = parseFloat(psiMatch[1]);
  var barMatch = /(\d+)\s*(?:bar\b|barg)/i.exec(t);
  if (barMatch) result.pressure_bar = parseFloat(barMatch[1]);

  var yearsMatch = /(\d+)\s*(?:years?\s*(?:in\s*service|old|of\s*service|service))/i.exec(t);
  if (yearsMatch) result.service_years = parseFloat(yearsMatch[1]);

  var inspMatch = /(?:last\s*inspected|previous\s*inspection|last\s*inspection)\s*(\d+)\s*years?\s*ago/i.exec(t);
  if (inspMatch) result.years_since_inspection = parseFloat(inspMatch[1]);

  var lenMatch = /(\d+(?:\.\d+)?)\s*(?:millimeters?|mm)\s*(?:long|length|crack|indication)/i.exec(t);
  if (lenMatch) result.length = { value: parseFloat(lenMatch[1]), unit: "mm" };
  if (!lenMatch) {
    var lenInMatch = /(\d+(?:\.\d+)?)\s*(?:inches?|in\b)\s*(?:long|length|crack|indication)/i.exec(t);
    if (lenInMatch) result.length = { value: parseFloat(lenInMatch[1]), unit: "inches" };
  }

  var depthMatch = /(\d+(?:\.\d+)?)\s*(?:millimeters?|mm)\s*(?:deep|depth)/i.exec(t);
  if (depthMatch) result.depth = { value: parseFloat(depthMatch[1]), unit: "mm" };

  var nomActMatch = /(\d+\.?\d*)\s*(?:inch|in\.?|mm)\s*(?:versus|vs\.?|compared\s*to|against)\s*(\d+\.?\d*)\s*(?:inch|in\.?|mm)?\s*(?:nominal|original|design)?/i.exec(t);
  if (nomActMatch) {
    result.actual_thickness = parseFloat(nomActMatch[1]);
    result.nominal_thickness = parseFloat(nomActMatch[2]);
    if (result.nominal_thickness > 0) {
      result.wall_loss_percent = Math.round((1 - result.actual_thickness / result.nominal_thickness) * 100);
    }
  }
  if (!nomActMatch) {
    var nomActMatch2 = /(?:nominal|original|design)\s*(?:of\s*)?(\d+\.?\d*)\s*(?:inch|in\.?|mm)[^.]*(?:shows?|reads?|measured|found|actual)\s*(\d+\.?\d*)/i.exec(t);
    if (nomActMatch2) {
      result.nominal_thickness = parseFloat(nomActMatch2[1]);
      result.actual_thickness = parseFloat(nomActMatch2[2]);
      if (result.nominal_thickness > 0) {
        result.wall_loss_percent = Math.round((1 - result.actual_thickness / result.nominal_thickness) * 100);
      }
    }
  }

  if (!result.wall_loss_percent) {
    var rangeMatch2 = /(\d+)\s*(?:to|-)\s*(\d+)\s*(?:percent|%)\s*(?:wall\s*loss|loss|down|gone|thinning)/i.exec(t);
    if (rangeMatch2) result.wall_loss_percent = parseFloat(rangeMatch2[2]);
  }

  var approxPsi = /(?:about|roughly|approximately|around|~)\s*(\d+)\s*(?:psi|psig)/i.exec(t);
  if (approxPsi && !result.pressure_psi) result.pressure_psi = parseFloat(approxPsi[1]);
  var approxTemp = /(?:about|roughly|approximately|around|~)\s*(\d+)\s*(?:degrees?\s*f|fahrenheit)/i.exec(t);
  if (approxTemp && !result.temperature_f) result.temperature_f = parseFloat(approxTemp[1]);

  var crackLenIn = /(\d+(?:\.\d+)?)\s*(?:inches?|in\.?)\s*(?:long|in\s*length)/i.exec(t);
  if (crackLenIn && !result.length) result.length = { value: parseFloat(crackLenIn[1]), unit: "inches" };
  var crackDepthMm = /(\d+(?:\.\d+)?)\s*(?:mm|millimeters?)\s*(?:deep|in\s*depth)/i.exec(t);
  if (crackDepthMm && !result.depth) result.depth = { value: parseFloat(crackDepthMm[1]), unit: "mm" };

  return result;
}

// ============================================================================
// KEYWORD FIELD EXTRACTOR (unchanged)
// ============================================================================

function hasWordNotNegatedGB(text: string, word: string): boolean {
  var idx = text.indexOf(word);
  if (idx === -1) return false;
  var searchFrom = 0;
  while (idx !== -1) {
    var preStart = Math.max(0, idx - 25);
    var preBuf = text.substring(preStart, idx);
    var negated = preBuf.indexOf("no ") !== -1 || preBuf.indexOf("not ") !== -1 || preBuf.indexOf("without ") !== -1 || preBuf.indexOf("negative") !== -1 || preBuf.indexOf("ruled out") !== -1 || preBuf.indexOf("no visible") !== -1 || preBuf.indexOf("absent") !== -1 || preBuf.indexOf("didn") !== -1;
    if (!negated) return true;
    searchFrom = idx + word.length;
    idx = text.indexOf(word, searchFrom);
  }
  return false;
}

function extractField(lt: string, keywordMap: any, useNegation?: boolean): any {
  var bestMatch: string | null = null;
  var bestLength = 0;
  var allMatches: string[] = [];

  for (var category in keywordMap) {
    if (!keywordMap.hasOwnProperty(category)) continue;
    var keywords = keywordMap[category];
    for (var ki = 0; ki < keywords.length; ki++) {
      var matched = useNegation ? hasWordNotNegatedGB(lt, keywords[ki]) : (lt.indexOf(keywords[ki]) !== -1);
      if (matched) {
        allMatches.push(category);
        if (keywords[ki].length > bestLength) {
          bestLength = keywords[ki].length;
          bestMatch = category;
        }
        break;
      }
    }
  }

  var unique: string[] = [];
  for (var ui = 0; ui < allMatches.length; ui++) {
    var found = false;
    for (var uj = 0; uj < unique.length; uj++) { if (unique[uj] === allMatches[ui]) { found = true; break; } }
    if (!found) unique.push(allMatches[ui]);
  }

  return { primary: bestMatch, all: unique };
}

// ============================================================================
// REQUIRED FIELDS BY ASSET TYPE (unchanged)
// ============================================================================

function getRequiredFields(assetType: string): string[] {
  var base = ["asset_type", "material", "finding_type", "location"];

  if (assetType === "piping" || assetType === "pipeline") {
    return base.concat(["diameter", "temperature_or_pressure", "service_fluid"]);
  }
  if (assetType === "pressure_vessel") {
    return base.concat(["temperature_or_pressure", "service_fluid"]);
  }
  if (assetType === "bridge" || assetType === "rail_bridge") {
    return base.concat(["member_type", "loading_type"]);
  }
  if (assetType === "offshore_platform") {
    return base.concat(["member_type", "environment"]);
  }
  if (assetType === "tank") {
    return base.concat(["service_fluid", "tank_zone"]);
  }
  return base;
}

// ============================================================================
// READBACK GENERATOR (unchanged)
// ============================================================================

function generateReadback(extracted: any): string {
  var parts: string[] = [];

  if (extracted.numeric.diameter_inches) parts.push(extracted.numeric.diameter_inches + " inch");
  if (extracted.material) parts.push(extracted.material.replace(/_/g, " "));
  if (extracted.asset_type) parts.push(extracted.asset_type.replace(/_/g, " "));
  if (extracted.service_fluid) parts.push("in " + extracted.service_fluid.replace(/_/g, " ") + " service");

  if (extracted.finding_types.length > 0) {
    var findingParts: string[] = [];
    for (var fi = 0; fi < extracted.finding_types.length; fi++) {
      findingParts.push(extracted.finding_types[fi].replace(/_/g, " "));
    }
    parts.push("with " + findingParts.join(" and "));
  }

  if (extracted.numeric.wall_loss_percent) parts.push(extracted.numeric.wall_loss_percent + "% wall loss");

  if (extracted.locations.length > 0) {
    var locParts: string[] = [];
    for (var li = 0; li < extracted.locations.length; li++) {
      locParts.push(extracted.locations[li].replace(/_/g, " "));
    }
    parts.push("at " + locParts.join(" / "));
  }

  if (extracted.orientation) parts.push(extracted.orientation + " run");
  if (extracted.weld_config) parts.push(extracted.weld_config.replace(/_/g, " ") + " weld");
  if (extracted.nde_methods.length > 0) {
    parts.push("inspected by " + extracted.nde_methods.join(", "));
  }

  if (extracted.numeric.temperature_f) parts.push(extracted.numeric.temperature_f + " deg F");
  if (extracted.numeric.temperature_c) parts.push(extracted.numeric.temperature_c + " deg C");
  if (extracted.numeric.pressure_psi) parts.push(extracted.numeric.pressure_psi + " psi");
  if (extracted.numeric.pressure_bar) parts.push(extracted.numeric.pressure_bar + " bar");
  if (extracted.numeric.service_years) parts.push(extracted.numeric.service_years + " years in service");

  return parts.join(", ") + ".";
}

// ============================================================================
// PROMPT GENERATOR (unchanged)
// ============================================================================

var FIELD_PROMPTS: any = {
  "asset_type": "What type of asset is this? (pipe, vessel, tank, bridge, etc.)",
  "material": "What is the material? (carbon steel, stainless, alloy steel, etc.)",
  "finding_type": "What type of finding or damage? (wall loss, crack, pitting, corrosion, etc.)",
  "location": "Where on the asset? (elbow, weld, nozzle, flange, support, etc.)",
  "diameter": "What is the diameter or size?",
  "temperature_or_pressure": "What are the operating temperature and/or pressure?",
  "service_fluid": "What fluid or service is this in? (amine, hydrogen, steam, crude, etc.)",
  "member_type": "What type of structural member? (girder, brace, flange, web, chord, etc.)",
  "loading_type": "What type of loading? (traffic, train, wind, wave, static, etc.)",
  "environment": "What is the environment? (subsea, splash zone, atmospheric, buried, etc.)",
  "tank_zone": "What zone of the tank? (shell, bottom, roof, nozzle, etc.)"
};

function generatePrompts(missing: string[]): any[] {
  var prompts: any[] = [];
  for (var mi = 0; mi < missing.length; mi++) {
    var field = missing[mi];
    prompts.push({
      field: field,
      prompt: FIELD_PROMPTS[field] || ("Please provide: " + field.replace(/_/g, " ")),
      priority: mi < 3 ? "required" : "recommended"
    });
  }
  return prompts;
}

// ============================================================================
// RISK PRE-GATE (v1.2 crash fix retained)
// ============================================================================

function preGateRiskCheck(extracted: any, lt: string): any[] {
  var flags: any[] = [];

  var hasCrack = false;
  for (var ci = 0; ci < extracted.finding_types.length; ci++) {
    if (extracted.finding_types[ci] === "crack") hasCrack = true;
  }
  if (hasCrack) {
    var hasCrackMethod = false;
    for (var mi = 0; mi < extracted.nde_methods.length; mi++) {
      var m = extracted.nde_methods[mi];
      if (m === "MT" || m === "PT" || m === "PAUT" || m === "TOFD" || m === "ET") hasCrackMethod = true;
    }
    if (!hasCrackMethod && extracted.nde_methods.length > 0) {
      flags.push({
        type: "method_gap",
        severity: "warning",
        message: "Crack reported but no crack-specific NDE method (MT, PT, PAUT, TOFD) confirmed. Consider supplemental examination."
      });
    }
  }

  if (extracted.numeric.wall_loss_percent && extracted.numeric.wall_loss_percent >= 30) {
    flags.push({
      type: "severity_alert",
      severity: "high",
      message: "Wall loss of " + extracted.numeric.wall_loss_percent + "% — exceeds typical screening threshold. Engineering review likely required."
    });
  }

  if (hasCrack && (extracted.service_fluid === "h2s" || extracted.service_fluid === "amine" || extracted.service_fluid === "hydrogen")) {
    flags.push({
      type: "mechanism_alert",
      severity: "critical",
      message: "Cracking in " + extracted.service_fluid + " service — environmental cracking (SCC/SSC/HIC) must be evaluated. Do not close as simple fatigue."
    });
  }

  if (extracted.finding_types.length > 0 && !extracted.numeric.years_since_inspection && !extracted.numeric.service_years) {
    flags.push({
      type: "data_gap",
      severity: "advisory",
      message: "No service history or prior inspection data — growth rate and interval adequacy cannot be assessed."
    });
  }

  var hasCUI = false;
  for (var cui = 0; cui < extracted.finding_types.length; cui++) {
    if (extracted.finding_types[cui] === "cui") hasCUI = true;
  }
  if (!hasCUI && extracted.numeric.temperature_f && extracted.numeric.temperature_f >= 25 && extracted.numeric.temperature_f <= 350) {
    var hasInsulation = lt.indexOf("insulation") !== -1 || lt.indexOf("lagging") !== -1 || lt.indexOf("jacketing") !== -1;
    if (hasInsulation) {
      flags.push({
        type: "mechanism_alert",
        severity: "warning",
        message: "Temperature in CUI range (25-350F) with insulation present. Corrosion under insulation should be evaluated."
      });
    }
  }

  if (extracted.numeric.diameter_inches && extracted.numeric.diameter_inches <= 2) {
    var hasVibration = lt.indexOf("vibrat") !== -1 || lt.indexOf("shaking") !== -1 || lt.indexOf("chattering") !== -1;
    if (hasVibration) {
      flags.push({
        type: "mechanism_alert",
        severity: "high",
        message: "Small bore (" + extracted.numeric.diameter_inches + " inch) with vibration — high fatigue risk at connections. Check socket welds and threadolets."
      });
    }
  }

  return flags;
}

// ============================================================================
// MAIN EXTRACTION ENGINE (v1.2.1 — adds design code override)
// ============================================================================

function extractFromTranscript(transcript: string): any {
  var lt = transcript.toLowerCase();

  // v1.2.1: Extract explicit design codes FIRST
  var designCodes = extractDesignCodes(lt);
  var designCodeAsset = resolveAssetFromDesignCode(designCodes);

  // Keyword-based extraction (still runs; used as fallback and to populate candidates)
  var assetResult = extractField(lt, ASSET_KEYWORDS);
  var materialResult = extractField(lt, MATERIAL_KEYWORDS);
  var methodResult = extractField(lt, NDE_METHOD_KEYWORDS);
  var findingResult = extractField(lt, FINDING_TYPE_KEYWORDS, true);
  var serviceResult = extractField(lt, SERVICE_FLUID_KEYWORDS);
  var locationResult = extractField(lt, LOCATION_KEYWORDS);
  var numeric = extractNumericValues(transcript);

  var orientResult = extractField(lt, ORIENTATION_KEYWORDS);
  var weldConfigResult = extractField(lt, WELD_CONFIG_KEYWORDS);

  // v1.2.1: Design code override beats keyword-based asset resolution.
  // If an explicit code was cited, trust it.
  var finalAssetType: string | null = assetResult.primary;
  var assetResolutionSource = "keyword_match";
  if (designCodeAsset) {
    finalAssetType = designCodeAsset;
    assetResolutionSource = "design_code_override";
  } else if (!finalAssetType) {
    assetResolutionSource = "none";
  }

  var extracted: any = {
    asset_type: finalAssetType,
    asset_candidates: assetResult.all,
    asset_resolution_source: assetResolutionSource,
    design_codes: designCodes,
    material: materialResult.primary,
    material_candidates: materialResult.all,
    nde_methods: methodResult.all,
    finding_types: findingResult.all,
    primary_finding: findingResult.primary,
    service_fluid: serviceResult.primary,
    service_candidates: serviceResult.all,
    locations: locationResult.all,
    primary_location: locationResult.primary,
    orientation: orientResult.primary,
    weld_config: weldConfigResult.primary,
    weld_configs: weldConfigResult.all,
    numeric: numeric
  };

  var required = getRequiredFields(extracted.asset_type || "unknown");
  var missing: string[] = [];

  for (var ri = 0; ri < required.length; ri++) {
    var field = required[ri];
    if (field === "asset_type" && !extracted.asset_type) missing.push(field);
    else if (field === "material" && !extracted.material) missing.push(field);
    else if (field === "finding_type" && extracted.finding_types.length === 0) missing.push(field);
    else if (field === "location" && extracted.locations.length === 0) missing.push(field);
    else if (field === "diameter" && !numeric.diameter_inches) missing.push(field);
    else if (field === "temperature_or_pressure" && !numeric.temperature_f && !numeric.temperature_c && !numeric.pressure_psi && !numeric.pressure_bar) missing.push(field);
    else if (field === "service_fluid" && !extracted.service_fluid) missing.push(field);
    else if (field === "member_type" && extracted.locations.length === 0) missing.push(field);
    else if (field === "loading_type") {
      var hasLoading = lt.indexOf("train") !== -1 || lt.indexOf("traffic") !== -1 || lt.indexOf("wind") !== -1 || lt.indexOf("wave") !== -1 || lt.indexOf("cyclic") !== -1 || lt.indexOf("pressure") !== -1;
      if (!hasLoading) missing.push(field);
    }
    else if (field === "environment") {
      var hasEnv = lt.indexOf("subsea") !== -1 || lt.indexOf("splash") !== -1 || lt.indexOf("atmospheric") !== -1 || lt.indexOf("buried") !== -1 || lt.indexOf("underwater") !== -1;
      if (!hasEnv) missing.push(field);
    }
    else if (field === "tank_zone") {
      var hasZone = lt.indexOf("shell") !== -1 || lt.indexOf("bottom") !== -1 || lt.indexOf("roof") !== -1 || lt.indexOf("nozzle") !== -1;
      if (!hasZone) missing.push(field);
    }
  }

  var totalFields = required.length;
  var extractedCount = totalFields - missing.length;
  var confidence = totalFields > 0 ? Math.round((extractedCount / totalFields) * 100) / 100 : 0;

  var readback = generateReadback(extracted);
  var riskFlags = preGateRiskCheck(extracted, lt);
  var prompts = generatePrompts(missing);

  return {
    extracted: extracted,
    missing_required: missing,
    prompts: prompts,
    readback: readback,
    risk_flags: riskFlags,
    confidence: confidence,
    field_count: { total_required: totalFields, extracted: extractedCount, missing: missing.length },
    completeness: missing.length === 0 ? "COMPLETE" : (missing.length <= 2 ? "NEAR_COMPLETE" : "INCOMPLETE")
  };
}

// ============================================================================
// AMENDMENT HANDLER (unchanged)
// ============================================================================

function applyAmendment(currentState: any, amendment: any): any {
  var trail: any[] = currentState.amendment_trail || [];

  trail.push({
    field: amendment.field,
    old_value: currentState.extracted[amendment.field] || null,
    new_value: amendment.value,
    source: amendment.source || "inspector_response",
    timestamp: new Date().toISOString()
  });

  var updated = JSON.parse(JSON.stringify(currentState));
  if (amendment.field === "asset_type") updated.extracted.asset_type = amendment.value;
  else if (amendment.field === "material") updated.extracted.material = amendment.value;
  else if (amendment.field === "service_fluid") updated.extracted.service_fluid = amendment.value;
  else if (amendment.field === "diameter") updated.extracted.numeric.diameter_inches = parseFloat(amendment.value);
  else if (amendment.field === "temperature_f") updated.extracted.numeric.temperature_f = parseFloat(amendment.value);
  else if (amendment.field === "pressure_psi") updated.extracted.numeric.pressure_psi = parseFloat(amendment.value);
  else if (amendment.field === "orientation") updated.extracted.orientation = amendment.value;
  else if (amendment.field === "weld_config") updated.extracted.weld_config = amendment.value;
  else if (amendment.field === "finding_type") {
    if (updated.extracted.finding_types.indexOf(amendment.value) === -1) {
      updated.extracted.finding_types.push(amendment.value);
    }
    if (!updated.extracted.primary_finding) updated.extracted.primary_finding = amendment.value;
  }
  else if (amendment.field === "nde_method") {
    if (updated.extracted.nde_methods.indexOf(amendment.value) === -1) {
      updated.extracted.nde_methods.push(amendment.value);
    }
  }
  else if (amendment.field === "location") {
    if (updated.extracted.locations.indexOf(amendment.value) === -1) {
      updated.extracted.locations.push(amendment.value);
    }
    if (!updated.extracted.primary_location) updated.extracted.primary_location = amendment.value;
  }

  var newMissing: string[] = [];
  for (var mi = 0; mi < updated.missing_required.length; mi++) {
    if (updated.missing_required[mi] !== amendment.field) {
      newMissing.push(updated.missing_required[mi]);
    }
  }
  updated.missing_required = newMissing;
  updated.amendment_trail = trail;

  updated.readback = generateReadback(updated.extracted);

  var totalFields = updated.field_count.total_required;
  updated.field_count.extracted = totalFields - newMissing.length;
  updated.field_count.missing = newMissing.length;
  updated.completeness = newMissing.length === 0 ? "COMPLETE" : (newMissing.length <= 2 ? "NEAR_COMPLETE" : "INCOMPLETE");

  return updated;
}

// ============================================================================
// NETLIFY HANDLER (v1.2.1 — version string bumped)
// ============================================================================

var handler = async function(event: any): Promise<any> {
  var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "extract";

    if (action === "extract") {
      var transcript = body.transcript || "";
      if (!transcript) {
        return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "transcript is required" }) };
      }

      var result = extractFromTranscript(transcript);
      return {
        statusCode: 200, headers: headers,
        body: JSON.stringify({
          ok: true,
          grammar_bridge_version: "1.2.1",
          action: "extract",
          result: result
        })
      };

    } else if (action === "amend") {
      var currentState = body.current_state || {};
      var amendment = body.amendment || {};

      if (!amendment.field || amendment.value === undefined) {
        return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "amendment.field and amendment.value are required" }) };
      }

      var amended = applyAmendment(currentState, amendment);
      return {
        statusCode: 200, headers: headers,
        body: JSON.stringify({
          ok: true,
          grammar_bridge_version: "1.2.1",
          action: "amend",
          result: amended
        })
      };

    } else if (action === "readback") {
      var extractedR = body.extracted || {};
      var readbackR = generateReadback(extractedR);
      return {
        statusCode: 200, headers: headers,
        body: JSON.stringify({
          ok: true,
          grammar_bridge_version: "1.2.1",
          action: "readback",
          readback: readbackR
        })
      };

    } else {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Unknown action: " + action + ". Use extract, amend, or readback." }) };
    }

  } catch (err: any) {
    return {
      statusCode: 500, headers: headers,
      body: JSON.stringify({ error: "voice-grammar-bridge error", message: err.message || "Unknown" })
    };
  }
};

export { handler };
