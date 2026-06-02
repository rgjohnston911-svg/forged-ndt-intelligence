'use strict';
// ============================================================================
// _mechanism-evidence.js  -  DEPLOY457 (Governance Contest CP3, commit 1)
// THE SINGLE MECHANISM-EVIDENCE VERDICT (server-side, transcript-only).
//
// "What does the account contain DIRECT, non-negated evidence of?" Produced once,
// consumed read-only by the satellites (Authority Lock, FMD paths, disposition,
// consequence) so none of them re-derives mechanisms. Pure JS (var/concat/module.exports),
// no TypeScript, no template literals - it is required by the netlify/functions server
// engines.
//
// Logic is PORTED FROM src/lib/evidenceGate.ts (the client/reconcile source). A cross-check
// gate (tests/mechanism-evidence-parity.test.cjs) asserts the JS verdict and the TS
// classifier agree on the golden transcripts, so the server (satellites) and client
// (reconcile physical bid) can never disagree - the single-source guard across the TS/JS
// boundary required by the build directive (S2.4).
// ============================================================================

// ---- phrases that BLOCK an active reading (non-finding / negation / repair / past) ----
var BLOCKERS = [
  /\bno\s+(?:significant\s+|active\s+|apparent\s+)?(?:wall\s*loss|metal\s*loss|crack|cracking|corrosion|indication|leak|deformation|settlement)/i,
  /\bwithin\s+(?:design\s+)?(?:limits?|allowable|tolerance)/i,
  /\bbelow\s+(?:the\s+)?(?:concern|allowable|threshold)/i,
  /\bre-?welded\b/i,
  /\b(?:previously\s+)?repaired\b/i,
  /\bacceptable\b/i,
  /\bno\s+structural\s+concern\b/i
];

// ---- DIRECT evidence per family (sufficient for CONFIRMED if not blocked) ----
var DIRECT = {
  cracking: [
    /\b(?:ut|paut|tofd|mt|mpi|pt|rt|ae)\b[^.]{0,40}(?:crack|indication|flaw|linear)/i,
    /\bcrack(?:ing)?\s+(?:indication|detected|confirmed|observed|found|located)/i,
    /\bthrough[- ]wall\s+crack/i,
    /\bactive\s+crack\s+growth\b/i,
    /\bfracture\s+(?:observed|confirmed|found)/i
  ],
  corrosion: [
    /\bmeasured\s+wall\s*loss/i,
    /\b\d+(?:\.\d+)?\s*%\s*(?:wall\s*|metal\s*)?loss/i,
    /\bwall\s*loss\s+of\s+\d/i,
    /\bremaining\s+wall\s+\d/i,
    /\bpit(?:ting)?\s+depth\s+\d/i,
    /\bcorrosion\s+(?:product|scale|confirmed|observed|measured)/i,
    /\bcoating\s+failure\s+exposing/i,
    /\bmeasured\s+(?:corrosion\s+)?rate/i
  ],
  structural: [
    /\bsettlement[^.]{0,40}(?:exceed|beyond|above)\s+(?:the\s+)?allowable/i,
    /\bdifferential\s+settlement/i,
    /\bbuckl(?:ed|ing)\b/i,
    /\bfailed\s+support\b/i,
    /\byielded\b/i,
    /\bprogressive\s+(?:movement|tilt|distortion)/i,
    /\bmeasured\s+(?:deformation|tilt|distortion)/i,
    /\bcollapse/i
  ]
};

// ---- INDIRECT indicators per family (support SUSPECTED only) ----
var INDIRECT = {
  cracking: [/\bwet\s+h2?s\b/i, /\bsour\s+service\b/i, /\bcaustic\b/i, /\bppm\s+h2?s\b/i],
  corrosion: [/\bsour\b/i, /\bh2?s\b/i, /\bco2\b/i, /\bchloride/i, /\bsulfidation/i, /\bdew\s*point/i, /\bunder\s+insulation/i],
  structural: [/\bsettlement\b/i, /\bsubsidence\b/i, /\bsoft\s+foundation/i, /\bscour\b/i],
  fatigue: [/\bvibration/i, /\bslug(?:ging)?/i, /\btransient\s+pressure/i, /\bunsupported\s+span/i, /\bcyclic/i, /\bresonance/i, /\bthroughput\s+(?:increase|increased|change)/i, /\bpressure\s+excursion/i, /\breciprocating\b/i, /\bfatigue\b/i]
};

