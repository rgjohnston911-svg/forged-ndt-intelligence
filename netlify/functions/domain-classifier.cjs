// ============================================================================
// domain-classifier.cjs   -  DEPLOY388
//
// Shared, deterministic domain classifier for reality-lock (and any future
// caller). Single source of truth for the domain keyword tables + scoring +
// the WEAK-SIGNAL GUARD.
//
// The guard exists because the prior classifier would confidently commit to an
// UNSUPPORTED, high-consequence domain on a single weak keyword hit -- e.g. the
// word "cryogenic" alone routed an LNG terminal to rocket_test_article, which
// the engine then refused, so a perfectly valid industrial scenario produced no
// analysis. The guard: never commit to an unsupported domain unless the signal
// is corroborated (>= MIN_HITS keyword hits AND >= MIN_SCORE). On weak signal,
// fall back to the best SUPPORTED domain with real signal, else "unknown" (let
// the AI-interpretation path handle it) -- which is always safer than a
// confident wrong refusal.
//
// PURE DETERMINISTIC. No LLM, no network, no clock, no random. var only,
// string concatenation only, no template literals, no arrow functions.
// ============================================================================
'use strict';

var DOMAIN_KEYWORDS = {
  "offshore_oil_gas": [
    "offshore", "platform", "jacket", "riser", "subsea", "fpso", "wellhead",
    "brace node", "cellar deck", "hydrocarbon", "boat landing", "jacket leg"
  ],
  "pipeline": [
    "pipeline", "free span", "anode", "bracelet anode", "export corridor",
    "anchor drag", "subsea line", "export line", "pig launcher"
  ],
  "refinery": [
    "refinery", "coker", "fractionator", "prv", "overhead piping", "hot line",
    "pipe rack", "delayed coker", "crude unit", "vacuum unit", "sulfidation",
    "hydrotreater", "hydrocracker", "alkylation", "reactor effluent", "amine unit", "desalter"
  ],
  "chemical_process": [
    "chemical plant", "reactor vessel", "solvent", "manifold", "separator",
    "process unit", "exchanger", "distillation"
  ],
  "bridge_civil": [
    "bridge", "overpass", "girder", "pier", "pier cap", "bearing", "abutment",
    "deck soffit", "prestressed beam", "parapet", "wingwall", "scour"
  ],
  "rail": [
    "railway", "railcar", "freight train", "track", "thermite weld", "tie plate",
    "ballast", "derailment", "federal railroad"
  ],
  "pressure_equipment": [
    "pressure vessel", "separator", "column", "shell", "nozzle",
    "heat exchanger", "storage tank", "drum",
    // DEPLOY388: LNG / cryogenic-process coverage so LNG export terminals,
    // transfer lines and supports classify into a SUPPORTED domain (piping /
    // pressure_vessel / storage_tank) instead of falling through to an exotic
    // unsupported domain.
    "lng", "lng terminal", "lng export", "lng transfer", "transfer line",
    "cryogenic storage", "cryogenic transfer", "cryogenic piping"
  ],
  "spacecraft_satellite": [
    "satellite", "spacecraft", "orbit", "on-orbit", "propulsion module",
    "telemetry", "thruster", "transfer orbit", "avionics", "solder joint",
    "launch shock", "propellant line", "solar panel", "payload"
  ],
  "aerospace_ground_test": [
    // DEPLOY388: bare "cryogenic" removed -- it is heavily used in LNG /
    // industrial-gas contexts and was the sole token that misrouted LNG
    // scenarios to rocket_test_article. Rocket cryo work is captured by the
    // specific phrase below plus the other rocket-only terms.
    "rocket engine", "test stand", "cryogenic propellant", "combustion chamber",
    "ground test", "thrust frame", "hot fire"
  ],
  "nuclear": [
    "nuclear", "reactor core", "containment", "fuel rod", "neutron",
    "radiation", "spent fuel", "coolant loop"
  ],
  "marine_vessel": [
    "vessel hull", "ship", "rudder", "propeller", "cargo ship",
    "ballast tank", "marine vessel", "keel"
  ],
  "power_generation": [
    "turbine", "boiler", "hrsg", "superheater", "generator",
    "power plant", "feedwater", "steam drum"
  ],
  "wind_energy": [
    "wind turbine", "nacelle", "blade", "tower base", "rotor hub",
    "yaw bearing", "wind farm", "monopile", "offshore wind", "transition piece"
  ],
  "aircraft_aviation": [
    "aircraft", "airplane", "cargo aircraft", "landing gear", "wing root",
    "fuselage", "brake fire", "hard landing", "runway", "rollout",
    "wing spar", "skin wrinkling", "wheel well", "flight control",
    "airworthiness", "airframe", "turbine blade", "engine pylon"
  ]
};

