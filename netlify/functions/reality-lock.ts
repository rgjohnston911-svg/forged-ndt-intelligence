// DEPLOY94 — reality-lock.ts v1
// Reality Lock + Domain Authority Gate
// Sits AFTER parse+asset, BEFORE evidence confirmation and chain
// Prevents the platform from being confidently wrong by:
//   1. Detecting actual domain from transcript keywords
//   2. Checking if domain is supported by deterministic chain
//   3. Detecting asset/domain conflicts (e.g., bridge classification on satellite)
//   4. Suggesting asset override when conflict detected
//   5. Applying confidence penalty for ambiguity
//   6. Returning routing decision: full_pipeline vs ai_interpretation_only
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

declare var process: any;

// ================================================================
// DOMAIN KEYWORD MAP
// ================================================================

var DOMAIN_KEYWORDS: { [key: string]: string[] } = {
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
    "pipe rack", "delayed coker", "crude unit", "vacuum unit", "sulfidation"
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
    "rail", "railcar", "freight train", "track", "thermite weld", "tie plate",
    "ballast", "derailment", "federal railroad"
  ],
  "pressure_equipment": [
    "pressure vessel", "separator", "column", "shell", "nozzle",
    "heat exchanger", "storage tank", "drum"
  ],
  "spacecraft_satellite": [
    "satellite", "spacecraft", "orbit", "on-orbit", "propulsion module",
    "telemetry", "thruster", "transfer orbit", "avionics", "solder joint",
    "launch shock", "propellant line", "solar panel", "payload"
  ],
  "aerospace_ground_test": [
    "rocket engine", "test stand", "cryogenic", "combustion chamber",
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
    "yaw bearing", "wind farm"
  ],
  "aircraft_aviation": [
    "aircraft", "airplane", "cargo aircraft", "landing gear", "wing root",
    "fuselage", "brake fire", "hard landing", "runway", "rollout",
    "wing spar", "skin wrinkling", "wheel well", "flight control",
    "airworthiness", "airframe", "turbine blade", "engine pylon"
  ]
};

// ================================================================
// SUPPORTED DOMAINS — deterministic chain has coverage
// ================================================================

var SUPPORTED_DOMAINS: { [key: string]: boolean } = {
  "offshore_oil_gas": true,
  "pipeline": true,
  "refinery": true,
  "chemical_process": true,
  "bridge_civil": true,
  "rail": true,
  "pressure_equipment": true
};

// ================================================================
// DOMAIN → CORRECT ASSET FAMILY mapping
// Used to detect and correct asset classification conflicts
// ================================================================

var DOMAIN_ASSET_MAP: { [key: string]: string[] } = {
  "offshore_oil_gas": ["offshore_platform"],
  "pipeline": ["pipeline"],
  "refinery": ["refinery", "pressure_vessel", "piping", "process_piping", "storage_tank"],
  "chemical_process": ["chemical_plant", "pressure_vessel", "piping", "process_piping"],
  "bridge_civil": ["bridge", "bridge_steel", "bridge_concrete"],
  "rail": ["rail", "rail_bridge"],
  "pressure_equipment": ["pressure_vessel", "piping", "process_piping", "storage_tank"],
  "spacecraft_satellite": ["satellite", "spacecraft"],
  "aerospace_ground_test": ["rocket_test_article"],
  "nuclear": ["nuclear_vessel", "nuclear_piping"],
  "marine_vessel": ["marine_vessel", "ship"],
  "power_generation": ["boiler", "turbine", "hrsg"],
  "wind_energy": ["wind_turbine"],
  "aircraft_aviation": ["aircraft", "airframe"]
};

// ================================================================
// DOMAIN LABELS for display
// ================================================================

