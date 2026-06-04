/**
 * DEPLOY54 — run-external-event.ts
 * netlify/functions/run-external-event.ts
 *
 * Comprehensive External Event Physics Layer — INLINED
 * Converts real-world events (hurricane, vehicle impact, etc.) into
 * structured inspection intelligence with damage predictions,
 * inspection targets, compound effects, and risk scores.
 *
 * CONSTRAINT: No backtick template literals (Git Bash paste corruption)
 */
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* ================================================================
   HELPERS
================================================================ */

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

function addUnique(arr: string[], item: string) { if (arr.indexOf(item) === -1) arr.push(item); }

function probToPriority(p: number): string {
  if (p >= 0.8) return "CRITICAL";
  if (p >= 0.65) return "HIGH";
  if (p >= 0.45) return "MEDIUM";
  return "LOW";
}

/* ================================================================
   PARSER — classify events + compute severity indices
================================================================ */

function parseEvent(input: any) {
  var raw = ((input.rawText || "") + " " + (input.assetDescription || "")).toLowerCase();
  var eventTypes: string[] = [];
  var loadTypes: string[] = [];

  var windBase = Math.max(input.windSpeedMph || 0, input.windGustMph || 0);
  var windSev = clamp01(windBase / 120);
  var waveSev = clamp01((input.waveHeightFt || 0) / 30);
  var currentSev = clamp01((input.currentSpeedKnots || 0) / 6);

  var thermalSpan = input.surfaceTemperatureShiftF != null
    ? Math.abs(input.surfaceTemperatureShiftF)
    : Math.abs((input.temperatureHighF || 0) - (input.temperatureLowF || 0));
  var thermalSev = clamp01(thermalSpan / 120);

  var precip = (input.precipitationIntensity || "").toUpperCase();
  var rainSev = precip === "EXTREME" ? 0.95 : precip === "HEAVY" ? 0.75 : precip === "MODERATE" ? 0.45 : precip === "LIGHT" ? 0.2 : clamp01((input.rainfallInches || 0) / 10);
  var floodSev = clamp01((input.floodingDepthFt || 0) / 10);
  var hailSev = clamp01((input.hailDiameterIn || 0) / 3);
  var seismicSev = clamp01((input.seismicAccelerationG || 0) / 1.0);

  var impactEnergy = ((input.impactMassEstimateLb || 0) / 5000) * 0.5 + ((input.impactSpeedMph || 0) / 50) * 0.5;
  var impactSev = clamp01(impactEnergy);

  /* Classify events from text */
  if (raw.indexOf("hurricane") !== -1) addUnique(eventTypes, "HURRICANE");
  if (raw.indexOf("wind") !== -1 || windSev > 0.35) addUnique(eventTypes, "WINDSTORM");
  if (raw.indexOf("wave") !== -1 || raw.indexOf("surge") !== -1 || waveSev > 0.35) addUnique(eventTypes, "WAVE_SURGE");
  if (raw.indexOf("current") !== -1 || currentSev > 0.3) addUnique(eventTypes, "CURRENT_LOAD");
  if (raw.indexOf("heat") !== -1 || (input.temperatureHighF || 0) >= 100) addUnique(eventTypes, "EXTREME_HEAT");
  if (raw.indexOf("cold") !== -1 || raw.indexOf("freeze") !== -1 || (input.temperatureLowF || 999) <= 20) addUnique(eventTypes, "EXTREME_COLD");
  if (thermalSev > 0.45) addUnique(eventTypes, "THERMAL_SHOCK");
  if (raw.indexOf("rain") !== -1 || rainSev > 0.35) addUnique(eventTypes, "HEAVY_RAIN");
  if (raw.indexOf("flood") !== -1 || floodSev > 0.25) addUnique(eventTypes, "FLOODING");
  if (raw.indexOf("hail") !== -1 || hailSev > 0.25) addUnique(eventTypes, "HAIL");
  if (raw.indexOf("lightning") !== -1) addUnique(eventTypes, "LIGHTNING");
  if (raw.indexOf("snow") !== -1 || raw.indexOf("ice") !== -1) addUnique(eventTypes, "SNOW_ICE");
  if (raw.indexOf("earthquake") !== -1 || seismicSev > 0.15) addUnique(eventTypes, "EARTHQUAKE");
  if (raw.indexOf("car hit") !== -1 || raw.indexOf("vehicle") !== -1 || raw.indexOf("truck") !== -1) addUnique(eventTypes, "VEHICLE_IMPACT");
  if (raw.indexOf("vessel collision") !== -1 || raw.indexOf("boat hit") !== -1 || raw.indexOf("ship") !== -1) addUnique(eventTypes, "VESSEL_COLLISION");
  if (raw.indexOf("dropped object") !== -1) addUnique(eventTypes, "DROPPED_OBJECT");
  if (raw.indexOf("crane") !== -1) addUnique(eventTypes, "CRANE_STRIKE");
  if (raw.indexOf("tree") !== -1) addUnique(eventTypes, "TREE_FALL");
  if (raw.indexOf("debris") !== -1) addUnique(eventTypes, "DEBRIS_STRIKE");
  if (raw.indexOf("collision") !== -1) addUnique(eventTypes, "EQUIPMENT_COLLISION");
  if (eventTypes.length === 0) addUnique(eventTypes, "UNKNOWN");

  /* Classify loads */
  if (windSev > 0.25) addUnique(loadTypes, "WIND_LOAD");
  if (waveSev > 0.25) addUnique(loadTypes, "WAVE_LOAD");
  if (currentSev > 0.2) addUnique(loadTypes, "CURRENT_LOAD");
  if (floodSev > 0.2 || rainSev > 0.45) addUnique(loadTypes, "WATER_INGRESS");
  if ((input.offshoreWaterDepthFt || 0) > 0) addUnique(loadTypes, "HYDROSTATIC_LOAD");
  if ((input.temperatureHighF || 0) > 90) addUnique(loadTypes, "THERMAL_EXPANSION");
  if ((input.temperatureLowF || 999) < 32) addUnique(loadTypes, "THERMAL_CONTRACTION");
  if (thermalSev > 0.4) addUnique(loadTypes, "THERMAL_GRADIENT");
  if (impactSev > 0.2) addUnique(loadTypes, "IMPACT_LOAD");
  if (seismicSev > 0.15) addUnique(loadTypes, "SEISMIC_LOAD");
  if (hailSev > 0.2) addUnique(loadTypes, "DEBRIS_IMPACT");
  if (loadTypes.length === 0) addUnique(loadTypes, "UNKNOWN");

  var overallSev = Math.max(windSev, waveSev, currentSev, thermalSev, rainSev, hailSev, seismicSev, impactSev, floodSev);
  var multiCount = eventTypes.filter(function(e) { return e !== "UNKNOWN"; }).length;
  if (multiCount >= 2) overallSev = clamp01(overallSev + 0.08);
  if (multiCount >= 3) overallSev = clamp01(overallSev + 0.08);

  var offshore = (input.offshoreWaterDepthFt || 0) > 0;
  var pressureBoundary = Boolean(input.pressureContaining);

  return {
    assetClass: (input.assetClass || "UNKNOWN").toUpperCase(),
    eventTypes: eventTypes, loadTypes: loadTypes,
    windSev: windSev, waveSev: waveSev, currentSev: currentSev,
    thermalSev: thermalSev, rainSev: rainSev, hailSev: hailSev,
    seismicSev: seismicSev, impactSev: impactSev, floodSev: floodSev,
    offshore: offshore, pressureBoundary: pressureBoundary,
    overallSev: overallSev,
    confidence: (input.rawText || "").length > 12 ? (overallSev >= 0.65 ? "HIGH" : "MODERATE") : "LOW"
  };
}

