// ============================================================================
// fieldExtraction.ts — CANONICAL numeric field extractor (single source of truth)
// ----------------------------------------------------------------------------
// One place for the numeric-extraction rules that used to be re-implemented
// (divergently) across the frontend. DETERMINISTIC, comma-safe, provenance on
// every field. DEPLOY424 origin; DEPLOY426 adds: multi-reading measured-wall
// (takes the MINIMUM / worst case), and wall-loss COMPUTED from nominal+measured
// when no explicit wall-context percentage is stated (so a "rates increased 40%"
// figure can never be mistaken for wall loss).
// ============================================================================

export interface ExtractedField {
  value: number;
  unit: string;
  source: string; // verbatim substring of the input that justified this value
  rule: string;   // which rule fired (for audit / debugging)
}

export interface ExtractionResult {
  fields: { [key: string]: ExtractedField };
  text: string;
}

// A number token: comma-grouped (1,234) OR plain (1234), optional decimal.
// The WHOLE number (incl. decimal) is the capture group.
var NUM = "((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)";

function toNum(raw: string): number {
  return parseFloat(String(raw).replace(/,/g, ""));
}

function firstMatch(
  text: string,
  rules: Array<{ re: RegExp; unit: string; mult?: number; rule: string }>,
  min: number,
  max: number
): ExtractedField | null {
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    var m = r.re.exec(text);
    if (m && m[1] != null) {
      var v = toNum(m[1]);
      if (r.mult) v = v * r.mult;
      if (isFinite(v) && v > min && v < max) {
        return { value: Math.round(v * 10000) / 10000, unit: r.unit, source: m[0].trim(), rule: r.rule };
      }
    }
  }
  return null;
}

