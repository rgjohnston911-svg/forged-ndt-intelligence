// ============================================================================
// situational-awareness-organizational.cjs   (SA layer L9.5)
// FORGED 4D NDT - Situational Awareness  -  DEPLOY383 / SA Tier 3a
//
// Organizational Failure Detection. Scans the inspection narrative for
// MANAGEMENT-SYSTEM failures -- the human/process breakdowns that precede most
// major industrial incidents (missed inspections, unreported events, lost
// observations, no root-cause investigation, ignored degradation, schedule /
// production pressure overriding engineering). These are NOT damage findings;
// they are organizational risk. The engine emits enumerated indicators and an
// Organizational Failure Score (0-10).
//
// PURE DETERMINISTIC. Enumerated keyword ruleset. No LLM, no network, no clock,
// no random. var only, string concatenation only, no template literals, no
// arrow functions.
// ============================================================================
'use strict';

// Enumerated organizational-failure patterns. Each: id, category, severity,
// and keyword phrases (matched case-insensitively against the narrative).
var ORG_PATTERNS = [
  { id: 'UNREPORTED_EVENT', category: 'REPORTING_FAILURE', severity: 'CRITICAL',
    keywords: ['no damage report', 'no report filed', 'not reported', 'never reported',
               'no incident report', 'unreported', 'failed to report'] },
  { id: 'LOST_OBSERVATION', category: 'RECORDKEEPING_FAILURE', severity: 'HIGH',
    keywords: ['never entered', 'not entered', 'not in database', 'not in the database',
               'not recorded', 'not logged', 'not escalated', 'never logged', 'not captured'] },
  { id: 'MISSED_INSPECTION', category: 'INSPECTION_PROGRAM_FAILURE', severity: 'HIGH',
    keywords: ['overdue', 'past due', 'missed inspection', 'inspection overdue', 'survey overdue',
               'behind schedule', 'not inspected', 'lapsed', 'expired inspection'] },
  { id: 'NO_ROOT_CAUSE', category: 'INVESTIGATION_FAILURE', severity: 'HIGH',
    keywords: ['no root cause', 'no rca', 'no investigation', 'not investigated',
               'no root-cause', 'root cause not'] },
  { id: 'DEGRADATION_IGNORED', category: 'TREND_NEGLECT', severity: 'HIGH',
    keywords: ['higher than predicted', 'higher than expected', 'worse than predicted',
               'anode consumption', 'degraded', 'degrading', 'degradation', 'accelerating', 'accelerated',
               'worsening', 'increasing severity', 'trend ignored'] },
  { id: 'SCHEDULE_PRESSURE_OVERRIDE', category: 'PRODUCTION_PRESSURE', severity: 'MEDIUM',
    keywords: ['cannot shut down', 'cannot happen before', 'cannot shutdown', 'shutdown cannot',
               'before hurricane', 'before season', 'keep running', 'must stay online',
               'production target', 'production pressure', 'schedule pressure',
               'production continuity', 'production schedule', 'emphasized production', 'planned utilization'] },
  { id: 'NORMALIZED_DEVIATION', category: 'COMPLACENCY', severity: 'MEDIUM',
    keywords: ['just coating', 'only coating', 'just cosmetic', 'nothing to worry',
               'probably fine', 'always been like', 'no big deal', 'just surface'] },
  // DEPLOY389: management-system failures surfaced by the SA validation corpus.
  { id: 'DEFERRED_MAINTENANCE', category: 'MAINTENANCE_DEFERRAL', severity: 'HIGH',
    keywords: ['deferred maintenance', 'maintenance backlog', 'maintenance deferred',
               'outage delayed', 'planned outage delayed', 'work order deferred', 'deferred repair',
               'repair deferred', 'deferred twice', 'replacement deferred', 'scheduled for replacement'] },
  { id: 'RECOMMENDATION_DOWNGRADED', category: 'GOVERNANCE_FAILURE', severity: 'HIGH',
    keywords: ['recommendations downgraded', 'recommendation downgraded', 'recommendations were downgraded',
               'downgraded during', 'recommendation overruled', 'overruled', 'recommendation ignored',
               'recommendation dismissed', 'recommendation rejected'] },
  { id: 'PERSONNEL_TURNOVER', category: 'COMPETENCY_RISK', severity: 'MEDIUM',
    keywords: ['turnover in experienced', 'recent turnover', 'personnel turnover', 'staff turnover',
               'loss of experienced', 'inexperienced crew', 'staffing shortage', 'lost institutional knowledge'] },
  { id: 'INCENTIVE_BIAS', category: 'DECISION_CONTAMINATION', severity: 'MEDIUM',
    keywords: ['incentives tied to production', 'incentives tied to', 'management incentives',
               'bonus tied to', 'compensation tied to', 'incentivized to'] }
];