/* ================================================================
   DAMAGE PREDICTION ENGINE
================================================================ */

function predictDamage(p: any) {
  var out: any[] = [];

  function push(mech: string, prob: number, systems: string[], explanation: string, loads: string[]) {
    out.push({ mechanism: mech, probability: clamp01(prob), affected_systems: systems, explanation: explanation, source_loads: loads });
  }

  if (p.windSev > 0.45 || p.waveSev > 0.45 || p.currentSev > 0.35) {
    push("FATIGUE_LOADING", Math.max(p.windSev, p.waveSev, p.currentSev) * 0.9, ["welded joints", "bracing", "supports", "connections"], "Repeated environmental loading raises cyclic stress and fatigue-initiation risk.", ["WIND_LOAD", "WAVE_LOAD", "CURRENT_LOAD"]);
  }
  if (p.waveSev > 0.6 || p.windSev > 0.7 || p.seismicSev > 0.45) {
    push("STRUCTURAL_OVERSTRESS", Math.max(p.waveSev, p.windSev, p.seismicSev) * 0.85, ["primary structure", "legs", "frames", "connections"], "Large external loads can exceed local structural demand.", ["WIND_LOAD", "WAVE_LOAD", "SEISMIC_LOAD"]);
  }
  if (p.impactSev > 0.35 || p.hailSev > 0.35) {
    push("IMPACT_DAMAGE", Math.max(p.impactSev, p.hailSev) * 0.95, ["impact face", "supports", "shell surfaces", "guarding"], "Direct impact loading creates localized damage.", ["IMPACT_LOAD"]);
  }
  if (p.impactSev > 0.45) {
    push("MECHANICAL_DEFORMATION", p.impactSev * 0.85, ["shell", "support member", "brackets", "connection points"], "Collision or falling-object events can deform members.", ["IMPACT_LOAD"]);
    push("DENTING", p.impactSev * 0.9, ["pressure boundaries", "bridge supports", "tubular members"], "Impact can create dent-type damage and stress concentration.", ["IMPACT_LOAD"]);
  }
  if (p.impactSev > 0.5) {
    push("GOUGING", p.impactSev * 0.75, ["impact surface", "coated steel", "vessel shell"], "Hard contact can remove material or rupture surface layers.", ["IMPACT_LOAD"]);
  }
  if (p.windSev > 0.45 || p.hailSev > 0.25 || p.impactSev > 0.3) {
    push("COATING_DAMAGE", Math.max(p.windSev * 0.7, p.hailSev * 0.9, p.impactSev * 0.8), ["topsides", "exposed steel", "vessel shell", "coated members"], "Wind debris, hail, or impact can rupture protective coatings.", ["WIND_LOAD", "DEBRIS_IMPACT", "IMPACT_LOAD"]);
  }
  if (p.rainSev > 0.45 || p.floodSev > 0.35) {
    push("WATER_INGRESS_DAMAGE", Math.max(p.rainSev, p.floodSev) * 0.85, ["seals", "enclosures", "insulation", "coating defects"], "Heavy precipitation or flooding introduces moisture into vulnerable systems.", ["WATER_INGRESS"]);
  }
  if (p.rainSev > 0.45 || p.floodSev > 0.35 || p.offshore) {
    push("CORROSION_INITIATION", Math.max(p.rainSev * 0.65, p.floodSev * 0.8, p.offshore ? 0.55 : 0.2), ["coating holidays", "damaged steel", "fasteners", "splash zone"], "Moisture exposure following damage initiates corrosion at exposed surfaces.", ["WATER_INGRESS"]);
  }
  if ((p.offshore && (p.waveSev > 0.35 || p.windSev > 0.45)) || p.floodSev > 0.35) {
    push("CORROSION_ACCELERATION", 0.35 + Math.max(p.waveSev, p.windSev, p.floodSev) * 0.55, ["splash zone", "exposed steel", "damaged coatings"], "Marine or prolonged wet exposure accelerates existing corrosion.", ["WAVE_LOAD", "WATER_INGRESS"]);
  }
  if (p.thermalSev > 0.45) {
    push("THERMAL_EXPANSION_DAMAGE", p.thermalSev * 0.75, ["piping", "supports", "expansion points", "joints"], "Large thermal variation creates displacement and restraint stress.", ["THERMAL_EXPANSION", "THERMAL_GRADIENT"]);
  }
  if (p.thermalSev > 0.55) {
    push("SEAL_FAILURE", p.thermalSev * 0.72, ["gaskets", "elastomers", "flange seals"], "Thermal cycling compromises sealing materials.", ["THERMAL_EXPANSION", "THERMAL_CONTRACTION"]);
    push("BRITTLE_RESPONSE", p.thermalSev * 0.68, ["low-temperature steel", "restraint zones"], "Severe low temperature shifts response toward brittle behavior.", ["THERMAL_CONTRACTION"]);
  }
  if (p.seismicSev > 0.25) {
    push("MISALIGNMENT", p.seismicSev * 0.85, ["supports", "piping runs", "anchors", "bridge bearings"], "Seismic loading shifts alignment and support geometry.", ["SEISMIC_LOAD"]);
  }
  if (p.seismicSev > 0.35) {
    push("ANCHORAGE_DISTRESS", p.seismicSev * 0.8, ["base plates", "anchor points", "hold-downs"], "Earthquake loading distresses anchorage locations.", ["SEISMIC_LOAD"]);
    push("FOUNDATION_DISTRESS", p.seismicSev * 0.78, ["footings", "supports", "bridge substructure"], "Ground motion compromises support condition.", ["SEISMIC_LOAD"]);
  }
  if (p.impactSev > 0.45 || p.seismicSev > 0.35 || p.waveSev > 0.65) {
    push("SUPPORT_DAMAGE", Math.max(p.impactSev, p.seismicSev, p.waveSev) * 0.82, ["support legs", "saddles", "brackets", "clamps"], "High event loading damages support systems.", ["IMPACT_LOAD", "SEISMIC_LOAD", "WAVE_LOAD"]);
  }

  /* Dedupe by mechanism, keep highest probability */
  var seen: Record<string, any> = {};
  for (var i = 0; i < out.length; i++) {
    var key = out[i].mechanism;
    if (!seen[key] || out[i].probability > seen[key].probability) {
      seen[key] = out[i];
    }
  }
  var result = Object.keys(seen).map(function(k) { return seen[k]; });
  result.sort(function(a: any, b: any) { return b.probability - a.probability; });
  return result;
}

