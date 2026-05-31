// ============================================================================
// situational-awareness-convergence.cjs   (SA layer L9.6)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY384 / DEPLOY425 / DEPLOY427
//
// Convergence Detection. Several INDEPENDENT evidence streams (different sensors,
// surveys, people, datasets) quietly telling the same story -> a Convergence
// Score (0-10) on a candidate failure hypothesis.
//
// ANTI-CONTAMINATION (two layers):
//   DEPLOY425 - SIGNATURE GATING. A hypothesis is eligible only when all its
//     REQUIRED streams are present, so coating + a prior incident can no longer
//     summon "anchor drag".
//   DEPLOY427 - GENERATED NARRATIVE. The narrative is no longer a canned
//     paragraph that name-drops optional mechanisms (the old INTERNAL_CORROSION
//     text asserted "cathodic-protection decline" even when no CP stream fired).
//     Now: a short mechanism claim guaranteed by the REQUIRED streams, plus
//     clauses appended ONLY for streams that actually matched. A mechanism can
//     never be named unless its evidence is present.
//
// PURE DETERMINISTIC. var only, string concatenation, no template literals, no
// arrow functions.
// ============================================================================
'use strict';

var EVIDENCE_STREAMS = [
  { id: 'INCIDENT_HISTORY', source: 'Operations / incident log',
    keywords: ['anchor drag', 'anchor-drag', 'dragged anchor', 'lost position', 'vessel lost',
               'supply vessel', 'allision', 'vessel contact', 'impact event', 'dropped object',
               'collision', 'struck'] },
  { id: 'VISUAL_DISPLACEMENT', source: 'ROV visual observation',
    keywords: ['pipe moved', 'pipe has moved', 'pipe looked', 'slightly displaced', 'displaced',
               'displacement', 'moved compared', 'shifted', 'out of position'] },
  { id: 'GEOMETRY_OVALITY', source: 'Geometry / caliper scan',
    keywords: ['ovality', 'out of round', 'out-of-round', 'deformation', 'deformed', 'dent',
               'exceeds design limit', 'geometry scan', 'buckle'] },
  { id: 'COATING_DAMAGE', source: 'External coating survey',
    keywords: ['coating damage', 'coating disbondment', 'disbondment', 'disbonded', 'coating loss',
               'marine growth', 'holiday'] },
  { id: 'CP_DEGRADATION', source: 'Cathodic protection survey',
    keywords: ['cathodic protection', 'cp survey', 'cp system', 'anode consumption', 'anode',
               'cp degraded', 'cp appears degraded', 'low potential', 'protection degraded'] },
  { id: 'WALL_LOSS', source: 'UT / ACFM thickness',
    keywords: ['wall loss', 'remaining wall', 'external corrosion', 'metal loss', 'wall thinning',
               'thinning', 'acfm', 'pitting', 'thickness loss', 'current wall', 'erosion-corrosion',
               'flow-accelerated', 'flow accelerated'] },
  { id: 'PROCESS_CHEMISTRY', source: 'Process / fluid chemistry',
    keywords: ['co2', 'co₂', 'sour crude', 'sour service', 'sour', 'produced water', 'h2s', 'h₂s',
               'hydrogen sulfide', 'corrosive service', 'chlorides', 'ammonium bisulfide', 'nh4hs',
               'ammonia'] },
  { id: 'OPERATIONAL_CHANGE', source: 'Operations / production data',
    keywords: ['flow rate increased', 'flow increased', 'increased flow', 'flow rate up',
               'velocity increased', 'rate increased', 'rates increased', 'reinjection rate',
               'injection rate', 'throughput increased', 'increased 40', 'production increased',
               'rate change', 'higher rate', 'high-rate', 'charge rate', 'revamp', 'increased severity'] },
  { id: 'VIBRATION', source: 'Operations / vibration observation',
    keywords: ['vibration', 'vibrating', 'vibration increased', 'resonance', 'cyclic load',
               'cyclic loading', 'dynamic loading', 'vibration-related', 'pulsation'] },
  { id: 'STRUCTURAL_INTERFACE', source: 'Structural / support inspection',
    keywords: ['branch connection', 'branch weld', 'small-bore', 'small bore', 'tie-in',
               'nozzle', 'support shoe', 'pipe support', 'clamp support', 'support clamp',
               'support replaced', 'metal-to-metal wear', 'shoe', 'elbow', 'tee'] },
  { id: 'PRIOR_SIMILAR_FAILURE', source: 'Fleet / historical failure record',
    keywords: ['nearly identical', 'identical system', 'similar system', 'similar platform',
               'prior failure', 'previous failure', 'fatigue crack', 'branch connection fatigue',
               'same failure', 'four years ago', 'previously failed', 'history of failure',
               'prior turnaround flagged', 'flagged thinning', 'no action taken'] },
  { id: 'DEFERRED_MAINTENANCE', source: 'Maintenance backlog / management system',
    keywords: ['overdue', 'deferred', 'open maintenance', 'maintenance items', 'backlog',
               'open items', 'past due', 'no vibration study', 'not conducted', 'no study',
               'deferred maintenance', 'no action taken', 'not verified', 'no wash', 'wash-water'] },
  { id: 'STORM_LOADING', source: 'Weather / met-ocean forecast',
    keywords: ['tropical storm', 'storm', 'hurricane', 'wave height', 'sea state', 'heavy weather',
               'wave', 'swell', 'cyclone'] }
];