var SEVERITY_WEIGHT = { CRITICAL: 4, HIGH: 3, MEDIUM: 1.5, LOW: 0.5 };

function round1(x) { if (typeof x !== 'number' || isNaN(x)) { return 0; } return Math.round(x * 10) / 10; }

// Normalize text for matching.
function norm(s) {
  if (s === null || s === undefined) { return ''; }
  return String(s).toLowerCase().replace(/\s+/g, ' ');
}

// Find the first matching keyword's surrounding snippet (for evidence display).
function snippetFor(text, keyword) {
  var idx = text.indexOf(keyword);
  if (idx < 0) { return keyword; }
  var start = idx - 30; if (start < 0) { start = 0; }
  var end = idx + keyword.length + 30; if (end > text.length) { end = text.length; }
  var s = text.substring(start, end).replace(/^ +| +$/g, '');
  return (start > 0 ? '...' : '') + s + (end < text.length ? '...' : '');
}

// ----------------------------------------------------------------------------
// Public: detect organizational failures in a narrative corpus.
//   signals = { transcript?: string, extraText?: string[] }
// Returns { indicators, organizational_failure_score, summary }.
// ----------------------------------------------------------------------------
function detectOrganizationalFailures(signals) {
  var parts = [];
  if (signals && typeof signals.transcript === 'string') { parts.push(signals.transcript); }
  if (signals && signals.extraText && signals.extraText.length) {
    for (var e = 0; e < signals.extraText.length; e++) {
      if (typeof signals.extraText[e] === 'string') { parts.push(signals.extraText[e]); }
    }
  }
  var text = norm(parts.join(' \n '));

  var indicators = [];
  var weightSum = 0;
  for (var i = 0; i < ORG_PATTERNS.length; i++) {
    var pat = ORG_PATTERNS[i];
    var matched = '';
    for (var k = 0; k < pat.keywords.length; k++) {
      if (text.indexOf(pat.keywords[k]) >= 0) { matched = pat.keywords[k]; break; }
    }
    if (matched) {
      indicators.push({
        id: pat.id,
        category: pat.category,
        severity: pat.severity,
        evidence: snippetFor(text, matched)
      });
      weightSum += (SEVERITY_WEIGHT[pat.severity] || 0);
    }
  }

  var score = weightSum > 10 ? 10 : round1(weightSum);

  var crit = 0, high = 0;
  for (var c = 0; c < indicators.length; c++) {
    if (indicators[c].severity === 'CRITICAL') { crit++; }
    else if (indicators[c].severity === 'HIGH') { high++; }
  }

  var summary;
  if (indicators.length === 0) {
    summary = 'No organizational/management-system failure indicators detected in the narrative.';
  } else {
    summary = indicators.length + ' organizational risk indicator(s) detected (' + crit +
      ' critical, ' + high + ' high). These are process/management-system failures, not damage findings.';
  }

  return {
    indicators: indicators,
    organizational_failure_score: score,
    summary: summary
  };
}

module.exports = {
  detectOrganizationalFailures: detectOrganizationalFailures,
  ORG_PATTERNS: ORG_PATTERNS
};