/* ================================================================
   COMPOUND EFFECTS
================================================================ */

function buildCompound(p: any) {
  var out: any[] = [];
  if (p.windSev > 0.45 && p.waveSev > 0.45) {
    out.push({ title: "Wind + wave cyclic interaction", explanation: "Combined wind and wave loading increases cyclic stress beyond either alone.", severityBoost: 0.12 });
  }
  if ((p.windSev > 0.35 || p.hailSev > 0.25 || p.impactSev > 0.25) && (p.rainSev > 0.45 || p.floodSev > 0.35 || p.offshore)) {
    out.push({ title: "Surface damage + moisture interaction", explanation: "Coating damage combined with wet exposure raises corrosion initiation potential.", severityBoost: 0.14 });
  }
  if (p.thermalSev > 0.45 && (p.seismicSev > 0.25 || p.impactSev > 0.35)) {
    out.push({ title: "Thermal + displacement interaction", explanation: "Thermal stress combined with sudden movement increases crack initiation risk.", severityBoost: 0.1 });
  }
  if (p.seismicSev > 0.25 && p.floodSev > 0.25) {
    out.push({ title: "Foundation shift + water exposure", explanation: "Ground movement combined with flooding amplifies support instability.", severityBoost: 0.1 });
  }
  if (p.impactSev > 0.4 && p.pressureBoundary) {
    out.push({ title: "Impact on pressure boundary", explanation: "Impact on pressure-containing boundary sharply raises consequence and urgency.", severityBoost: 0.16 });
  }
  return out;
}

