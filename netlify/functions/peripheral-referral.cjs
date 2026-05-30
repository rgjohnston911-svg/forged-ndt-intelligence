// ============================================================================
// peripheral-referral.cjs   (Peripheral Referral / load-path extension lens)
// FORGED 4D NDT  -  DEPLOY412
//
// While inspecting a PRIMARY asset, the platform (or a photo) often reveals
// SECONDARY things that are not the inspection target but may matter: a corroded
// pipe support under a critical line, foundation settlement beneath a vessel, a
// normalized temp clamp on an adjacent line, a corroded cable tray, blocked
// drainage. This lens decides what to DO with each peripheral observation:
//
//   REFER    - recommend a dedicated inspection (coupled + high/critical consequence)
//   NOTE     - worth a report line (plausible but lower consequence)
//   SUPPRESS - no articulable physical link / below the coupling floor
//
// Scored by  plausibility = coupling_to_primary * consequence_if_active.
// Evidence confidence is INTENTIONALLY ignored in scoring: thin incidental
// evidence is the REASON to refer for a proper look, not a reason to suppress.
//
// DESIGN: COUPLING is a STRUCTURAL property of the actor CLASS - looked up in
// COUPLING_CATALOG, NOT inferred from text/pixels. consequence_if_active is
// INHERITED from the primary's known service tier. The extractor only detects the
// actor TYPE + CONDITION, then applies a small bounded modifier for observed
// extent. Two entry points feed the SAME scorer:
//   - extractPeripheralsFromText(transcript, primaryConsequenceTier)  (this file)
//   - a photo-analysis (vision) layer that emits referral objects -> scored as-is
//
// PURE DETERMINISTIC. No LLM, no network, no clock, no random, no DB. var only,
// string concatenation only, no template literals, no arrow functions.
// ============================================================================
'use strict';

// ---- CALIBRATION (owned, DEPLOY412) ----------------------------------------
// 1. Catalog couplings + thresholds (FLOOR 0.2, NOTE 0.35, consequence weights)
//    are the structural/contract values - the 9 scorer golden cases pin them.
// 2. Extent modifier is bounded +-0.08 and uniform: it nudges the coupling near a
//    threshold but NEVER re-derives it from wording (the anti-text-coupling rule).
// 3. LOAD_PATH NOTE-FLOOR: a degrading load-path actor above the coupling floor
//    never fully SUPPRESSES - it floors at NOTE. This fixes the fixed_support@MEDIUM
//    knife-edge (0.85*0.4 = 0.34, a hair under 0.35) that would otherwise silently
//    drop a corroded primary support. Compatible with all 9 golden cases.
// 4. Environmental / consequence actors stay plausibility-gated: incidental findings
//    (drainage on a medium line) stay quiet; they escalate only via the primary's
//    INHERITED consequence tier (HIGH/CRITICAL -> REFER), not via condition words.
//    Net MEDIUM/LOW matrix: LOAD_PATH -> NOTE; ENV/CONSEQUENCE -> SUPPRESS;
//    any coupled actor at HIGH/CRITICAL -> REFER.
var CONSEQUENCE_WEIGHT = { LOW: 0.15, MEDIUM: 0.4, HIGH: 0.8, CRITICAL: 1.0 };
var COUPLING_FLOOR = 0.2;
var NOTE_THRESHOLD = 0.35;

function scorePeripheral(ref) {
  var couple = ref.link_to_primary.coupling_strength;
  var cons = ref.consequence_if_active;
  var consW = CONSEQUENCE_WEIGHT[cons] || 0;
  var plausibility = couple * consW;
  var action;
  if (ref.link_to_primary.link_type === 'NONE' || couple < COUPLING_FLOOR) {
    action = 'SUPPRESS';
  } else if (cons === 'HIGH' || cons === 'CRITICAL') {
    action = 'REFER';
  } else if (plausibility >= NOTE_THRESHOLD) {
    action = 'NOTE';
  } else if (ref.link_to_primary.link_type === 'LOAD_PATH') {
    // DEPLOY412 calibration: a degrading LOAD_PATH actor above the coupling floor
    // never fully suppresses - a corroding primary load carrier always merits at
    // least a report line. Fixes the fixed_support@MEDIUM knife-edge (0.85*0.4=0.34,
    // a hair under 0.35) that would otherwise silently drop a corroded support.
    // Environmental / consequence actors remain plausibility-gated; they escalate
    // via the primary's inherited consequence tier, not via condition wording.
    action = 'NOTE';
  } else {
    action = 'SUPPRESS';
  }
  ref.governing_plausibility = plausibility;
  ref.routing.action = action;
  ref.routing.verb = (action === 'REFER') ? 'RECOMMEND_DEDICATED_INSPECTION' : 'NONE';
  return ref;
}