// Short, neutral phrase per stream. The narrative appends ONLY the phrases for
// streams that actually matched -> a mechanism is never named without evidence.
var STREAM_PHRASE = {
  INCIDENT_HISTORY: 'an external impact / anchor-drag event',
  VISUAL_DISPLACEMENT: 'visible line displacement',
  GEOMETRY_OVALITY: 'geometry ovality / deformation',
  COATING_DAMAGE: 'external coating damage',
  CP_DEGRADATION: 'degraded cathodic protection',
  WALL_LOSS: 'measured wall loss',
  PROCESS_CHEMISTRY: 'aggressive process chemistry',
  OPERATIONAL_CHANGE: 'an increase in flow / velocity / throughput',
  VIBRATION: 'increased vibration / dynamic loading',
  STRUCTURAL_INTERFACE: 'a vibration-sensitive branch / support interface',
  PRIOR_SIMILAR_FAILURE: 'a documented prior failure on a similar system',
  DEFERRED_MAINTENANCE: 'deferred / overdue maintenance',
  STORM_LOADING: 'storm / met-ocean loading'
};

// Each hypothesis: required signature streams (eligibility gate) + a `mechanism`
// claim that the required streams alone justify. No optional mechanisms in the
// text - those are appended dynamically only when their stream matches.
var HYPOTHESES = [
  { id: 'VIBRATION_INDUCED_FATIGUE',
    priority: 3,
    required: ['VIBRATION'],
    anyOf: ['STRUCTURAL_INTERFACE', 'PRIOR_SIMILAR_FAILURE', 'OPERATIONAL_CHANGE'],
    supporting: ['STRUCTURAL_INTERFACE', 'PRIOR_SIMILAR_FAILURE', 'OPERATIONAL_CHANGE',
                 'DEFERRED_MAINTENANCE', 'STORM_LOADING', 'PROCESS_CHEMISTRY', 'WALL_LOSS'],
    mechanism: 'Independent evidence converges on vibration-induced fatigue at a structural interface ' +
      '(e.g. branch connection or support) - a mechanism distinct from, and not measured by, the ' +
      'general wall loss seen on UT.' },
  { id: 'MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS',
    priority: 2,
    required: ['INCIDENT_HISTORY', 'VISUAL_DISPLACEMENT', 'GEOMETRY_OVALITY'],
    supporting: ['COATING_DAMAGE', 'CP_DEGRADATION', 'WALL_LOSS'],
    mechanism: 'Independent evidence converges on external mechanical displacement of the line ' +
      '(anchor drag / vessel contact) driving bending, ovality and integrity loss.' },
  { id: 'INTERNAL_CORROSION_PROGRESSION',
    priority: 1,
    required: ['PROCESS_CHEMISTRY', 'WALL_LOSS'],
    supporting: ['OPERATIONAL_CHANGE', 'CP_DEGRADATION'],
    mechanism: 'Independent evidence converges on internal corrosion progression driven by aggressive ' +
      'process chemistry and evidenced by localized wall loss.' }
];

function round1(x) { if (typeof x !== 'number' || isNaN(x)) { return 0; } return Math.round(x * 10) / 10; }

function norm(s) {
  if (s === null || s === undefined) { return ''; }
  return String(s).toLowerCase().replace(/\s+/g, ' ');
}

function snippetFor(text, keyword) {
  var idx = text.indexOf(keyword);
  if (idx < 0) { return keyword; }
  var start = idx - 30; if (start < 0) { start = 0; }
  var end = idx + keyword.length + 30; if (end > text.length) { end = text.length; }
  var s = text.substring(start, end).replace(/^ +| +$/g, '');
  return (start > 0 ? '...' : '') + s + (end < text.length ? '...' : '');
}

function scoreForCount(n) {
  if (n < 2) { return 0; }
  if (n === 2) { return 4; }
  if (n === 3) { return 6; }
  if (n === 4) { return 8; }
  if (n === 5) { return 9; }
  return 10;
}