/* ================================================================
   INSPECTION TARGETS
================================================================ */

function buildTargets(damage: any[]) {
  var out: any[] = [];
  for (var i = 0; i < damage.length; i++) {
    var d = damage[i];
    var methods = ["VT"];
    if (["FATIGUE_LOADING", "CRACK_INITIATION", "BRITTLE_RESPONSE"].indexOf(d.mechanism) !== -1) methods = ["VT", "PT", "MT", "UT"];
    else if (["COATING_DAMAGE", "CORROSION_INITIATION", "CORROSION_ACCELERATION", "WATER_INGRESS_DAMAGE"].indexOf(d.mechanism) !== -1) methods = ["VT", "UT", "Holiday Test"];
    else if (["IMPACT_DAMAGE", "MECHANICAL_DEFORMATION", "DENTING", "GOUGING", "SUPPORT_DAMAGE"].indexOf(d.mechanism) !== -1) methods = ["VT", "UT", "Dimensional Check"];
    else if (["MISALIGNMENT", "ANCHORAGE_DISTRESS", "FOUNDATION_DISTRESS"].indexOf(d.mechanism) !== -1) methods = ["VT", "Dimensional Check", "Alignment Survey"];
    else if (["SEAL_FAILURE", "THERMAL_EXPANSION_DAMAGE"].indexOf(d.mechanism) !== -1) methods = ["VT", "Leak Check", "Dimensional Check"];

    out.push({
      zone: d.affected_systems.join(", "),
      priority: probToPriority(d.probability),
      reason: d.explanation,
      suggested_methods: methods
    });
  }
  return out;
}