// COUPLING is a STRUCTURAL property of the actor class - looked up here, NOT
// inferred from text or pixels.
var COUPLING_CATALOG = {
  fixed_support:  { link_type: 'LOAD_PATH',     coupling_base: 0.85, note: 'carries dead+thermal load; loss -> sag/bending on primary' },
  anchor:         { link_type: 'LOAD_PATH',     coupling_base: 0.90, note: 'restrains thermal growth; loss -> large unrestrained loads' },
  spring_hanger:  { link_type: 'LOAD_PATH',     coupling_base: 0.70, note: 'load-bearing; seizure redistributes stress' },
  guide:          { link_type: 'LOAD_PATH',     coupling_base: 0.60, note: 'lateral restraint only; moderate load path' },
  foundation:     { link_type: 'CONSEQUENCE',   coupling_base: 0.60, note: 'settlement -> shell distortion / nozzle loads' },
  insulation:     { link_type: 'ENVIRONMENTAL', coupling_base: 0.70, note: 'damage drives CUI directly on primary wall' },
  temp_repair:    { link_type: 'CONSEQUENCE',   coupling_base: 0.40, note: 'release/impingement path; consequence usually carries it' },
  drainage:       { link_type: 'ENVIRONMENTAL', coupling_base: 0.45, note: 'pooling -> external corrosion / support-base attack' },
  cable_tray:     { link_type: 'NONE',          coupling_base: 0.05, note: 'no load path or release link to primary integrity' },
  adjacent_equip: { link_type: 'CONSEQUENCE',   coupling_base: 0.50, note: 'leak/vibration/fire exposure; calibrate per service' }
};

// Actor-class detection. Order matters: specific classes before generic.
var ACTOR_KEYWORDS = [
  { actor: 'spring_hanger',  kw: ['spring hanger', 'spring can', 'variable spring', 'constant spring', 'spring support'], candidate: 'STRUCTURAL_INSTABILITY' },
  { actor: 'anchor',         kw: ['axial anchor', 'main anchor', 'anchor support', 'line anchor', 'anchor restraint', 'pipe anchor'], candidate: 'STRUCTURAL_INSTABILITY' },
  { actor: 'guide',          kw: ['pipe guide', 'lateral guide', 'line guide', 'guide support'], candidate: 'STRUCTURAL_INSTABILITY' },
  { actor: 'fixed_support',  kw: ['fixed support', 'rigid support', 'pipe shoe', 'support steel', 'trunnion', 'saddle', 'support leg', 'support bracket', 'pipe support', 'rest support', 'supporting structure', 'support structure', 'support beneath', 'support member', 'pipe hanger', 'support clamp', 'u-bolt'], candidate: 'STRUCTURAL_INSTABILITY' },
  { actor: 'foundation',     kw: ['foundation', 'footing', 'pile cap', 'pedestal', 'baseplate', 'plinth', 'anchor bolt', 'grout', 'settlement'], candidate: 'STRUCTURAL_INSTABILITY' },
  { actor: 'insulation',     kw: ['wet insulation', 'damaged insulation', 'missing insulation', 'insulation damage', 'damaged cladding', 'damaged jacketing', 'cui'], candidate: 'cui' },
  { actor: 'temp_repair',    kw: ['temporary repair', 'temp clamp', 'temporary clamp', 'leak clamp', 'clamp repair', 'band-aid', 'bandaid', 'stopgap', 'normalized repair', 'undocumented repair', 'temporary fix'], candidate: '' },
  { actor: 'drainage',       kw: ['blocked drain', 'blocked drainage', 'poor drainage', 'standing water', 'pooling water', 'water pooling', 'ponding', 'water collecting'], candidate: '' },
  { actor: 'cable_tray',     kw: ['cable tray', 'cabling', 'conduit', 'junction box', 'electrical tray', 'esd cabling'], candidate: '' },
  { actor: 'adjacent_equip', kw: ['adjacent line', 'adjacent vessel', 'adjacent equipment', 'nearby equipment', 'neighboring equipment', 'adjacent unit'], candidate: '' }
];