var SUPPORTED_DOMAINS = {
  "offshore_oil_gas": true,
  "pipeline": true,
  "refinery": true,
  "chemical_process": true,
  "bridge_civil": true,
  "rail": true,
  "pressure_equipment": true
};

// Guard thresholds.
var MIN_UNSUPPORTED_COMMIT_HITS = 2;   // need >=2 distinct keyword hits, and
var MIN_UNSUPPORTED_COMMIT_SCORE = 16; // >= this score, to trust an unsupported domain
var MIN_SUPPORTED_FALLBACK_SCORE = 10; // else fall back to a supported domain with >= this score

// DEPLOY393 - domain-DEFINING terms. If present, the domain is selected even
// when unsupported (overrides the weak-signal guard) and even if a generic
// higher-weight term (e.g. 'bearing','platform') scored another domain higher.
// Fixes: FPSO->bridge (via 'bearing'), wind monopile->offshore (via 'offshore'),
// nuclear->unknown (guard suppression).
var UNAMBIGUOUS_TERMS = {
  nuclear: ['nuclear', 'reactor core', 'spent fuel', 'fuel rod'],
  aerospace_ground_test: ['rocket engine', 'combustion chamber', 'thrust frame', 'hot fire', 'cryogenic propellant'],
  spacecraft_satellite: ['spacecraft', 'satellite', 'propulsion module', 'on-orbit'],
  aircraft_aviation: ['aircraft', 'airframe', 'fuselage', 'landing gear', 'wing spar'],
  wind_energy: ['wind turbine', 'wind farm', 'offshore wind', 'monopile', 'nacelle', 'transition piece'],
  offshore_oil_gas: ['fpso', 'wellhead', 'jacket leg', 'riser', 'subsea'],
  pipeline: ['pipeline', 'pig launcher'],
  refinery: ['refinery', 'coker', 'hydrotreater', 'hydrocracker', 'alkylation', 'reactor effluent', 'crude unit', 'vacuum unit'],
  bridge_civil: ['bridge', 'girder', 'abutment'],
  rail: ['railcar', 'thermite weld', 'derailment'],
  marine_vessel: ['marine vessel', 'cargo ship', 'vessel hull']
};

function keywordWeight(kw) {
  if (kw.length > 10) { return 12; }
  if (kw.length > 6) { return 8; }
  return 5;
}

// Score every domain. Returns array sorted by score desc.
function scoreDomains(transcript) {
  var lt = String(transcript || "").toLowerCase();
  var results = [];
  for (var domain in DOMAIN_KEYWORDS) {
    if (!DOMAIN_KEYWORDS.hasOwnProperty(domain)) { continue; }
    var keywords = DOMAIN_KEYWORDS[domain];
    var score = 0;
    var hits = [];
    for (var i = 0; i < keywords.length; i++) {
      var kw = keywords[i].toLowerCase();
      if (lt.indexOf(kw) !== -1) {
        score += keywordWeight(kw);
        hits.push(kw);
      }
    }
    results.push({ domain: domain, score: score, hits: hits });
  }
  results.sort(function (a, b) {
    if (b.score !== a.score) { return b.score - a.score; }
    return a.domain < b.domain ? -1 : (a.domain > b.domain ? 1 : 0); // stable tie-break
  });
  return results;
}

