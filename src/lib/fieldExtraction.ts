// ============================================================================
// fieldExtraction.ts — CANONICAL numeric field extractor (single source of truth)
// ----------------------------------------------------------------------------
// Replaces the divergent, hand-grown regex blocks that had accreted across the
// frontend entry points (VoiceInspectionPage, voice-grammar-bridge, ...). Each
// entry point used to re-implement extraction with its own regexes, so a fix in
// one place (e.g. the comma-thousands "2,850 psi" -> 850 bug) left the others
// broken. This module is the ONE place those rules live.
//
// Design contract:
//  - DETERMINISTIC + comma-safe. "2,850 psi" -> 2850, never 850.
//  - Every extracted field carries provenance: the verbatim source span it came
//    from and the rule id that fired. Nothing is invented.
//  - Priority ordering: a labeled value (operating pressure / nominal wall) wins
//    over a bare value (a stray "N psi" that may be the design line).
//  - Pure: no I/O, no globals. Browser- and Node-safe. Fully unit-testable.
//
// This is the deterministic baseline. A server-side GPT augmentation pass can
// later propose candidates for messy phrasings the rules miss; those candidates
// must be verified verbatim against the source (verifyVerbatim below) and the
// rule-locked values here always win — same precedence parse-incident already uses.
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

// A number token: comma-grouped (1,234 / 12,345,678) OR plain (1234), optional decimal.
var NUM = "((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)";

function toNum(raw: string): number {
  return parseFloat(String(raw).replace(/,/g, ""));
}

// Run an ordered list of {re, unit, mult, rule} against the text. First match
// whose parsed value passes [min,max] bounds wins. Returns the field or null.
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
        return {
          value: Math.round(v * 10000) / 10000,
          unit: r.unit,
          source: m[0].trim(),
          rule: r.rule
        };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// extractFields — the canonical entry point.
// ---------------------------------------------------------------------------
export function extractFields(rawText: string): ExtractionResult {
  var text = String(rawText || "");
  var lt = text.toLowerCase();
  var fields: { [key: string]: ExtractedField } = {};

  // --- OPERATING PRESSURE (psi) -------------------------------------------
  // Labeled "operating pressure" / MAOP / MAWP win over a bare "N psi" (which
  // is often the DESIGN line). bar/barg and MPa are converted to psi.
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

  // --- DESIGN PRESSURE (psi) ----------------------------------------------
  // Kept distinct so it is never confused with operating pressure.
  var designPsi = firstMatch(lt, [
    { re: new RegExp("design\\s+pressure[^0-9]{0,14}" + NUM + "\\s*psi[g]?", "i"), unit: "psi", rule: "design_pressure_labeled" },
    { re: new RegExp("design\\s+pressure[^0-9]{0,14}" + NUM + "\\s*bar[g]?", "i"), unit: "psi", mult: 14.5038, rule: "design_pressure_bar" },
    { re: new RegExp("design\\s+pressure[^0-9]{0,14}" + NUM + "\\s*mpa", "i"), unit: "psi", mult: 145.038, rule: "design_pressure_mpa" }
  ], 0, 20000);
  if (designPsi) fields.design_pressure = designPsi;

  // --- NOMINAL WALL (in) ---------------------------------------------------
  // original / as-built / design wall IS the nominal wall for B31G. mm -> in.
  var nominal = firstMatch(lt, [
    { re: new RegExp(NUM + "\\s*(?:in|inch|inches|\")\\s*nominal\\b", "i"), unit: "in", rule: "value_then_nominal" },
    { re: new RegExp("nominal(?:\\s+wall)?(?:\\s+thickness)?\\s*[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "i"), unit: "in", rule: "nominal_wall_labeled" },
    { re: new RegExp("(?:original|as[- ]?built|design)(?:\\s+wall)?(?:\\s+thickness)?\\s*[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "i"), unit: "in", rule: "original_thickness_as_nominal" },
    { re: new RegExp("nominal(?:\\s+wall)?(?:\\s+thickness)?\\s*[:=]?\\s*" + NUM + "\\s*mm", "i"), unit: "in", mult: 0.03937, rule: "nominal_wall_mm" }
  ], 0.05, 5);
  if (nominal) fields.nominal_wall = nominal;

  // --- MEASURED / MINIMUM WALL (in) ---------------------------------------
  var measured = firstMatch(lt, [
    { re: new RegExp("min(?:imum)?\\s+(?:wall|thickness)[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "i"), unit: "in", rule: "minimum_wall_labeled" },
    { re: new RegExp("measured\\s+(?:wall|thickness|minimum)[:=]?\\s*" + NUM + "\\s*(?:in|inch|inches|\")", "i"), unit: "in", rule: "measured_wall_labeled" },
    { re: new RegExp(NUM + "\\s*(?:in|inch|inches|\")\\s*min(?:imum)?\\b", "i"), unit: "in", rule: "value_then_minimum" },
    { re: new RegExp("min(?:imum)?\\s+(?:wall|thickness)[:=]?\\s*" + NUM + "\\s*mm", "i"), unit: "in", mult: 0.03937, rule: "minimum_wall_mm" }
  ], 0.05, 5);
  if (measured) fields.measured_min_wall = measured;

  // --- WALL LOSS (%) -------------------------------------------------------
  var wallLoss = firstMatch(lt, [
    { re: new RegExp(NUM + "\\s*(?:%|percent)\\s*(?:wall|metal|thickness|loss|reduction)", "i"), unit: "%", rule: "percent_then_wall" },
    { re: new RegExp("(?:wall\\s*loss|metal\\s*loss|thickness\\s*loss)[^0-9]{0,10}" + NUM + "\\s*(?:%|percent)", "i"), unit: "%", rule: "wall_then_percent" }
  ], 0, 100.0001);
  if (wallLoss) fields.wall_loss_percent = wallLoss;

  // --- DIAMETER (in) -------------------------------------------------------
  var diameter = firstMatch(lt, [
    { re: new RegExp(NUM + "\\s*(?:in|inch|inches|\")\\s*(?:diam|diameter|od|o\\.d\\.|nps)", "i"), unit: "in", rule: "diameter_labeled" },
    { re: new RegExp("(?:diameter|od|nps)[^0-9]{0,8}" + NUM + "\\s*(?:in|inch|inches|\")?", "i"), unit: "in", rule: "diameter_label_first" }
  ], 0, 200);
  if (diameter) fields.diameter_in = diameter;

  return { fields: fields, text: text };
}

// ---------------------------------------------------------------------------
// verifyVerbatim — hallucination guard for the (future) GPT augmentation pass.
// Asserts a claimed numeric value actually appears (comma-insensitively) inside
// a span that is itself a verbatim substring of the source text. A GPT-proposed
// field that fails this is dropped — the model cannot introduce a number the
// source does not contain.
// ---------------------------------------------------------------------------
export function verifyVerbatim(rawText: string, value: number, sourceSpan: string): boolean {
  if (!sourceSpan) return false;
  var hay = String(rawText || "").toLowerCase().replace(/,/g, "");
  var span = String(sourceSpan).toLowerCase().replace(/,/g, "");
  if (hay.indexOf(span) < 0) return false;            // span must be real text
  var digits = String(value).replace(/[^0-9.]/g, "");
  return span.replace(/[^0-9.]/g, "").indexOf(digits) >= 0; // value must be in the span
}