function norm(s) { if (s === null || s === undefined) { return ''; } return String(s).toLowerCase().replace(/\s+/g, ' '); }

function buildRef(o) {
  o = o || {};
  return {
    referral_id: o.id || 'R',
    secondary_asset: { type: o.type || 'unknown', descriptor: o.descriptor || '', in_scope: false },
    observation: {
      finding: o.finding || '',
      provenance: o.provenance || 'OBSERVED_VISUAL',
      evidence_confidence: (o.evidence_confidence == null ? 0.4 : o.evidence_confidence)
    },
    link_to_primary: {
      link_type: o.link_type || 'NONE',
      mechanism: o.mechanism || '',
      coupling_strength: (o.coupling == null ? 0 : o.coupling),
      fmd_hook: { could_shift_governing_mode: !!o.shift, candidate_mode: o.candidate_mode || '' }
    },
    governing_plausibility: 0,
    consequence_if_active: o.consequence || 'LOW',
    routing: { action: 'SUPPRESS', refer_to_discipline: o.discipline || '', verb: 'NONE', rationale: o.rationale || '' },
    raised_by: 'REALITY_CHALLENGE_PERIPHERAL',
    scored_by: 'FMD_LOADPATH_EXTENSION'
  };
}

function clampN(x, lo, hi) { if (x < lo) { return lo; } if (x > hi) { return hi; } return x; }
function round2(x) { return Math.round(x * 100) / 100; }

// Bounded extent modifier (+-0.08): observed condition adjusts catalog coupling only
// at the margin; it does NOT re-derive coupling from text.
function extentModifier(win) {
  if (/sever|badly|heavily|seized|failed|collapsed|gross|major|through.?wall|extensive|advanced|fully/.test(win)) { return 0.08; }
  if (/minor|slight|light|superficial|early|incipient|cosmetic|surface only|isolated/.test(win)) { return -0.08; }
  return 0;
}

var VALID_TIER = { LOW: true, MEDIUM: true, HIGH: true, CRITICAL: true };

function extractPeripheralsFromText(transcript, primaryConsequenceTier) {
  var lt = norm(transcript);
  var inherited = (primaryConsequenceTier && VALID_TIER[String(primaryConsequenceTier).toUpperCase()])
    ? String(primaryConsequenceTier).toUpperCase()
    : 'HIGH';
  var out = [];
  var seen = {};
  for (var i = 0; i < ACTOR_KEYWORDS.length; i++) {
    var ak = ACTOR_KEYWORDS[i];
    if (seen[ak.actor]) { continue; }
    for (var k = 0; k < ak.kw.length; k++) {
      var term = ak.kw[k];
      var idx = lt.indexOf(term);
      if (idx < 0) { continue; }
      var win = lt.substring(Math.max(0, idx - 70), Math.min(lt.length, idx + term.length + 70));
      var degraded = /corro|crack|degrad|wasted|wasting|wall loss|section loss|thinning|deteriorat|rusted|rusting|buckl|seized|settl|loose|missing|damaged|leak|wet|blocked|failing|fail|compromis|undocumented|temporary|temp clamp|chip|pooling|standing water/.test(win);
      if (!degraded) { continue; }
      seen[ak.actor] = true;
      var cat = COUPLING_CATALOG[ak.actor];
      var linkType = cat.link_type;
      if (/unrelated|not connected|no connection|separate system|independent system|isolated from|different system/.test(win)) {
        linkType = 'NONE';
      }
      var coupling = round2(clampN(cat.coupling_base + extentModifier(win), 0, 0.98));
      out.push(buildRef({
        id: 'R-' + ak.actor,
        type: ak.actor,
        descriptor: term,
        finding: 'Peripheral actor "' + term + '" shows an observed condition in the vicinity of the primary asset.',
        link_type: linkType,
        mechanism: cat.note,
        coupling: coupling,
        consequence: inherited,
        candidate_mode: ak.candidate,
        shift: !!ak.candidate,
        discipline: (ak.actor === 'cable_tray') ? 'electrical' : (ak.actor === 'foundation' ? 'civil/structural' : 'structural/integrity'),
        provenance: 'OBSERVED_VISUAL'
      }));
      break;
    }
  }
  return out;
}