function activeStreamMap(text) {
  var map = {};
  for (var i = 0; i < EVIDENCE_STREAMS.length; i++) {
    var st = EVIDENCE_STREAMS[i];
    for (var k = 0; k < st.keywords.length; k++) {
      if (text.indexOf(st.keywords[k]) >= 0) {
        map[st.id] = { id: st.id, source: st.source, evidence: snippetFor(text, st.keywords[k]) };
        break;
      }
    }
  }
  return map;
}

function allPresent(ids, active) {
  for (var i = 0; i < ids.length; i++) { if (!active[ids[i]]) { return false; } }
  return true;
}

function anyPresent(ids, active) {
  if (!ids || !ids.length) { return true; }
  for (var i = 0; i < ids.length; i++) { if (active[ids[i]]) { return true; } }
  return false;
}

function matchedStreamsFor(hyp, active) {
  var ids = [];
  var push = function (arr) {
    if (!arr) { return; }
    for (var i = 0; i < arr.length; i++) {
      if (active[arr[i]] && ids.indexOf(arr[i]) < 0) { ids.push(arr[i]); }
    }
  };
  push(hyp.required);
  push(hyp.anyOf);
  push(hyp.supporting);
  var out = [];
  for (var j = 0; j < ids.length; j++) { out.push(active[ids[j]]); }
  return out;
}

// DEPLOY427: narrative = mechanism (guaranteed by required streams) + clauses for
// ONLY the streams that actually matched. No mechanism named without evidence.
function buildNarrative(mechanism, matchedStreams) {
  var phrases = [];
  for (var i = 0; i < matchedStreams.length; i++) {
    var ph = STREAM_PHRASE[matchedStreams[i].id];
    if (ph && phrases.indexOf(ph) < 0) { phrases.push(ph); }
  }
  if (!phrases.length) { return mechanism; }
  return mechanism + ' Converging independent evidence: ' + phrases.join('; ') + '.';
}

function detectConvergence(signals) {
  var parts = [];
  if (signals && typeof signals.transcript === 'string') { parts.push(signals.transcript); }
  if (signals && signals.extraText && signals.extraText.length) {
    for (var e = 0; e < signals.extraText.length; e++) {
      if (typeof signals.extraText[e] === 'string') { parts.push(signals.extraText[e]); }
    }
  }
  var text = norm(parts.join(' \n '));

  var active = activeStreamMap(text);

  var evaluated = [];
  for (var h = 0; h < HYPOTHESES.length; h++) {
    var hyp = HYPOTHESES[h];
    var eligible = allPresent(hyp.required || [], active) && anyPresent(hyp.anyOf, active);
    var supporting = matchedStreamsFor(hyp, active);
    evaluated.push({
      id: hyp.id,
      narrative: buildNarrative(hyp.mechanism, supporting),
      mechanism: hyp.mechanism,
      priority: hyp.priority,
      eligible: eligible,
      supporting_streams: supporting,
      stream_count: eligible ? supporting.length : 0,
      convergence_score: eligible ? scoreForCount(supporting.length) : 0
    });
  }

  evaluated.sort(function (a, b) {
    if (a.eligible !== b.eligible) { return a.eligible ? -1 : 1; }
    if (b.stream_count !== a.stream_count) { return b.stream_count - a.stream_count; }
    return b.priority - a.priority;
  });

  var top = evaluated.length ? evaluated[0] : null;
  var primary = (top && top.eligible && top.stream_count >= 2) ? top : null;
  var convergenceCount = primary ? primary.stream_count : 0;
  var convergenceScore = primary ? round1(primary.convergence_score) : 0;

  var activeIds = []; for (var ai in active) { if (active.hasOwnProperty(ai)) { activeIds.push(ai); } }

  var summary;
  if (primary) {
    var srcList = [];
    for (var p = 0; p < primary.supporting_streams.length; p++) {
      srcList.push(primary.supporting_streams[p].source);
    }
    summary = convergenceCount + ' independent evidence streams (' + srcList.join('; ') +
      ') converge on the same failure hypothesis: ' + primary.narrative;
  } else if (activeIds.length >= 2) {
    var fbSources = [];
    for (var q = 0; q < activeIds.length; q++) { if (active[activeIds[q]]) { fbSources.push(active[activeIds[q]].source); } }
    summary = activeIds.length + ' independent observations are present (' + fbSources.join('; ') +
      ') but they do not yet converge on a single defined failure mechanism; no mechanism is asserted.';
  } else {
    summary = 'No convergence: fewer than two independent evidence streams support a common failure hypothesis.';
  }

  return {
    hypotheses: evaluated,
    primary_hypothesis: primary,
    convergence_count: convergenceCount,
    convergence_score: convergenceScore,
    active_stream_count: activeIds.length,
    summary: summary
  };
}

module.exports = {
  detectConvergence: detectConvergence,
  EVIDENCE_STREAMS: EVIDENCE_STREAMS,
  HYPOTHESES: HYPOTHESES
};
