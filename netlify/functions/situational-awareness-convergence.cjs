// ============================================================================
// situational-awareness-convergence.cjs   (SA layer L9.6)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY384 / SA Tier 3b
//
// Convergence Detection. Most integrity failures are first dismissed because
// each observation is read in isolation. The expert insight is that several
// INDEPENDENT evidence streams (different sensors, surveys, people, datasets)
// are quietly telling the same story. This engine groups independent evidence
// streams under candidate failure hypotheses and reports how many distinct
// streams converge on each -- e.g. "five independent evidence streams support
// the same failure hypothesis" -> a Convergence Score (0-10).
//
// PURE DETERMINISTIC. Enumerated keyword ruleset. No LLM, no network, no clock,
// no random. var only, string concatenation only, no template literals, no
// arrow functions.
// ============================================================================
'use strict';

// Independent evidence streams. Each stream is a DISTINCT source/modality, so
// that the count of active streams under a hypothesis measures independence.
//   id     - stable identifier
//   source - the channel/modality the stream comes from (independence basis)
//   keywords - case-insensitive phrases matched against the narrative
var EVIDENCE_STREAMS = [
  { id: 'INCIDENT_HISTORY', source: 'Operations / incident log',
    keywords: ['anchor drag', 'anchor-drag', 'dragged anchor', 'lost position', 'vessel lost',
               'supply vessel', 'storm', 'allision', 'impact event'] },
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
               'thinning', 'acfm', 'pitting', 'thickness loss'] },
  { id: 'PROCESS_CHEMISTRY', source: 'Process / fluid chemistry',
    keywords: ['co2', 'co₂', 'sour crude', 'sour service', 'produced water', 'h2s', 'h₂s',
               'hydrogen sulfide', 'corrosive service'] },
  { id: 'FLOW_CHANGE', source: 'Operations flow data',
    keywords: ['flow rate increased', 'flow increased', 'increased flow', 'flow rate up',
               'velocity increased', 'rate increased'] }
];

// Candidate failure hypotheses. Each links the independent streams that, when
// co-present, support that explanation. A hypothesis with many active streams
// is a strongly converged narrative.
var HYPOTHESES = [
  { id: 'MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS',
    priority: 2,
    narrative: 'External mechanical disturbance (anchor drag / vessel contact) displaced the line, ' +
      'inducing bending and ovality plus coating damage; combined with degraded cathodic protection ' +
      'this exposed bare steel and accelerated external corrosion / wall loss.',
    streams: ['INCIDENT_HISTORY', 'VISUAL_DISPLACEMENT', 'GEOMETRY_OVALITY', 'COATING_DAMAGE',
              'CP_DEGRADATION', 'WALL_LOSS'] },
  { id: 'INTERNAL_CORROSION_PROGRESSION',
    priority: 1,
    narrative: 'Aggressive process chemistry combined with a flow/velocity change is driving ' +
      'internal degradation, evidenced by wall loss, with cathodic-protection decline removing ' +
      'external margin.',
    streams: ['PROCESS_CHEMISTRY', 'FLOW_CHANGE', 'WALL_LOSS', 'CP_DEGRADATION'] }
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

// Convergence score from the count of independent supporting streams. A single
// stream is not convergence; the value rises as independent sources agree.
function scoreForCount(n) {
  if (n < 2) { return 0; }
  if (n === 2) { return 4; }
  if (n === 3) { return 6; }
  if (n === 4) { return 8; }
  if (n === 5) { return 9; }
  return 10;
}

// Which streams are active in the corpus -> map id -> matched evidence snippet.
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

// ----------------------------------------------------------------------------
// Public: detect convergence of independent evidence streams.
//   signals = { transcript?: string, extraText?: string[] }
// Returns { hypotheses, primary_hypothesis, convergence_count,
//           convergence_score, summary }.
// ----------------------------------------------------------------------------
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
    var supporting = [];
    for (var s = 0; s < hyp.streams.length; s++) {
      var sid = hyp.streams[s];
      if (active[sid]) { supporting.push(active[sid]); }
    }
    evaluated.push({
      id: hyp.id,
      narrative: hyp.narrative,
      priority: hyp.priority,
      supporting_streams: supporting,
      stream_count: supporting.length,
      convergence_score: scoreForCount(supporting.length)
    });
  }

  // Rank: most supporting streams wins; tie-break on predefined priority.
  evaluated.sort(function (a, b) {
    if (b.stream_count !== a.stream_count) { return b.stream_count - a.stream_count; }
    return b.priority - a.priority;
  });

  var primary = evaluated.length ? evaluated[0] : null;
  var convergenceCount = primary ? primary.stream_count : 0;
  var convergenceScore = primary ? round1(primary.convergence_score) : 0;

  var summary;
  if (!primary || convergenceCount < 2) {
    summary = 'No convergence: fewer than two independent evidence streams support a common failure hypothesis.';
  } else {
    var srcList = [];
    for (var p = 0; p < primary.supporting_streams.length; p++) {
      srcList.push(primary.supporting_streams[p].source);
    }
    summary = convergenceCount + ' independent evidence streams (' + srcList.join('; ') +
      ') converge on the same failure hypothesis: ' + primary.narrative;
  }

  return {
    hypotheses: evaluated,
    primary_hypothesis: primary,
    convergence_count: convergenceCount,
    convergence_score: convergenceScore,
    summary: summary
  };
}

module.exports = {
  detectConvergence: detectConvergence,
  EVIDENCE_STREAMS: EVIDENCE_STREAMS,
  HYPOTHESES: HYPOTHESES
};