/* ================================================================
   IMMEDIATE ACTIONS
================================================================ */

function buildActions(p: any, damage: any[]) {
  var actions: string[] = [];
  if (p.overallSev >= 0.75) actions.push("Escalate to post-event priority inspection protocol immediately.");
  if (p.pressureBoundary && damage.some(function(d: any) { return ["IMPACT_DAMAGE", "MECHANICAL_DEFORMATION", "DENTING", "SUPPORT_DAMAGE"].indexOf(d.mechanism) !== -1; })) {
    actions.push("Treat pressure boundary as potentially compromised until inspected.");
  }
  if (damage.some(function(d: any) { return d.mechanism === "COATING_DAMAGE"; })) actions.push("Prioritize coated surfaces for breach and substrate exposure assessment.");
  if (damage.some(function(d: any) { return d.mechanism === "FATIGUE_LOADING"; })) actions.push("Inspect high-stress welds, supports, and previously repaired areas first.");
  if (damage.some(function(d: any) { return d.mechanism === "MISALIGNMENT" || d.mechanism === "ANCHORAGE_DISTRESS"; })) actions.push("Verify alignment, support seating, and anchorage condition.");
  if (actions.length === 0) actions.push("Perform initial visual screening and refine inspection plan from field observations.");
  return actions;
}

/* ================================================================
   NARRATIVE
================================================================ */

function buildNarrative(input: any, p: any, damage: any[], compound: any[]) {
  var lines = [];
  lines.push("External event detected: " + p.eventTypes.join(", "));
  lines.push("Asset class: " + p.assetClass);
  lines.push("Overall severity: " + Math.round(p.overallSev * 100) + "%");
  lines.push("");
  lines.push("Primary predicted damage mechanisms:");
  for (var i = 0; i < Math.min(damage.length, 5); i++) {
    lines.push("  - " + damage[i].mechanism.replace(/_/g, " ") + " (" + Math.round(damage[i].probability * 100) + "%)");
  }
  if (compound.length > 0) {
    lines.push("");
    lines.push("Compound interaction effects:");
    for (var j = 0; j < compound.length; j++) {
      lines.push("  - " + compound[j].title + ": " + compound[j].explanation);
    }
  }
  lines.push("");
  lines.push("This event should be treated as a post-event inspection trigger, not a single-point defect report.");
  return lines.join("\n");
}

