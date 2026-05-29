// ============================================================================
// situational-awareness-gate.cjs   (SA layer L9.0 substrate)
// FORGED 4D NDT - Situational Awareness
//
// PURE DETERMINISTIC MODULE.
//   - No callers at Stage 1.
//   - No LLM. No network. No filesystem. No Date.now() / Math.random().
//   - var only. String concatenation only. module.exports.
//
// Purpose: validate every candidate EvidenceEntry before it may enter the
// working evidence set. Enforces (structurally):
//   * provenance non-increase            (patent 1(iv))
//   * LLM-source-with-strong-provenance rejection (patent 1(ix))
//   * Non-Evidence Token Registry filtering
//   * speculation-on-CRITICAL rejection
//   * staleness windows (via caller-supplied referenceMs)
//   * duplicate collapse (deterministic, strongest-wins)
//
// The gate keys off the TYPED answerSource, never off whether an LLM touched
// the bytes. An LLM that merely parses inspector free-text into a typed value
// is a TOOL: set answerSource = "INSPECTOR_FIELD" and note extractionTool.
// ============================================================================
'use strict';

// Closed registry of answer values that are never evidence (normalized).
var NON_EVIDENCE_TOKENS = [
  "", "unknown", "n/a", "na", "none", "not sure", "notsure",
  "dont know", "do not know", "tbd", "to be determined",
  "maybe", "possibly", "idk", "unsure", "no idea", "not applicable"
];

// answerSource -> the strongest provenance that source is permitted to assert.
var SOURCE_MAX_PROVENANCE = {
  INSTRUMENT:          "MEASURED",
  INSPECTOR_FIELD:     "OBSERVED",
  DOCUMENT:            "DOCUMENTED",
  REGISTRY:            "DOCUMENTED",
  LLM_INFERENCE:       "INFERRED",
  STAKEHOLDER_OPINION: "REPORTED",
  ASSUMPTION:          "ASSUMED"
};

// Provenance strength ranking (higher = stronger).
var PROVENANCE_RANK = {
  MEASURED: 5, OBSERVED: 4, DOCUMENTED: 4,
  INFERRED: 2, REPORTED: 2, ASSUMED: 1, UNKNOWN: 0
};

// Provenance levels strong enough to RESOLVE a CRITICAL question.
var STRONG_PROVENANCE = { MEASURED: true, OBSERVED: true, DOCUMENTED: true };

// Staleness windows in ms, by question decision impact.
var STALENESS_MS = {
  CRITICAL: 1000 * 60 * 60 * 24 * 7,
  HIGH:     1000 * 60 * 60 * 24 * 30,
  MEDIUM:   1000 * 60 * 60 * 24 * 90,
  LOW:      1000 * 60 * 60 * 24 * 365
};

function normalizeToken(value) {
  if (value === null || value === undefined) { return ""; }
  var s = String(value).toLowerCase();
  s = s.replace(/[^a-z0-9 ]/g, "");
  s = s.replace(/\s+/g, " ");
  return s.replace(/^ +| +$/g, "");
}

function isNonEvidenceToken(value) {
  var norm = normalizeToken(value);
  for (var i = 0; i < NON_EVIDENCE_TOKENS.length; i++) {
    if (NON_EVIDENCE_TOKENS[i] === norm) { return true; }
  }
  return false;
}

function rankOf(provenance) {
  var r = PROVENANCE_RANK[provenance];
  return (typeof r === "number") ? r : -1;
}

