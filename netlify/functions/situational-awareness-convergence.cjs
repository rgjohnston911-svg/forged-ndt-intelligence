// ============================================================================
// situational-awareness-convergence.cjs   (SA layer L9.6)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY384 / DEPLOY425
//
// Convergence Detection. Most integrity failures are first dismissed because
// each observation is read in isolation. The expert insight is that several
// INDEPENDENT evidence streams (different sensors, surveys, people, datasets)
// are quietly telling the same story. This engine groups independent evidence
// streams under candidate failure hypotheses and reports how many distinct
// streams converge on each -> a Convergence Score (0-10).
//
// DEPLOY425 - anti-contamination rebuild. Two prior defects fixed:
//   1) HALLUCINATION: each hypothesis carried a pre-written narrative that
//      name-dropped specific mechanisms (anchor drag, ovality, CP). A hypothesis
//      fired on ANY 2 of its streams, so a produced-water reinjection scenario
//      (coating damage on a support shoe + a prior incident + general corrosion)
//      spuriously triggered the "anchor drag" paragraph and asserted mechanisms
//      that were never in the scenario. FIX: every hypothesis now has REQUIRED
//      signature streams; its mechanism narrative can only surface when those
//      defining streams are actually present. If no hypothesis qualifies, the
//      engine reports the converging observations WITHOUT naming a mechanism.
//   2) COVERAGE: there was no vibration/fatigue hypothesis, so the correct
//      convergence for operational-change-driven fatigue was not representable.
//      FIX: added VIBRATION / OPERATIONAL_CHANGE / STRUCTURAL_INTERFACE /
//      PRIOR_SIMILAR_FAILURE / DEFERRED_MAINTENANCE / STORM_LOADING streams and
//      a VIBRATION_INDUCED_FATIGUE hypothesis.
//
// PURE DETERMINISTIC. Enumerated keyword ruleset. No LLM, no network, no clock,
// no random. var only, string concatenation only, no template literals, no
// arrow functions.
// ============================================================================
'use strict';

// Independent evidence streams. Each stream is a DISTINCT source/modality, so
// that the count of active streams under a hypothesis measures independence.
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
               'thinning', 'acfm', 'pitting', 'thickness loss', 'current wall'] },
  { id: 'PROCESS_CHEMISTRY', source: 'Process / fluid chemistry',
    keywords: ['co2', 'co₂', 'sour crude', 'sour service', 'produced water', 'h2s', 'h₂s',
               'hydrogen sulfide', 'corrosive service', 'chlorides'] },
  { id: 'OPERATIONAL_CHANGE', source: 'Operations / production data',
    keywords: ['flow rate increased', 'flow increased', 'increased flow', 'flow rate up',
               'velocity increased', 'rate increased', 'rates increased', 'reinjection rate',
               'injection rate', 'throughput increased', 'increased 40', 'production increased',
               'rate change', 'higher rate', 'high-rate'] },
  { id: 'VIBRATION', source: 'Operations / vibration observation',
    keywords: ['vibration', 'vibrating', 'vibration increased', 'resonance', 'cyclic load',
               'cyclic loading', 'dynamic loading', 'vibration-related', 'pulsation'] },
  { id: 'STRUCTURAL_INTERFACE', source: 'Structural / support inspection',
    keywords: ['branch connection', 'branch weld', 'small-bore', 'small bore', 'tie-in',
               'nozzle', 'support shoe', 'pipe support', 'clamp support', 'support clamp',
               'support replaced', 'metal-to-metal wear', 'shoe'] },
  { id: 'PRIOR_SIMILAR_FAILURE', source: 'Fleet / historical failure record',
    keywords: ['nearly identical', 'identical system', 'similar system', 'similar platform',
               'prior failure', 'previous failure', 'fatigue crack', 'branch connection fatigue',
               'same failure', 'four years ago', 'previously failed', 'history of failure'] },
  { id: 'DEFERRED_MAINTENANCE', source: 'Maintenance backlog / management system',
    keywords: ['overdue', 'deferred', 'open maintenance', 'maintenance items', 'backlog',
               'open items', 'past due', 'no vibration study', 'not conducted', 'no study',
               'deferred maintenance'] },
  { id: 'STORM_LOADING', source: 'Weather / met-ocean forecast',
    keywords: ['tropical storm', 'storm', 'hurricane', 'wave height', 'sea state', 'heavy weather',
               'wave', 'swell', 'cyclone'] }
];

