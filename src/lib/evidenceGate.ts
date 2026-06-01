// ============================================================================
// evidenceGate.ts - PHASE 6: a physical damage mechanism may be called ACTIVE /
// CONFIRMED_DAMAGE only with DIRECT evidence. Indirect indicators support at most
// SUSPECTED. Consequence, missing records, high-risk class, failures elsewhere, a
// repaired/past finding, or a keyword match are NEVER sufficient for ACTIVE.
//
// Pure module. Used to gate / re-rank mechanism calls so the Tier-2 keyword
// guesser (FMD) can never promote an unevidenced mechanism over an evidenced one,
// and so a non-finding / negation / repair can never read as active damage.
// ============================================================================

export type EvidenceLevel = "CONFIRMED" | "SUSPECTED" | "NONE";

export interface MechanismEvidence {
  mechanism: string;
  family: string;            // cracking | corrosion | structural | fatigue | other
  level: EvidenceLevel;
  evidence: string[];        // matched direct/indirect phrases
  reason: string;
}

// ---- family mapping ----
function familyOf(mech: string): string {
  var m = String(mech || "").toLowerCase();
  if (/(?:hic|sohic|ssc|scc|crack)/.test(m)) { return "cracking"; }
  if (/(?:corros|wall[_ ]?loss|metal[_ ]?loss|pitting|thinning|erosion|\bmic\b|\bcui\b)/.test(m)) { return "corrosion"; }
  if (/(?:structural|settlement|buckl|deformation|instab|tilt)/.test(m)) { return "structural"; }
  if (/(?:fatigue|vibration|cyclic)/.test(m)) { return "fatigue"; }
  return "other";
}

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
function blocked(transcript: string): boolean {
  for (var i = 0; i < BLOCKERS.length; i++) { if (BLOCKERS[i].test(transcript)) { return true; } }
  return false;
}

// ---- DIRECT evidence per family (sufficient for CONFIRMED if not blocked) ----
var DIRECT: { [k: string]: RegExp[] } = {
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
var INDIRECT: { [k: string]: RegExp[] } = {
  cracking: [ /\bwet\s+h2?s\b/i, /\bsour\s+service\b/i, /\bcaustic\b/i, /\bppm\s+h2?s\b/i ],
  corrosion: [ /\bsour\b/i, /\bh2?s\b/i, /\bco2\b/i, /\bchloride/i, /\bsulfidation/i, /\bdew\s*point/i, /\bunder\s+insulation/i ],
  structural: [ /\bsettlement\b/i, /\bsubsidence\b/i, /\bsoft\s+foundation/i, /\bscour\b/i ],
  fatigue: [ /\bvibration/i, /\bslug(?:ging)?/i, /\btransient\s+pressure/i, /\bunsupported\s+span/i, /\bcyclic/i, /\bresonance/i, /\bthroughput\s+(?:increase|increased|change)/i, /\bpressure\s+excursion/i, /\breciprocating\b/i, /\bfatigue\b/i ]
};

// ---- signals that are NEVER sufficient for ACTIVE (recorded, never promote) ----
var INSUFFICIENT = [
  /\bsimilar[^.]{0,40}(?:at\s+another|elsewhere|other\s+(?:company|facility|unit|plant))/i,
  /\bfailures?\s+elsewhere\b/i,
  /\brecords?\s+(?:lost|cannot\s+be\s+located|destroyed|missing|unavailable)/i,
  /\bcatastrophic\b/i,
  /\bpassed\s+inspection\b/i,
  /\bhigh[- ]consequence\b/i
];
export function hasInsufficientOnlySignals(transcript: string): boolean {
  for (var i = 0; i < INSUFFICIENT.length; i++) { if (INSUFFICIENT[i].test(transcript)) { return true; } }
  return false;
}

function matchAny(res: RegExp[], t: string): string[] {
  var out: string[] = [];
  if (!res) { return out; }
  for (var i = 0; i < res.length; i++) { var m = t.match(res[i]); if (m) { out.push(m[0]); } }
  return out;
}

export function classifyMechanismEvidence(mechanism: string, transcript: string): MechanismEvidence {
  var t = String(transcript || "");
  var fam = familyOf(mechanism);
  var directHits = (fam === "fatigue") ? [] : matchAny(DIRECT[fam], t); // fatigue is inherently inferential -> SUSPECTED at most
  var indirectHits = matchAny(INDIRECT[fam], t);
  var isBlocked = blocked(t);

  if (directHits.length > 0 && !isBlocked) {
    return { mechanism: mechanism, family: fam, level: "CONFIRMED", evidence: directHits, reason: "direct evidence present" };
  }
  if (indirectHits.length > 0) {
    var why = isBlocked
      ? "direct findings are within limits / repaired / negated; only indirect (service/condition) indicators remain -> SUSPECTED, not ACTIVE"
      : "indirect indicators only -> SUSPECTED";
    return { mechanism: mechanism, family: fam, level: "SUSPECTED", evidence: indirectHits, reason: why };
  }
  return { mechanism: mechanism, family: fam, level: "NONE", evidence: [], reason: "no direct or indirect evidence in the account" };
}

// ---- re-rank a list of candidate mechanisms by evidence level (stable) ----
// Promotes evidenced mechanisms above unevidenced ones WITHOUT inventing or
// dropping. A CONFIRMED mechanism leads; SUSPECTED next; NONE last (original order
// preserved within a level). This is how an unevidenced HIC drops below an
// evidenced fatigue convergence - the FMD weights are NOT touched.
var RANK: { [k: string]: number } = { "CONFIRMED": 0, "SUSPECTED": 1, "NONE": 2 };

export interface GatedMechanisms {
  ordered: string[];
  detail: MechanismEvidence[];
  leader: string | null;
  leaderLevel: EvidenceLevel | null;
}

export function gateSuspectedMechanisms(mechanisms: string[], transcript: string): GatedMechanisms {
  var list = (mechanisms || []).slice();
  var detail: MechanismEvidence[] = [];
  for (var i = 0; i < list.length; i++) { detail.push(classifyMechanismEvidence(list[i], transcript)); }
  // stable sort by rank
  var indexed = detail.map(function (d, idx) { return { d: d, idx: idx }; });
  indexed.sort(function (a, b) {
    var ra = RANK[a.d.level], rb = RANK[b.d.level];
    if (ra !== rb) { return ra - rb; }
    return a.idx - b.idx;
  });
  var ordered = indexed.map(function (x) { return x.d.mechanism; });
  var orderedDetail = indexed.map(function (x) { return x.d; });
  return {
    ordered: ordered,
    detail: orderedDetail,
    leader: ordered.length ? ordered[0] : null,
    leaderLevel: orderedDetail.length ? orderedDetail[0].level : null
  };
}
