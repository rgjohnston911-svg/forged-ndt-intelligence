/**
 * DEPLOY80 — parse-incident.ts
 * FORGED NDT Intelligence OS
 * Speech-to-Structured Incident Parser v1
 *
 * PURPOSE: Hard-extract numeric facts from spoken input using
 * deterministic regex BEFORE any AI reasoning occurs.
 *
 * FIXES: "80 mph" never becomes "5 mph" again.
 *
 * FLOW:
 *   User speaks -> parse-incident (THIS FILE)
 *     -> hard regex extracts: 80 mph, 15 ft, 5 miles
 *     -> classifies each by context window
 *     -> detects events (hurricane, impact, corrosion...)
 *     -> detects contradictions
 *     -> builds confirmation prompts if needed
 *     -> returns structured incident with LOCKED values
 *   Then: resolve-asset -> voice-incident-plan -> enrichment -> etc.
 *
 * DEPLOY NOTES:
 *   - String concatenation only (no backtick template literals)
 *   - All logic inlined (no lib/ imports)
 *   - Target: netlify/functions/parse-incident.ts
 *   - Deterministic — no AI calls
 */

import { Handler } from "@netlify/functions";

/* =========================================================
   TYPES
   ========================================================= */

interface NumericFact {
  id: string;
  fact_type: string;
  raw_snippet: string;
  raw_value_text: string;
  value: number;
  unit: string;
  normalized_unit: string;
  confidence: number;
  negated: boolean;
}

interface DetectedEvent {
  event_type: string;
  matched_text: string;
  confidence: number;
}

interface EnvironmentFactor {
  key: string;
  value: string;
  evidence: string;
}

interface Contradiction {
  severity: string;
  message: string;
  facts_involved: string[];
}

interface ParsedIncidentOutput {
  engine: "Speech-to-Structured Incident Parser v1";
  raw_transcript: string;
  normalized_transcript: string;
  numeric_facts: NumericFact[];
  primary_values: {
    wind_speed_mph: number | null;
    wave_height_ft: number | null;
    surge_height_ft: number | null;
    distance_miles: number | null;
    impact_speed_mph: number | null;
    diameter_ft: number | null;
    diameter_in: number | null;
    water_depth_ft: number | null;
    pressure_psi: number | null;
    temperature_f: number | null;
    duration_hours: number | null;
  };
  detected_events: DetectedEvent[];
  environment_factors: EnvironmentFactor[];
  contradictions: Contradiction[];
  confirmation_required: boolean;
  confirmation_prompts: string[];
  confidence_score: number;
  confidence_band: string;
}

/* =========================================================
   HELPERS
   ========================================================= */