// Collect ALL measured/current/remaining/minimum wall readings and return the
// MINIMUM (worst case) — never nominal. Used so multi-location UT grids
// ("Location A 0.425, B 0.418, C 0.430") resolve to the governing 0.418.
function measuredMinWall(text: string): ExtractedField | null {
  var pats = [
    new RegExp("(?:current|measured|remaining|minimum|min)\\s+(?:wall|thickness)?\\s*[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "ig"),
    new RegExp(NUM + "\\s*(?:in|inch|inches|\")\\s*(?:minimum|min)\\b", "ig")
  ];
  var best: number = NaN;
  var bestSpan = "";
  var bestRule = "";
  for (var p = 0; p < pats.length; p++) {
    var re = pats[p];
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m[1] == null) continue;
      var v = toNum(m[1]);
      if (isFinite(v) && v > 0.05 && v < 5) {
        if (isNaN(best) || v < best) { best = v; bestSpan = m[0].trim(); bestRule = (p === 0 ? "measured_wall_min" : "value_then_minimum"); }
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  if (isNaN(best)) return null;
  return { value: Math.round(best * 10000) / 10000, unit: "in", source: bestSpan, rule: bestRule };
}

export function extractFields(rawText: string): ExtractionResult {
  var text = String(rawText || "");
  var lt = text.toLowerCase();
  var fields: { [key: string]: ExtractedField } = {};

  // --- OPERATING PRESSURE (psi) — labeled/MAOP wins over bare; bar/MPa convert.
  var opPsi = firstMatch(lt, [
    { re: new RegExp("operating\\s+pressure[^0-9]{0,14}" + NUM + "\\s*psi[g]?", "i"), unit: "psi", rule: "operating_pressure_labeled" },
    { re: new RegExp("(?:maop|mawp|mop)[^0-9]{0,14}" + NUM + "\\s*psi[g]?", "i"), unit: "psi", rule: "maop_labeled" },
    { re: new RegExp("operating\\s+pressure[^0-9]{0,14}" + NUM + "\\s*bar[g]?", "i"), unit: "psi", mult: 14.5038, rule: "operating_pressure_bar" },
    { re: new RegExp("operating\\s+pressure[^0-9]{0,14}" + NUM + "\\s*mpa", "i"), unit: "psi", mult: 145.038, rule: "operating_pressure_mpa" },
    { re: new RegExp(NUM + "\\s*psi[g]?", "i"), unit: "psi", rule: "bare_psi" },
    { re: new RegExp(NUM + "\\s*bar[g]?\\b", "i"), unit: "psi", mult: 14.5038, rule: "bare_bar" },
    { re: new RegExp(NUM + "\\s*mpa\\b", "i"), unit: "psi", mult: 145.038, rule: "bare_mpa" }
  ], 0, 20000);
  if (opPsi) fields.operating_pressure = opPsi;

  // --- DESIGN PRESSURE (psi) — distinct, never confused with operating.
  var designPsi = firstMatch(lt, [
    { re: new RegExp("design\\s+pressure[^0-9]{0,14}" + NUM + "\\s*psi[g]?", "i"), unit: "psi", rule: "design_pressure_labeled" },
    { re: new RegExp("design\\s+pressure[^0-9]{0,14}" + NUM + "\\s*bar[g]?", "i"), unit: "psi", mult: 14.5038, rule: "design_pressure_bar" },
    { re: new RegExp("design\\s+pressure[^0-9]{0,14}" + NUM + "\\s*mpa", "i"), unit: "psi", mult: 145.038, rule: "design_pressure_mpa" }
  ], 0, 20000);
  if (designPsi) fields.design_pressure = designPsi;

  // --- NOMINAL WALL (in) — original/as-built/design wall IS nominal; mm -> in.
  var nominal = firstMatch(lt, [
    { re: new RegExp(NUM + "\\s*(?:in|inch|inches|\")\\s*nominal\\b", "i"), unit: "in", rule: "value_then_nominal" },
    { re: new RegExp("nominal(?:\\s+wall)?(?:\\s+thickness)?\\s*[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "i"), unit: "in", rule: "nominal_wall_labeled" },
    { re: new RegExp("(?:original|as[- ]?built|design)(?:\\s+wall)?(?:\\s+thickness)?\\s*[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "i"), unit: "in", rule: "original_thickness_as_nominal" },
    { re: new RegExp("nominal(?:\\s+wall)?(?:\\s+thickness)?\\s*[:=]?\\s*" + NUM + "\\s*mm", "i"), unit: "in", mult: 0.03937, rule: "nominal_wall_mm" }
  ], 0.05, 5);
  if (nominal) fields.nominal_wall = nominal;

  // --- MEASURED / MINIMUM WALL (in) — minimum across all readings (worst case).
  var measured = measuredMinWall(lt);
  if (measured) fields.measured_min_wall = measured;

  // --- WALL LOSS (%) -------------------------------------------------------
  // 1) explicit, wall-context only (a bare "40%" with no wall word is NOT wall
  //    loss — that guards against the "rates increased 40%" contamination).
  var wallLoss = firstMatch(lt, [
    { re: new RegExp(NUM + "\\s*(?:%|percent)\\s*(?:wall|metal|thickness)\\s*(?:loss|reduction|thinning)?", "i"), unit: "%", rule: "percent_then_wall" },
    { re: new RegExp("(?:wall\\s*loss|metal\\s*loss|thickness\\s*loss)[^0-9]{0,10}" + NUM + "\\s*(?:%|percent)", "i"), unit: "%", rule: "wall_then_percent" }
  ], 0, 100.0001);
  if (wallLoss) {
    fields.wall_loss_percent = wallLoss;
  } else if (nominal && measured && measured.value < nominal.value) {
    // 2) COMPUTED from nominal + minimum measured when not explicitly stated.
    var pct = ((nominal.value - measured.value) / nominal.value) * 100;
    if (isFinite(pct) && pct > 0 && pct < 100) {
      fields.wall_loss_percent = {
        value: Math.round(pct * 10) / 10,
        unit: "%",
        source: "computed from nominal " + nominal.value + " and measured " + measured.value,
        rule: "computed_from_nominal_measured"
      };
    }
  }

  // --- DIAMETER (in) -------------------------------------------------------
  var diameter = firstMatch(lt, [
    { re: new RegExp(NUM + "\\s*(?:in|inch|inches|\")\\s*(?:diam|diameter|od|o\\.d\\.|nps)", "i"), unit: "in", rule: "diameter_labeled" },
    { re: new RegExp("(?:diameter|od|nps)[^0-9]{0,8}" + NUM + "\\s*(?:in|inch|inches|\")?", "i"), unit: "in", rule: "diameter_label_first" }
  ], 0, 200);
  if (diameter) fields.diameter_in = diameter;

  return { fields: fields, text: text };
}

// verifyVerbatim — hallucination guard for the (future) GPT augmentation pass.
export function verifyVerbatim(rawText: string, value: number, sourceSpan: string): boolean {
  if (!sourceSpan) return false;
  var hay = String(rawText || "").toLowerCase().replace(/,/g, "");
  var span = String(sourceSpan).toLowerCase().replace(/,/g, "");
  if (hay.indexOf(span) < 0) return false;
  var digits = String(value).replace(/[^0-9.]/g, "");
  return span.replace(/[^0-9.]/g, "").indexOf(digits) >= 0;
}