var DOMAIN_LABELS: { [key: string]: string } = {
  "offshore_oil_gas": "Offshore Oil & Gas",
  "pipeline": "Pipeline",
  "refinery": "Refinery / Process",
  "chemical_process": "Chemical Process",
  "bridge_civil": "Bridge / Civil Infrastructure",
  "rail": "Rail Infrastructure",
  "pressure_equipment": "Pressure Equipment",
  "spacecraft_satellite": "Spacecraft / Satellite",
  "aerospace_ground_test": "Aerospace Ground Test",
  "nuclear": "Nuclear",
  "marine_vessel": "Marine Vessel",
  "power_generation": "Power Generation",
  "wind_energy": "Wind Energy",
  "aircraft_aviation": "Aircraft / Aviation"
};

// ================================================================
// KEYWORD SCORER
// ================================================================

function scoreDomains(transcript: string): { domain: string; score: number; hits: string[] }[] {
  var lt = transcript.toLowerCase();
  var results: { domain: string; score: number; hits: string[] }[] = [];

  for (var domain in DOMAIN_KEYWORDS) {
    if (!DOMAIN_KEYWORDS.hasOwnProperty(domain)) continue;
    var keywords = DOMAIN_KEYWORDS[domain];
    var score = 0;
    var hits: string[] = [];

    for (var i = 0; i < keywords.length; i++) {
      var kw = keywords[i].toLowerCase();
      if (lt.indexOf(kw) !== -1) {
        // Longer phrases get more weight — more specific = more confident
        var weight = kw.length > 10 ? 12 : kw.length > 6 ? 8 : 5;
        score += weight;
        hits.push(kw);
      }
    }

    results.push({ domain: domain, score: score, hits: hits });
  }

  // Sort by score descending
  results.sort(function(a, b) { return b.score - a.score; });
  return results;
}

// ================================================================
// ASSET COMPATIBILITY CHECK
// ================================================================

function isAssetCompatible(domain: string, assetClass: string): boolean {
  var validAssets = DOMAIN_ASSET_MAP[domain];
  if (!validAssets) return true; // unknown domain, don't block
  var ac = (assetClass || "").toLowerCase();
  for (var i = 0; i < validAssets.length; i++) {
    if (ac.indexOf(validAssets[i]) !== -1) return true;
  }
  return false;
}

function suggestAssetOverride(domain: string): string {
  var assets = DOMAIN_ASSET_MAP[domain];
  if (assets && assets.length > 0) return assets[0];
  return "unknown";
}

// ================================================================
// MAIN ENGINE
// ================================================================