// Validate a single candidate entry. Returns { ok, reason }.
function validateEntry(entry, referenceMs) {
  if (!entry || typeof entry !== "object") {
    return { ok: false, reason: "MALFORMED_ENTRY" };
  }
  if (!entry.questionId || !entry.answerSource ||
      !entry.answerProvenance || !entry.questionDecisionImpact) {
    return { ok: false, reason: "MISSING_REQUIRED_FIELD" };
  }
  if (isNonEvidenceToken(entry.answerValue)) {
    return { ok: false, reason: "NON_EVIDENCE_TOKEN" };
  }

  var maxProv = SOURCE_MAX_PROVENANCE[entry.answerSource];
  if (!maxProv) {
    return { ok: false, reason: "UNKNOWN_SOURCE" };
  }
  if (rankOf(entry.answerProvenance) < 0) {
    return { ok: false, reason: "UNKNOWN_PROVENANCE" };
  }

  // Provenance non-increase: asserted strength may not exceed the source ceiling.
  // (This is what rejects LLM_INFERENCE claiming OBSERVED/MEASURED/DOCUMENTED.)
  if (rankOf(entry.answerProvenance) > rankOf(maxProv)) {
    return { ok: false, reason: "PROVENANCE_INFLATION" };
  }

  // Staleness (only when a timestamp and reference time are both present).
  if (entry.observedAtIso && typeof referenceMs === "number") {
    var t = new Date(entry.observedAtIso).getTime();
    if (isNaN(t)) {
      return { ok: false, reason: "BAD_TIMESTAMP" };
    }
    var window = STALENESS_MS[entry.questionDecisionImpact];
    if (typeof window === "number" && (referenceMs - t) > window) {
      return { ok: false, reason: "STALE_EVIDENCE" };
    }
  }

  return { ok: true, reason: null };
}

// Validate a set of candidates against the required questions.
//   candidates       : array of EvidenceEntry
//   requiredQuestions: array of { questionId, decisionImpact }
//   referenceMs      : caller-supplied epoch ms (NEVER read the clock here)
// Returns a ValidatedEvidenceSet.
function validateSet(candidates, requiredQuestions, referenceMs) {
  var validatedByQuestion = {};   // questionId -> { entry, index }
  var validated = [];
  var rejected = [];
  var list = (candidates && candidates.length) ? candidates : [];

  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    var result = validateEntry(entry, referenceMs);
    if (!result.ok) {
      rejected.push({ entry: entry, reason: result.reason });
      continue;
    }
    var qid = entry.questionId;
    var existing = validatedByQuestion[qid];
    if (!existing) {
      validatedByQuestion[qid] = { entry: entry, index: i };
    } else {
      // Duplicate collapse: strongest provenance wins; tie -> earliest index.
      var keepNew = false;
      if (rankOf(entry.answerProvenance) > rankOf(existing.entry.answerProvenance)) {
        keepNew = true;
      }
      if (keepNew) {
        rejected.push({ entry: existing.entry, reason: "DUPLICATE_COLLAPSED" });
        validatedByQuestion[qid] = { entry: entry, index: i };
      } else {
        rejected.push({ entry: entry, reason: "DUPLICATE_COLLAPSED" });
      }
    }
  }

  // Flatten kept entries in original submission order for determinism.
  var keptIndexed = [];
  for (var key in validatedByQuestion) {
    if (validatedByQuestion.hasOwnProperty(key)) {
      keptIndexed.push(validatedByQuestion[key]);
    }
  }
  keptIndexed.sort(function (a, b) { return a.index - b.index; });
  for (var k = 0; k < keptIndexed.length; k++) {
    validated.push(keptIndexed[k].entry);
  }

  // Resolution check. A required question is unresolved if it has no kept
  // entry, or it is CRITICAL and its kept entry is not strong provenance
  // (speculation-on-CRITICAL does not resolve it).
  var unresolvedQuestions = [];
  var required = (requiredQuestions && requiredQuestions.length) ? requiredQuestions : [];
  var criticalUnresolved = 0;
  for (var q = 0; q < required.length; q++) {
    var rq = required[q];
    var kept = validatedByQuestion[rq.questionId];
    var resolved = false;
    if (kept) {
      if (rq.decisionImpact === "CRITICAL") {
        resolved = STRONG_PROVENANCE[kept.entry.answerProvenance] === true;
      } else {
        resolved = true;
      }
    }
    if (!resolved) {
      unresolvedQuestions.push(rq.questionId);
      if (rq.decisionImpact === "CRITICAL") { criticalUnresolved++; }
    }
  }

  return {
    validated: validated,
    rejected: rejected,
    unresolvedQuestions: unresolvedQuestions,
    stats: {
      submitted: list.length,
      validated: validated.length,
      rejected: rejected.length,
      criticalUnresolved: criticalUnresolved
    }
  };
}

module.exports = {
  validateEntry: validateEntry,
  validateSet: validateSet,
  // exported for unit tests:
  isNonEvidenceToken: isNonEvidenceToken,
  normalizeToken: normalizeToken,
  SOURCE_MAX_PROVENANCE: SOURCE_MAX_PROVENANCE,
  PROVENANCE_RANK: PROVENANCE_RANK
};