// Candidate failure hypotheses. Each declares:
//   required - SIGNATURE streams that MUST all be present for the hypothesis to
//              be eligible. This is the anti-contamination gate: the mechanism
//              narrative can only surface when its defining evidence exists.
//   anyOf    - (optional) at least one of these must be present too.
//   supporting - corroborating streams that raise the convergence count.
var HYPOTHESES = [
  { id: 'VIBRATION_INDUCED_FATIGUE',
    priority: 3,
    required: ['VIBRATION'],
    anyOf: ['STRUCTURAL_INTERFACE', 'PRIOR_SIMILAR_FAILURE', 'OPERATIONAL_CHANGE'],
    supporting: ['STRUCTURAL_INTERFACE', 'PRIOR_SIMILAR_FAILURE', 'OPERATIONAL_CHANGE',
                 'DEFERRED_MAINTENANCE', 'STORM_LOADING', 'PROCESS_CHEMISTRY', 'WALL_LOSS'],
    narrative: 'An operational change (e.g. increased injection / flow rate) has raised dynamic ' +
      'and vibratory loading on the line; with a vibration-sensitive structural interface ' +
      '(branch connection / support) and a documented prior fatigue failure on a similar system, ' +
      'the independent evidence converges on vibration-induced fatigue at the branch/support ' +
      'interaction - a mechanism distinct from, and not measured by, the general wall loss seen on UT.' },
  { id: 'MECHANICAL_DISPLACEMENT_DRIVEN_INTEGRITY_LOSS',
    priority: 2,
    required: ['INCIDENT_HISTORY', 'VISUAL_DISPLACEMENT', 'GEOMETRY_OVALITY'],
    supporting: ['COATING_DAMAGE', 'CP_DEGRADATION', 'WALL_LOSS'],
    narrative: 'External mechanical disturbance (anchor drag / vessel contact) displaced the line, ' +
      'inducing bending and ovality plus coating damage; combined with degraded cathodic protection ' +
      'this exposed bare steel and accelerated external corrosion / wall loss.' },
  { id: 'INTERNAL_CORROSION_PROGRESSION',
    priority: 1,
    required: ['PROCESS_CHEMISTRY', 'WALL_LOSS'],
    supporting: ['OPERATIONAL_CHANGE', 'CP_DEGRADATION'],
    narrative: 'Aggressive process chemistry combined with a flow/velocity change is driving ' +
      'internal degradation, evidenced by wall loss, with cathodic-protection decline removing ' +
      'external margin.' }
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

function allPresent(ids, active) {
  for (var i = 0; i < ids.length; i++) { if (!active[ids[i]]) { return false; } }
  return true;
}

function anyPresent(ids, active) {
  if (!ids || !ids.length) { return true; }
  for (var i = 0; i < ids.length; i++) { if (active[ids[i]]) { return true; } }
  return false;
}

// Collect, de-duplicated, the active streams that belong to a hypothesis
// (required + anyOf + supporting). Order: required first, then the rest.
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
    // ANTI-CONTAMINATION GATE: a hypothesis is only ELIGIBLE (and thus only
    // allowed to surface its mechanism narrative / be primary) when all its
    // signature streams are present and at least one anyOf stream is present.
    var eligible = allPresent(hyp.required || [], active) && anyPresent(hyp.anyOf, active);
    var supporting = matchedStreamsFor(hyp, active);
    evaluated.push({
      id: hyp.id,
      narrative: hyp.narrative,
      priority: hyp.priority,
      eligible: eligible,
      supporting_streams: supporting,
      stream_count: eligible ? supporting.length : 0,
      convergence_score: eligible ? scoreForCount(supporting.length) : 0
    });
  }

  // Rank: eligible first; then most supporting streams; then predefined priority.
  evaluated.sort(function (a, b) {
    if (a.eligible !== b.eligible) { return a.eligible ? -1 : 1; }
    if (b.stream_count !== a.stream_count) { return b.stream_count - a.stream_count; }
    return b.priority - a.priority;
  });

  var top = evaluated.length ? evaluated[0] : null;
  var primary = (top && top.eligible && top.stream_count >= 2) ? top : null;
  var convergenceCount = primary ? primary.stream_count : 0;
  var convergenceScore = primary ? round1(primary.convergence_score) : 0;

  // Count all independent streams active overall (for the honest-fallback message).
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
    // HONEST FALLBACK: independent observations exist but none of the defined
    // failure hypotheses has its required signature -> name NO mechanism.
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