function lower(text: string): string {
  return (text || "").toLowerCase().replace(/[_\/]+/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function uid(): string {
  return "f_" + Math.random().toString(36).substring(2, 10);
}

function textContains(text: string, phrase: string): boolean {
  return (" " + text + " ").indexOf(" " + phrase + " ") !== -1;
}

function roundTo(n: number, digits: number): number {
  var p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

/* =========================================================
   UNIT NORMALIZATION
   ========================================================= */

var UNIT_MAP: Record<string, string> = {
  "mph": "mph", "miles per hour": "mph", "mile per hour": "mph",
  "kt": "knots", "kts": "knots", "knot": "knots", "knots": "knots",
  "ft": "ft", "foot": "ft", "feet": "ft", "'": "ft",
  "in": "in", "inch": "in", "inches": "in", "\"": "in",
  "mi": "miles", "mile": "miles", "miles": "miles",
  "psi": "psi", "psig": "psi",
  "f": "f", "deg f": "f",
  "hours": "hours", "hour": "hours", "hr": "hours", "hrs": "hours",
  "days": "days", "day": "days"
};

function normalizeUnit(raw: string): string {
  var u = lower(raw);
  return UNIT_MAP[u] || u;
}

/* =========================================================
   NUMERIC EXTRACTION — Hard Regex
   ---------------------------------------------------------
   Regex extracts every number+unit pair from the text.
   Context window (24 chars before/after) determines what
   the number means. This runs BEFORE any AI.
   ========================================================= */

function classifyFact(context: string, unit: string): string {
  var c = lower(context);
  var u = normalizeUnit(unit);

  /* Wind speed */
  if (c.indexOf("wind") !== -1 && (u === "mph" || u === "knots")) return "wind_speed";
  if (c.indexOf("gust") !== -1 && (u === "mph" || u === "knots")) return "wind_speed";
  if (c.indexOf("sustained") !== -1 && (u === "mph" || u === "knots")) return "wind_speed";

  /* Surge — check BEFORE wave so "wave surge" resolves to surge */
  if (c.indexOf("surge") !== -1 && u === "ft") return "surge_height";

  /* Wave height — only when surge did NOT match */
  if (c.indexOf("wave") !== -1 && c.indexOf("surge") === -1 && u === "ft") return "wave_height";

  /* Distance */
  if ((c.indexOf("within") !== -1 || c.indexOf("mile") !== -1 || c.indexOf("away") !== -1 || c.indexOf("from") !== -1 || c.indexOf("distance") !== -1) && (u === "miles" || u === "mi")) return "distance";

  /* Diameter */
  if ((c.indexOf("diameter") !== -1 || c.indexOf("wide") !== -1 || c.indexOf("inch") !== -1) && (u === "ft" || u === "in")) return "diameter";

  /* Depth */
  if ((c.indexOf("depth") !== -1 || c.indexOf("deep") !== -1 || c.indexOf("water depth") !== -1) && u === "ft") return "depth";

  /* Pressure */
  if (u === "psi") return "pressure";

  /* Temperature */
  if (u === "f" && (c.indexOf("temp") !== -1 || c.indexOf("degree") !== -1 || c.indexOf("heat") !== -1)) return "temperature";

  /* Duration */
  if (u === "hours" || u === "days") return "duration";

  /* Speed (impact, traveling) */
  if ((c.indexOf("travel") !== -1 || c.indexOf("speed") !== -1 || c.indexOf("moving") !== -1 || c.indexOf("going") !== -1 || c.indexOf("approximately") !== -1) && (u === "mph" || u === "knots")) return "impact_speed";

  /* Fallback: mph without wind context = likely speed */
  if (u === "mph" || u === "knots") {
    /* Check if any wind-related word nearby */
    if (c.indexOf("wind") === -1 && c.indexOf("gust") === -1 && c.indexOf("sustained") === -1) {
      return "impact_speed";
    }
    return "wind_speed";
  }

  /* Fallback: ft without wave/surge/depth/diameter context */
  if (u === "ft") {
    if (c.indexOf("surge") !== -1) return "surge_height";
    if (c.indexOf("wave") !== -1 && c.indexOf("surge") === -1) return "wave_height";
    return "size_dimension";
  }

  return "unknown_numeric";
}

function extractNumericFacts(text: string): NumericFact[] {
  var facts: NumericFact[] = [];
  var normalized = lower(text);

  /* Main regex: number followed by unit */
  var pattern = /(\d+(?:\.\d+)?)\s*(mph|miles per hour|mile per hour|kt|kts|knot|knots|ft|foot|feet|in|inch|inches|mi|mile|miles|psi|psig|deg f|hours|hour|hr|hrs|days|day)/gi;

  var match;
  while ((match = pattern.exec(normalized)) !== null) {
    var rawValue = match[1];
    var rawUnit = match[2];
    var start = match.index;
    var end = pattern.lastIndex;

    /* Context window: 30 chars before and after */
    var windowStart = start - 30;
    if (windowStart < 0) windowStart = 0;
    var windowEnd = end + 30;
    if (windowEnd > normalized.length) windowEnd = normalized.length;
    var snippet = normalized.substring(windowStart, windowEnd);

    var numVal = parseFloat(rawValue);
    var normUnit = normalizeUnit(rawUnit);
    var factType = classifyFact(snippet, rawUnit);

    /* Check for negation */
    var negated = false;
    if (snippet.indexOf("no ") !== -1 || snippet.indexOf("not ") !== -1 || snippet.indexOf("without ") !== -1) {
      negated = true;
    }

    facts.push({
      id: uid(),
      fact_type: factType,
      raw_snippet: snippet,
      raw_value_text: rawValue + " " + rawUnit,
      value: numVal,
      unit: rawUnit,
      normalized_unit: normUnit,
      confidence: factType === "unknown_numeric" ? 50 : 90,
      negated: negated
    });
  }

  /* Also try to catch "X foot" and "X'" patterns */
  var footPattern = /(\d+)\s*(?:'|foot)\s/gi;
  while ((match = footPattern.exec(normalized)) !== null) {
    /* Check if already captured */
    var alreadyCaptured = false;
    for (var i = 0; i < facts.length; i++) {
      if (Math.abs(facts[i].value - parseFloat(match[1])) < 0.01 && facts[i].normalized_unit === "ft") {
        alreadyCaptured = true;
        break;
      }
    }
    if (!alreadyCaptured) {
      var ws = match.index - 30;
      if (ws < 0) ws = 0;
      var we = footPattern.lastIndex + 30;
      if (we > normalized.length) we = normalized.length;
      var snip = normalized.substring(ws, we);
      facts.push({
        id: uid(),
        fact_type: classifyFact(snip, "ft"),
        raw_snippet: snip,
        raw_value_text: match[1] + " ft",
        value: parseFloat(match[1]),
        unit: "ft",
        normalized_unit: "ft",
        confidence: 80,
        negated: false
      });
    }
  }

  return facts;
}

/* =========================================================
   PRIMARY VALUE PICKER
   ---------------------------------------------------------
   For each fact type, pick the best candidate.
   If multiple values exist for the same type, flag conflict.
   ========================================================= */

function pickBest(facts: NumericFact[], factType: string): NumericFact | null {
  var candidates: NumericFact[] = [];
  for (var i = 0; i < facts.length; i++) {
    if (facts[i].fact_type === factType && !facts[i].negated) {
      candidates.push(facts[i]);
    }
  }
  if (candidates.length === 0) return null;

  /* Sort by confidence descending */
  candidates.sort(function(a, b) { return b.confidence - a.confidence; });
  return candidates[0];
}

function convertToMiles(value: number, unit: string): number {
  if (unit === "ft") return value / 5280;
  return value;
}

function convertToHours(value: number, unit: string): number {
  if (unit === "days") return value * 24;
  return value;
}

function buildPrimaryValues(facts: NumericFact[]): ParsedIncidentOutput["primary_values"] {
  var wind = pickBest(facts, "wind_speed");
  var wave = pickBest(facts, "wave_height");
  var surge = pickBest(facts, "surge_height");
  var dist = pickBest(facts, "distance");
  var speed = pickBest(facts, "impact_speed");
  var diaFt = null as NumericFact | null;
  var diaIn = null as NumericFact | null;
  var depth = pickBest(facts, "depth");
  var pressure = pickBest(facts, "pressure");
  var temp = pickBest(facts, "temperature");
  var duration = pickBest(facts, "duration");

  /* Split diameter by unit */
  var allDia: NumericFact[] = [];
  for (var i = 0; i < facts.length; i++) {
    if (facts[i].fact_type === "diameter" && !facts[i].negated) {
      allDia.push(facts[i]);
    }
  }
  for (var d = 0; d < allDia.length; d++) {
    if (allDia[d].normalized_unit === "ft" && !diaFt) diaFt = allDia[d];
    if (allDia[d].normalized_unit === "in" && !diaIn) diaIn = allDia[d];
    if (!diaFt && !diaIn) diaFt = allDia[d];
  }

  return {
    wind_speed_mph: wind ? (wind.normalized_unit === "knots" ? roundTo(wind.value * 1.15078, 1) : wind.value) : null,
    wave_height_ft: wave ? wave.value : null,
    surge_height_ft: surge ? surge.value : null,
    distance_miles: dist ? (dist.normalized_unit === "ft" ? roundTo(dist.value / 5280, 2) : dist.value) : null,
    impact_speed_mph: speed ? (speed.normalized_unit === "knots" ? roundTo(speed.value * 1.15078, 1) : speed.value) : null,
    diameter_ft: diaFt ? (diaFt.normalized_unit === "in" ? roundTo(diaFt.value / 12, 2) : diaFt.value) : null,
    diameter_in: diaIn ? (diaIn.normalized_unit === "ft" ? roundTo(diaIn.value * 12, 1) : diaIn.value) : null,
    water_depth_ft: depth ? depth.value : null,
    pressure_psi: pressure ? pressure.value : null,
    temperature_f: temp ? temp.value : null,
    duration_hours: duration ? (duration.normalized_unit === "days" ? roundTo(duration.value * 24, 1) : duration.value) : null
  };
}

/* =========================================================
   EVENT DETECTION
   ========================================================= */

var EVENT_PATTERNS: { type: string; phrases: string[]; weight: number }[] = [
  { type: "hurricane", phrases: ["hurricane"], weight: 30 },
  { type: "tornado", phrases: ["tornado"], weight: 30 },
  { type: "earthquake", phrases: ["earthquake", "seismic"], weight: 30 },
  { type: "explosion", phrases: ["explosion", "blast"], weight: 28 },
  { type: "fire", phrases: ["fire", "burned", "thermal event"], weight: 25 },
  { type: "vehicle_impact", phrases: ["truck hit", "car hit", "vehicle hit", "truck struck", "vehicle struck"], weight: 28 },
  { type: "ship_strike", phrases: ["ship strike", "ship hit", "barge strike", "vessel strike"], weight: 28 },
  { type: "impact", phrases: ["impact", "hit", "struck", "collision"], weight: 18 },
  { type: "storm", phrases: ["storm", "severe storm", "tropical storm"], weight: 20 },
  { type: "wind_event", phrases: ["wind", "high wind", "sustained wind", "wind gust"], weight: 15 },
  { type: "wave_surge", phrases: ["wave surge", "storm surge", "surge", "wave impact"], weight: 20 },
  { type: "flood", phrases: ["flood", "flooding", "inundation"], weight: 22 },
  { type: "lightning", phrases: ["lightning", "lightning strike"], weight: 25 },
  { type: "hail", phrases: ["hail"], weight: 20 },
  { type: "corrosion", phrases: ["corrosion", "corroded", "metal loss", "pitting", "rust"], weight: 16 },
  { type: "cracking", phrases: ["crack", "cracking", "fracture", "crack-like"], weight: 18 },
  { type: "fatigue", phrases: ["fatigue", "fatigue crack"], weight: 18 },
  { type: "deformation", phrases: ["deformation", "bent", "buckled", "dent", "dented"], weight: 18 },
  { type: "erosion", phrases: ["erosion", "eroded", "flow accelerated"], weight: 16 },
  { type: "spalling", phrases: ["spalling", "spalled", "concrete spalling"], weight: 16 },
  { type: "coating_damage", phrases: ["coating damage", "coating failure", "paint failure", "coating loss"], weight: 14 },
  { type: "leak", phrases: ["leak", "leaking", "seepage", "weeping"], weight: 20 },
  { type: "vibration", phrases: ["vibration", "vibrating", "excessive vibration"], weight: 14 },
  { type: "undermining", phrases: ["undermining", "scour", "erosion at base"], weight: 18 },
  { type: "marine_growth", phrases: ["marine growth", "biofouling"], weight: 12 }
];

function detectEvents(text: string): DetectedEvent[] {
  var found: DetectedEvent[] = [];
  var seen: Record<string, boolean> = {};

  for (var e = 0; e < EVENT_PATTERNS.length; e++) {
    var ep = EVENT_PATTERNS[e];
    for (var p = 0; p < ep.phrases.length; p++) {
      if (textContains(text, ep.phrases[p])) {
        var key = ep.type + ":" + ep.phrases[p];
        if (!seen[key]) {
          seen[key] = true;
          found.push({
            event_type: ep.type,
            matched_text: ep.phrases[p],
            confidence: clamp(ep.weight + 40, 0, 99)
          });
        }
      }
    }
  }

  found.sort(function(a, b) { return b.confidence - a.confidence; });
  return found;
}

/* =========================================================
   ENVIRONMENT DETECTION
   ========================================================= */

var ENV_PATTERNS: { key: string; phrases: string[] }[] = [
  { key: "offshore", phrases: ["offshore", "gulf", "deepwater", "ocean", "sea"] },
  { key: "subsea", phrases: ["subsea", "seabed", "underwater"] },
  { key: "splash_zone", phrases: ["splash zone"] },
  { key: "marine_exposure", phrases: ["marine", "saltwater", "salt spray"] },
  { key: "refinery", phrases: ["refinery", "refinery unit", "process unit"] },
  { key: "chemical_plant", phrases: ["chemical plant", "chemical facility"] },
  { key: "sour_service", phrases: ["sour", "h2s", "hydrogen sulfide"] },
  { key: "hydrogen_service", phrases: ["hydrogen", "hydrogen service"] },
  { key: "high_temperature", phrases: ["high temperature", "hot service", "elevated temperature"] },
  { key: "insulated", phrases: ["insulated", "insulation", "cui"] },
  { key: "cyclic", phrases: ["cyclic", "startup shutdown", "thermal cycling"] },
  { key: "bridge_context", phrases: ["bridge", "overpass", "causeway", "highway"] },
  { key: "dam_context", phrases: ["dam", "spillway", "reservoir"] },
  { key: "diving_required", phrases: ["diver", "dive team", "diving", "rov"] }
];

function detectEnvironment(text: string): EnvironmentFactor[] {
  var factors: EnvironmentFactor[] = [];
  var seen: Record<string, boolean> = {};

  for (var e = 0; e < ENV_PATTERNS.length; e++) {
    var ep = ENV_PATTERNS[e];
    for (var p = 0; p < ep.phrases.length; p++) {
      if (textContains(text, ep.phrases[p]) && !seen[ep.key]) {
        seen[ep.key] = true;
        factors.push({ key: ep.key, value: ep.phrases[p], evidence: "Matched: " + ep.phrases[p] });
      }
    }
  }

  return factors;
}

/* =========================================================
   CONTRADICTION DETECTION
   ========================================================= */

function detectContradictions(facts: NumericFact[]): Contradiction[] {
  var contradictions: Contradiction[] = [];
  var typeGroups: Record<string, NumericFact[]> = {};

  for (var i = 0; i < facts.length; i++) {
    var f = facts[i];
    if (f.negated) continue;
    if (!typeGroups[f.fact_type]) typeGroups[f.fact_type] = [];
    typeGroups[f.fact_type].push(f);
  }

  var typeKeys = Object.keys(typeGroups);
  for (var t = 0; t < typeKeys.length; t++) {
    var group = typeGroups[typeKeys[t]];
    if (group.length <= 1) continue;

    var values: number[] = [];
    for (var g = 0; g < group.length; g++) values.push(group[g].value);

    var minVal = values[0];
    var maxVal = values[0];
    for (var v = 1; v < values.length; v++) {
      if (values[v] < minVal) minVal = values[v];
      if (values[v] > maxVal) maxVal = values[v];
    }

    var ratio = minVal > 0 ? maxVal / minVal : maxVal;
    if (ratio >= 1.5) {
      var involved: string[] = [];
      for (var g2 = 0; g2 < group.length; g2++) involved.push(group[g2].raw_value_text);
      contradictions.push({
        severity: ratio >= 3 ? "high" : "medium",
        message: "Conflicting " + typeKeys[t].replace(/_/g, " ") + " values detected: " + involved.join(" vs "),
        facts_involved: involved
      });
    }
  }

  return contradictions;
}

/* =========================================================
   CONFIDENCE SCORING
   ========================================================= */

function scoreConfidence(
  textLength: number,
  factCount: number,
  eventCount: number,
  contradictionCount: number,
  primaryFieldsPresent: number
): { score: number; band: string } {
  var score = 20;

  if (textLength >= 20) score += 10;
  if (textLength >= 60) score += 5;
  if (textLength >= 120) score += 5;

  score += Math.min(20, factCount * 5);
  score += Math.min(15, eventCount * 5);
  score += Math.min(20, primaryFieldsPresent * 4);
  score -= Math.min(30, contradictionCount * 12);

  score = clamp(score, 10, 99);

  var band = "low";
  if (score >= 85 && contradictionCount === 0) band = "locked";
  else if (score >= 70 && contradictionCount === 0) band = "high";
  else if (score >= 55) band = "moderate";
  else if (score >= 40) band = "ambiguous";
  else band = "manual_review";

  return { score: score, band: band };
}

/* =========================================================
   CONFIRMATION PROMPT BUILDER
   ========================================================= */

function buildConfirmationPrompts(
  primary: ParsedIncidentOutput["primary_values"],
  contradictions: Contradiction[],
  band: string
): string[] {
  var prompts: string[] = [];

  if (primary.wind_speed_mph !== null) {
    prompts.push("Confirm wind speed: " + primary.wind_speed_mph + " mph");
  }
  if (primary.wave_height_ft !== null) {
    prompts.push("Confirm wave height: " + primary.wave_height_ft + " ft");
  }
  if (primary.surge_height_ft !== null) {
    prompts.push("Confirm surge height: " + primary.surge_height_ft + " ft");
  }
  if (primary.distance_miles !== null) {
    prompts.push("Confirm distance: " + primary.distance_miles + " miles");
  }
  if (primary.impact_speed_mph !== null) {
    prompts.push("Confirm impact speed: " + primary.impact_speed_mph + " mph");
  }
  if (primary.diameter_ft !== null) {
    prompts.push("Confirm diameter: " + primary.diameter_ft + " ft");
  }
  if (primary.diameter_in !== null) {
    prompts.push("Confirm diameter: " + primary.diameter_in + " inches");
  }

  for (var c = 0; c < contradictions.length; c++) {
    prompts.push(contradictions[c].message);
  }

  return prompts;
}

/* =========================================================
   MAIN PARSER
   ========================================================= */

function parseIncident(rawText: string): ParsedIncidentOutput {
  var normalized = lower(rawText);

  var facts = extractNumericFacts(rawText);
  var primary = buildPrimaryValues(facts);
  var events = detectEvents(normalized);
  var environment = detectEnvironment(normalized);
  var contradictions = detectContradictions(facts);

  /* Count primary fields present */
  var fieldsPresent = 0;
  if (primary.wind_speed_mph !== null) fieldsPresent++;
  if (primary.wave_height_ft !== null) fieldsPresent++;
  if (primary.surge_height_ft !== null) fieldsPresent++;
  if (primary.distance_miles !== null) fieldsPresent++;
  if (primary.impact_speed_mph !== null) fieldsPresent++;
  if (primary.diameter_ft !== null || primary.diameter_in !== null) fieldsPresent++;
  if (primary.water_depth_ft !== null) fieldsPresent++;
  if (primary.pressure_psi !== null) fieldsPresent++;
  if (events.length > 0) fieldsPresent++;

  var conf = scoreConfidence(normalized.length, facts.length, events.length, contradictions.length, fieldsPresent);

  var confirmationRequired = conf.band !== "locked" && conf.band !== "high";
  var prompts = buildConfirmationPrompts(primary, contradictions, conf.band);

  return {
    engine: "Speech-to-Structured Incident Parser v1",
    raw_transcript: rawText,
    normalized_transcript: normalized,
    numeric_facts: facts,
    primary_values: primary,
    detected_events: events,
    environment_factors: environment,
    contradictions: contradictions,
    confirmation_required: confirmationRequired,
    confirmation_prompts: confirmationRequired ? prompts : [],
    confidence_score: conf.score,
    confidence_band: conf.band
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
    var rawText = body.transcript || body.raw_text || "";

    if (!rawText.trim()) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: "Speech-to-Structured Incident Parser v1",
          raw_transcript: "",
          normalized_transcript: "",
          numeric_facts: [],
          primary_values: {
            wind_speed_mph: null, wave_height_ft: null, surge_height_ft: null,
            distance_miles: null, impact_speed_mph: null, diameter_ft: null,
            diameter_in: null, water_depth_ft: null, pressure_psi: null,
            temperature_f: null, duration_hours: null
          },
          detected_events: [],
          environment_factors: [],
          contradictions: [],
          confirmation_required: true,
          confirmation_prompts: ["No input text provided."],
          confidence_score: 0,
          confidence_band: "manual_review"
        })
      };
    }

    var result = parseIncident(rawText);

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
      body: JSON.stringify({ error: "Incident Parser failed", detail: errMsg })
    };
  }
};

export { handler };
