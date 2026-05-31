// ============================================================================
// report-provenance.cjs   (Report provenance gate - the single-asset analog of
// the panel's no-band-colour check)   FORGED 4D NDT  -  DEPLOY417
//
// "Constrained by decision-core JSON" was prompt intent + a non-blocking,
// prefix-only check on the evidence_trace side-array. The narrative PROSE was
// never cross-checked, so a number that appears only in the prose - invented or
// mis-stated by the synthesis LLM - passed through untouched. That is the exact
// demo-killer: a CWI points at a sentence and asks "where did that number come
// from?" and the answer is "the language model wrote it."
//
// This is a falsifiable assertion: every QUANTITATIVE claim (a number carrying a
// unit or %, or a decimal - i.e. an engineering measurement, not a bare count)
// and the stated DISPOSITION in the rendered prose must trace to a value the
// deterministic engines produced. On a miss it returns a verdict the caller can
// act on (flag / strip / withhold) - it never silently passes an unsourced number.
//
// Calibration (honest): fraction<->percent and rounding are normalized so a
// legitimately rounded/expressed source value (0.42 -> "42%") is NOT false-
// flagged. KNOWN-OPEN edge: a number the engines COMPUTE but never store as a
// field/string (a derived sum) could false-flag; bare unit-less integers are not
// checked (low attack value, high false-positive). The gate measures, it doesn't
// pretend the edge is closed.
//
// PURE DETERMINISTIC. var only, string concatenation, no template literals/arrows.
// ============================================================================
'use strict';

function round(n, dp) { var f = Math.pow(10, dp); return Math.round(n * f) / f; }

// Collect every numeric value reachable in the source (decision-core + engine
// results), INCLUDING numbers embedded in engine narrative strings, and register
// fraction<->percent variants at three rounding precisions so legit expression
// does not false-flag.
function registerNum(acc, n) {
  if (typeof n !== 'number' || !isFinite(n)) { return; }
  acc[String(round(n, 2))] = true;
  acc[String(round(n, 1))] = true;
  acc[String(round(n, 0))] = true;
  if (n > 0 && n < 1) { var p = n * 100; acc[String(round(p, 1))] = true; acc[String(round(p, 0))] = true; }
  if (n >= 1 && n <= 100) { var fr = n / 100; acc[String(round(fr, 3))] = true; acc[String(round(fr, 2))] = true; }
}
function collectSourceNumbers(obj, acc) {
  acc = acc || {};
  if (obj === null || obj === undefined) { return acc; }
  if (typeof obj === 'number') { registerNum(acc, obj); return acc; }
  if (typeof obj === 'string') {
    var m = obj.match(/-?\d+(?:\.\d+)?/g) || [];
    for (var i = 0; i < m.length; i++) { registerNum(acc, parseFloat(m[i])); }
    return acc;
  }
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) { for (var j = 0; j < obj.length; j++) { collectSourceNumbers(obj[j], acc); } return acc; }
    for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) { collectSourceNumbers(obj[k], acc); } }
  }
  return acc;
}

// A quantitative claim = a number that carries a unit / % OR is a decimal. Bare
// unit-less integers (counts, ordinals) are intentionally NOT claims.
var UNIT_RE = '(%|percent|pct|mm|millimet(?:er|re)s?|cm|m\\b|in\\b|inch(?:es)?|"|mils?|years?|yrs?|months?|days?|hours?|cycles?|ksi|psi|psig|mpa|bar|kpa|°c|°f|degc|degf|degrees?)';
function extractClaims(prose) {
  var text = String(prose || '');
  var re = new RegExp('(-?\\d+(?:\\.\\d+)?)\\s*' + UNIT_RE + '?', 'gi');
  var claims = [], mm;
  while ((mm = re.exec(text)) !== null) {
    var raw = mm[0].trim();
    var value = parseFloat(mm[1]);
    var unit = (mm[2] || '').toLowerCase();
    var isDecimal = mm[1].indexOf('.') >= 0;
    if (!unit && !isDecimal) { continue; }            // bare integer -> not a quantitative claim
    if (!isFinite(value)) { continue; }
    claims.push({ raw: raw, value: value, unit: unit });
  }
  return claims;
}