/* ================================================================
   NETLIFY HANDLER
================================================================ */

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.caseId || null;

    if (!body.rawText) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "rawText is required" }) };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    /* Parse event */
    var parsed = parseEvent(body);

    /* Predict damage */
    var damageBase = predictDamage(parsed);

    /* Compound effects */
    var compound = buildCompound(parsed);
    var compoundBoost = 0;
    for (var c = 0; c < compound.length; c++) compoundBoost += compound[c].severityBoost;

    /* Apply compound boost to damage probabilities */
    var damage = damageBase.map(function(d: any) {
      return Object.assign({}, d, { probability: clamp01(d.probability + compoundBoost * 0.35) });
    });
    damage.sort(function(a: any, b: any) { return b.probability - a.probability; });

    /* Build targets + actions + narrative */
    var targets = buildTargets(damage);
    var actions = buildActions(parsed, damage);
    var narrative = buildNarrative(body, parsed, damage, compound);
    var riskScore = clamp01(parsed.overallSev + compoundBoost * 0.5);

    /* Warnings */
    var warnings: string[] = [];
    if (parsed.confidence === "LOW") warnings.push("Event parsing confidence is low; verify structured inputs.");
    if (parsed.assetClass === "UNKNOWN") warnings.push("Asset class not locked; targeting may be incomplete.");
    if (parsed.overallSev >= 0.8) warnings.push("High-severity external event: elevated inspection urgency.");
    if (parsed.pressureBoundary) warnings.push("Pressure-containing context increases consequence.");

    /* Store event run */
    var runRow = {
      case_id: caseId,
      raw_text: body.rawText,
      asset_class: parsed.assetClass,
      location_text: body.location || null,
      parsed_event_json: parsed,
      risk_score: riskScore,
      narrative: narrative,
      compound_effects_json: compound,
      immediate_actions_json: actions,
      warnings_json: warnings
    };

    var runInsert = await sb.from("external_event_runs").insert([runRow]).select("id").single();
    var runId = runInsert.data ? runInsert.data.id : null;

    if (runInsert.error) { console.log("WARNING: event run insert failed: " + JSON.stringify(runInsert.error)); }

    /* Store damage predictions */
    if (runId && damage.length > 0) {
      var damageRows = damage.map(function(d: any) {
        return {
          external_event_run_id: runId,
          mechanism: d.mechanism,
          probability: d.probability,
          affected_systems: d.affected_systems,
          explanation: d.explanation,
          source_loads: d.source_loads
        };
      });
      var dmgInsert = await sb.from("external_event_damage_predictions").insert(damageRows);
      if (dmgInsert.error) { console.log("WARNING: damage predictions insert failed: " + JSON.stringify(dmgInsert.error)); }
    }

    /* Store inspection targets */
    if (runId && targets.length > 0) {
      var targetRows = targets.map(function(t: any) {
        return {
          external_event_run_id: runId,
          zone: t.zone,
          priority: t.priority,
          reason: t.reason,
          suggested_methods: t.suggested_methods
        };
      });
      var tgtInsert = await sb.from("external_event_inspection_targets").insert(targetRows);
      if (tgtInsert.error) { console.log("WARNING: targets insert failed: " + JSON.stringify(tgtInsert.error)); }
    }

    /* Update case if linked */
    if (caseId) {
      var caseUpdate = await sb.from("inspection_cases").update({
        external_event_active: true,
        external_event_risk_score: riskScore,
        external_event_summary: parsed.eventTypes.join(", ") + " — " + Math.round(riskScore * 100) + "% risk"
      }).eq("id", caseId);
      if (caseUpdate.error) { console.log("WARNING: case update failed: " + JSON.stringify(caseUpdate.error)); }
    }

    /* Return */
    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        caseId: caseId,
        riskScore: riskScore,
        narrative: narrative,
        parsedEvent: parsed,
        predictedDamage: damage.slice(0, 10),
        inspectionTargets: targets.slice(0, 10),
        compoundEffects: compound,
        immediateActions: actions,
        warnings: warnings
      })
    };

  } catch (err: any) {
    console.log("run-external-event error: " + String(err));
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ error: "Internal error", detail: String(err) }) };
  }
};

export { handler };