function bestSupported(scores) {
  for (var i = 0; i < scores.length; i++) {
    if (SUPPORTED_DOMAINS[scores[i].domain] && scores[i].score >= MIN_SUPPORTED_FALLBACK_SCORE) {
      return scores[i];
    }
  }
  return null;
}

// Classify with the weak-signal guard.
// Returns { domain, score, hits, supported, second, secondScore,
//           rawTopDomain, guardApplied, guardReason, allScores }.
function classifyDomain(transcript) {
  var scores = scoreDomains(transcript);
  var top = scores[0] || { domain: "unknown", score: 0, hits: [] };
  var second = scores[1] || { domain: "unknown", score: 0, hits: [] };
  // rawTopDomain only meaningful when there is real signal; an all-zero
  // score set sorts alphabetically and would otherwise report a misleading top.
  var rawTop = top.score > 0 ? top.domain : "unknown";

  function out(domain, score, hits, guardApplied, reason) {
    return {
      domain: domain,
      score: score,
      hits: hits,
      supported: !!SUPPORTED_DOMAINS[domain],
      second: second.domain,
      secondScore: second.score,
      rawTopDomain: rawTop,
      guardApplied: !!guardApplied,
      guardReason: reason || "",
      allScores: scores
    };
  }

  // No signal at all.
  if (top.score === 0) {
    return out("unknown", 0, [], false, "no domain keywords matched");
  }

  // DEPLOY393 - unambiguous domain-defining override. Among domains with a
  // defining term present, pick the highest-scored one. This selects the true
  // domain even when a generic term scored another higher, and lets clearly
  // unsupported domains (nuclear/wind/aircraft) classify rather than be guarded.
  var lt = String(transcript || '').toLowerCase();
  var unamb = {};
  for (var ud in UNAMBIGUOUS_TERMS) {
    if (!UNAMBIGUOUS_TERMS.hasOwnProperty(ud)) { continue; }
    for (var ti = 0; ti < UNAMBIGUOUS_TERMS[ud].length; ti++) {
      if (lt.indexOf(UNAMBIGUOUS_TERMS[ud][ti]) >= 0) { unamb[ud] = UNAMBIGUOUS_TERMS[ud][ti]; break; }
    }
  }
  var chosen = null;
  for (var us = 0; us < scores.length; us++) {
    if (unamb[scores[us].domain]) { chosen = scores[us]; break; }
  }
  if (chosen) {
    return out(chosen.domain, chosen.score, chosen.hits.length ? chosen.hits : [unamb[chosen.domain]], false,
      'unambiguous domain term: ' + unamb[chosen.domain]);
  }
  // Supported top domain -> trust it.
  if (SUPPORTED_DOMAINS[top.domain]) {
    return out(top.domain, top.score, top.hits, false, "");
  }
  // Unsupported top domain -> require corroboration before committing.
  var corroborated = (top.hits.length >= MIN_UNSUPPORTED_COMMIT_HITS) &&
                     (top.score >= MIN_UNSUPPORTED_COMMIT_SCORE);
  if (corroborated) {
    return out(top.domain, top.score, top.hits, false, "");
  }
  // Weak unsupported signal -> guard. Prefer a supported domain with real
  // signal; otherwise fall back to unknown (AI interpretation), never a
  // confident unsupported classification on a single weak keyword.
  var bs = bestSupported(scores);
  if (bs) {
    return out(bs.domain, bs.score, bs.hits, true,
      "weak unsupported signal (" + top.domain + ", score " + top.score + ", " + top.hits.length +
      " hit(s)); fell back to supported domain " + bs.domain);
  }
  return out("unknown", top.score, top.hits, true,
    "weak unsupported signal (" + top.domain + ", score " + top.score + ", " + top.hits.length +
    " hit(s)) and no supported domain with sufficient signal; routed to unknown");
}

module.exports = {
  classifyDomain: classifyDomain,
  scoreDomains: scoreDomains,
  DOMAIN_KEYWORDS: DOMAIN_KEYWORDS,
  SUPPORTED_DOMAINS: SUPPORTED_DOMAINS
};