function numberIsSourced(value, srcAcc) {
  var keys = [String(round(value, 2)), String(round(value, 1)), String(round(value, 0))];
  for (var i = 0; i < keys.length; i++) { if (srcAcc[keys[i]]) { return true; } }
  return false;
}

// Disposition vocabulary in prose vs the engine's decision_reality.disposition.
var DISPO_TERMS = {
  no_go: ['no-go', 'no go', 'not fit for service', 'unfit for service', 'shut in', 'shut-in', 'remove from service', 'take out of service'],
  hold_for_review: ['hold for review', 'hold pending', 'on hold', 'withhold', 'further review required', 'engineering review required'],
  monitor: ['monitor', 'continued monitoring', 'monitor and re-inspect'],
  continue_service: ['fit for service', 'fit for continued service', 'continue service', 'continued service', 'return to service', 'acceptable for service']
};
function statedDisposition(prose) {
  var t = String(prose || '').toLowerCase();
  var keys = Object.keys(DISPO_TERMS);
  for (var i = 0; i < keys.length; i++) {
    var terms = DISPO_TERMS[keys[i]];
    for (var j = 0; j < terms.length; j++) { if (t.indexOf(terms[j]) >= 0) { return keys[i]; } }
  }
  return null;
}
function normDispo(d) {
  var s = String(d || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (s.indexOf('no_go') >= 0 || s === 'nogo') { return 'no_go'; }
  if (s.indexOf('hold') >= 0) { return 'hold_for_review'; }
  if (s.indexOf('monitor') >= 0) { return 'monitor'; }
  if (s.indexOf('continue') >= 0 || s.indexOf('fit') >= 0 || s === 'go') { return 'continue_service'; }
  return s || null;
}

// prose: string (or array of strings) of the rendered narrative.
// source: the decision-core + engine results object (authoritative).
// engineDisposition: decision_reality.disposition (authoritative), optional.
function validateProvenance(prose, source, engineDisposition) {
  var proseStr = Array.isArray(prose) ? prose.join('\n') : String(prose || '');
  var srcAcc = collectSourceNumbers(source, {});
  var claims = extractClaims(proseStr);
  var unsourced = [];
  for (var i = 0; i < claims.length; i++) {
    if (!numberIsSourced(claims[i].value, srcAcc)) { unsourced.push(claims[i].raw); }
  }
  var stated = statedDisposition(proseStr);
  var engine = normDispo(engineDisposition);
  var dispositionMatch = (stated === null || engine === null) ? true : (stated === engine);

  var verdict = 'PASS';
  if (unsourced.length > 0 || !dispositionMatch) { verdict = 'FAIL'; }

  return {
    verdict: verdict,
    claims_checked: claims.length,
    unsourced_claims: unsourced,
    stated_disposition: stated,
    engine_disposition: engine,
    disposition_match: dispositionMatch,
    note: verdict === 'PASS'
      ? 'Every quantitative claim and the stated disposition trace to an engine value.'
      : 'Report contains a claim the engines did not produce - withhold or flag before relying on it.'
  };
}

var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};
async function handler(event) {
  if (event.httpMethod === 'OPTIONS') { return { statusCode: 200, headers: CORS_HEADERS, body: '' }; }
  if (event.httpMethod !== 'POST') { return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }; }
  try {
    var body = JSON.parse(event.body || '{}');
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(validateProvenance(body.prose, body.source, body.engine_disposition)) };
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
}
module.exports = {
  collectSourceNumbers: collectSourceNumbers, extractClaims: extractClaims,
  statedDisposition: statedDisposition, validateProvenance: validateProvenance, handler: handler
};