// Normalize a referral so coupling + link_type ALWAYS come from COUPLING_CATALOG
// keyed on the identified actor type - NEVER from a supplied value. This is the
// discipline for the photo/vision feed: a VLM can see a corroded support but it
// cannot see the load path or the primary's service, so it must emit the actor
// type + condition only. Any coupling it supplies is discarded. An extent hint
// (condition_extent or the finding text) applies the same bounded modifier.
function normalizeReferral(ref) {
  if (!ref || !ref.secondary_asset) { return ref; }
  var type = ref.secondary_asset.type;
  var cat = COUPLING_CATALOG[type];
  if (!ref.link_to_primary) { ref.link_to_primary = { link_type: 'NONE', mechanism: '', coupling_strength: 0, fmd_hook: {} }; }
  if (!cat) {
    // Unknown actor: cannot assert a structural link -> NONE / no coupling.
    ref.link_to_primary.link_type = 'NONE';
    ref.link_to_primary.coupling_strength = 0;
    return ref;
  }
  var extentSrc = (ref.condition_extent || (ref.observation && ref.observation.finding) || '').toLowerCase();
  ref.link_to_primary.link_type = cat.link_type;
  ref.link_to_primary.mechanism = cat.note;
  ref.link_to_primary.coupling_strength = round2(clampN(cat.coupling_base + extentModifier(extentSrc), 0, 0.98));
  return ref;
}

function scoreReferrals(refs) {
  var list = refs || [];
  var scored = [];
  var refer = 0, note = 0, suppress = 0;
  for (var i = 0; i < list.length; i++) {
    var s = scorePeripheral(list[i]);
    scored.push(s);
    if (s.routing.action === 'REFER') { refer++; }
    else if (s.routing.action === 'NOTE') { note++; }
    else { suppress++; }
  }
  var rank = { REFER: 0, NOTE: 1, SUPPRESS: 2 };
  scored.sort(function (a, b) {
    var ra = rank[a.routing.action], rb = rank[b.routing.action];
    if (ra !== rb) { return ra - rb; }
    return b.governing_plausibility - a.governing_plausibility;
  });
  return {
    referrals: scored,
    summary: { total: scored.length, refer: refer, note: note, suppress: suppress },
    engine: 'peripheral-referral',
    version: '1.1.0'
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
    var refs;
    if (body.referrals && body.referrals.length) {
      // Photo/vision feed: re-derive coupling+link_type from the catalog by actor
      // type; never trust a supplied coupling (coupling is not in the pixels).
      refs = [];
      for (var ri = 0; ri < body.referrals.length; ri++) { refs.push(normalizeReferral(body.referrals[ri])); }
    } else {
      refs = extractPeripheralsFromText(body.transcript || '', body.primary_consequence_tier);
    }
    var result = scoreReferrals(refs);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'peripheral-referral failed: ' + (err && err.message ? err.message : 'unknown error') }) };
  }
}

module.exports = {
  scorePeripheral: scorePeripheral,
  buildRef: buildRef,
  extractPeripheralsFromText: extractPeripheralsFromText,
  scoreReferrals: scoreReferrals,
  normalizeReferral: normalizeReferral,
  COUPLING_CATALOG: COUPLING_CATALOG,
  handler: handler
};