function runRealityLock(transcript: string, parsedAssetClass: string, parsedAssetConfidence: number): any {
  var startMs = Date.now();
  var trace: string[] = [];
  var warnings: any[] = [];

  // Step 1: Score all domains
  var domainScores = scoreDomains(transcript);
  var topDomain = domainScores[0] || { domain: "unknown", score: 0, hits: [] };
  var secondDomain = domainScores[1] || { domain: "unknown", score: 0, hits: [] };

  trace.push("Domain scoring complete. Top: " + topDomain.domain + " (" + topDomain.score + "), Runner-up: " + secondDomain.domain + " (" + secondDomain.score + ").");
  if (topDomain.hits.length > 0) {
    trace.push("Keyword hits: " + topDomain.hits.join(", ") + ".");
  }

  // Step 2: Check if domain is supported
  var domainSupported = !!SUPPORTED_DOMAINS[topDomain.domain];
  var routingDecision = domainSupported ? "full_pipeline" : "ai_interpretation_only";

  trace.push("Domain " + topDomain.domain + " is " + (domainSupported ? "SUPPORTED" : "NOT SUPPORTED") + " by deterministic chain.");
  trace.push("Routing decision: " + routingDecision + ".");

  // Step 3: Check for asset conflict
  var assetCompatible = isAssetCompatible(topDomain.domain, parsedAssetClass);
  var assetOverride: string | null = null;
  var conflict = false;

  if (!assetCompatible && topDomain.score > 0) {
    conflict = true;
    assetOverride = suggestAssetOverride(topDomain.domain);
    warnings.push({
      code: "ASSET_DOMAIN_CONFLICT",
      severity: "critical",
      message: "Parsed asset '" + parsedAssetClass + "' conflicts with detected domain '" + topDomain.domain + "'. " + (domainSupported ? ("Asset overridden to '" + assetOverride + "'.") : "Deterministic chain will not run.")
    });
    trace.push("CONFLICT: Parsed asset '" + parsedAssetClass + "' does not match detected domain '" + topDomain.domain + "'.");
    if (assetOverride) {
      trace.push("Asset override suggested: " + assetOverride + ".");
    }
  } else {
    trace.push("Asset '" + parsedAssetClass + "' is compatible with domain '" + topDomain.domain + "'.");
  }

  // Step 4: Confidence penalty
  var confidencePenalty = 0;
  if (conflict) confidencePenalty -= 20;
  if (topDomain.score === 0) confidencePenalty -= 25;
  if (topDomain.score > 0 && topDomain.score < 15) confidencePenalty -= 10;
  // Ambiguity penalty: if second domain is close to first
  if (secondDomain.score > 0 && topDomain.score > 0 && (topDomain.score - secondDomain.score) < 8) {
    confidencePenalty -= 10;
    warnings.push({
      code: "DOMAIN_AMBIGUITY",
      severity: "warning",
      message: "Top two domains are close in score (" + topDomain.domain + ": " + topDomain.score + " vs " + secondDomain.domain + ": " + secondDomain.score + "). Domain classification may be ambiguous."
    });
    trace.push("Domain ambiguity detected: gap is only " + (topDomain.score - secondDomain.score) + " points.");
  }

  // Step 5: Unsupported domain warnings
  if (!domainSupported && topDomain.score > 10) {
    warnings.push({
      code: "UNSUPPORTED_DOMAIN",
      severity: "warning",
      message: "Domain '" + (DOMAIN_LABELS[topDomain.domain] || topDomain.domain) + "' is not covered by the deterministic inspection chain. AI interpretation will be displayed instead of deterministic analysis."
    });
  }

  if (!domainSupported && topDomain.score === 0) {
    warnings.push({
      code: "UNKNOWN_DOMAIN",
      severity: "warning",
      message: "No domain could be confidently identified from the transcript. AI interpretation will be displayed."
    });
    trace.push("No domain keywords matched. Domain is unknown.");
  }

  // Step 6: Build management summary
  var domainLabel = DOMAIN_LABELS[topDomain.domain] || topDomain.domain;
  var summary = "";
  if (domainSupported && !conflict) {
    summary = "Domain: " + domainLabel + " (supported). Full deterministic pipeline will execute.";
  } else if (domainSupported && conflict) {
    summary = "Domain: " + domainLabel + " (supported). Asset conflict detected and corrected. Pipeline will execute with overridden asset.";
  } else {
    summary = "Domain: " + domainLabel + " (not supported by deterministic engines). AI interpretation will be displayed. Deterministic mechanisms, methods, and code citations are not available for this domain.";
  }

  return {
    engine_version: "reality-lock-v1",
    elapsed_ms: Date.now() - startMs,
    detected_domain: topDomain.domain,
    detected_domain_label: domainLabel,
    domain_score: topDomain.score,
    domain_keyword_hits: topDomain.hits,
    runner_up_domain: secondDomain.domain,
    runner_up_score: secondDomain.score,
    domain_supported: domainSupported,
    routing_decision: routingDecision,
    asset_compatible: assetCompatible,
    asset_conflict: conflict,
    asset_override: assetOverride,
    confidence_penalty: confidencePenalty,
    warnings: warnings,
    trace: trace,
    management_summary: summary
  };
}

// ================================================================
// NETLIFY HANDLER
// ================================================================

var handler = async function(event: any): Promise<any> {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var transcript = body.transcript || "";
    var parsedAssetClass = body.parsed_asset_class || "unknown";
    var parsedAssetConfidence = body.parsed_asset_confidence || 0;

    if (!transcript) {
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify({ error: "transcript is required" }) };
    }

    var result = runRealityLock(transcript, parsedAssetClass, parsedAssetConfidence);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, reality_lock: result })
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "reality-lock error", message: err.message || "Unknown" })
    };
  }
};

export { handler };