// ---- SOUR / H2S evidence (NACE MR0175 gate). Hydrogen-rich gas is NOT sour service:
// NACE locks on H2S, never on the presence of hydrogen. These match H2S only. ----
var SOUR = [/\bwet\s+h2s\b/i, /\bsour\s+service\b/i, /\bsour\s+gas\b/i, /\bppm\s+h2s\b/i, /\bh2s\b/i, /\bhydrogen\s+sulfide\b/i];

// Clause-aware SOUR/H2S detection: H2S named in a NON-negated clause. "No H2S present" must
// NOT read as sour service (the same negation discipline the rest of the gate uses).
function sourPresent(t) {
  var sents = String(t || "").split(/\.\s+|[;\n]+/);
  for (var i = 0; i < sents.length; i++) {
    var sent = sents[i];
    for (var j = 0; j < SOUR.length; j++) {
      var m = sent.match(SOUR[j]);
      if (!m) { continue; }
      // negation must be LOCAL to the H2S mention - check only the comma-clause it sits in, so
      // "no crack indications" elsewhere in the same sentence does not negate a real H2S mention.
      var before = sent.slice(0, m.index);
      var lastComma = before.lastIndexOf(",");
      var clause = (lastComma >= 0) ? before.slice(lastComma + 1) : before;
      if (/\b(?:no|not|without|absent|none|free\s+of|non[- ]sour)\b/i.test(clause)) { continue; }
      return true;
    }
  }
  return false;
}

function blocked(t) {
  for (var i = 0; i < BLOCKERS.length; i++) { if (BLOCKERS[i].test(t)) { return true; } }
  return false;
}
function matchAny(res, t) {
  var out = [];
  if (!res) { return out; }
  for (var i = 0; i < res.length; i++) { var m = t.match(res[i]); if (m) { out.push(m[0]); } }
  return out;
}

// Per-family classification (mirrors evidenceGate.classifyMechanismEvidence). fatigue is
// inherently inferential -> SUSPECTED at most (no DIRECT family).
function classifyFamily(fam, transcript) {
  var t = String(transcript || "");
  var directHits = (fam === "fatigue") ? [] : matchAny(DIRECT[fam], t);
  var indirectHits = matchAny(INDIRECT[fam], t);
  var isBlocked = blocked(t);
  if (directHits.length > 0 && !isBlocked) {
    return { level: "CONFIRMED", evidence: directHits };
  }
  if (indirectHits.length > 0) {
    return { level: "SUSPECTED", evidence: indirectHits };
  }
  return { level: "NONE", evidence: [] };
}

// THE VERDICT. confirmed = a family with DIRECT non-negated evidence (or "NONE").
// candidates = families with only indirect (service/condition) indicators -> SUSPECTED.
// sour_service = H2S evidence present (NACE gate) - distinct from hydrogen presence.
function buildMechanismVerdict(transcript) {
  var t = String(transcript || "");
  var fams = ["corrosion", "cracking", "structural"];
  var confirmed = "NONE";
  var confirmedTier = "NONE";
  var confirmedBasis = "";
  var candidates = [];
  for (var i = 0; i < fams.length; i++) {
    var fam = fams[i];
    var c = classifyFamily(fam, t);
    if (c.level === "CONFIRMED") {
      if (confirmed === "NONE") {
        confirmed = fam; confirmedTier = "DIRECT_MEASURED"; confirmedBasis = c.evidence.join("; ");
      } else {
        candidates.push({ name: fam, state: "SUSPECTED", basis: c.evidence.join("; ") });
      }
    } else if (c.level === "SUSPECTED") {
      candidates.push({ name: fam, state: "SUSPECTED", basis: c.evidence.join("; ") });
    }
  }
  return {
    confirmed: confirmed,
    confirmed_tier: confirmedTier,
    confirmed_basis: confirmedBasis,
    candidates: candidates,
    sour_service: sourPresent(t)
  };
}

module.exports = { buildMechanismVerdict: buildMechanismVerdict, classifyFamily: classifyFamily };
