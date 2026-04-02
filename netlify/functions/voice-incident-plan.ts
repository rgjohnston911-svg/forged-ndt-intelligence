/**
 * DEPLOY66 — voice-incident-plan.ts v3
 * netlify/functions/voice-incident-plan.ts
 *
 * FULL REPLACEMENT of DEPLOY61v2
 *
 * v3 additions:
 *   - Reality Extraction with confirmed/inferred/unknown states
 *   - Unknown Critical Variables
 *   - Decision Trace ("why this plan")
 *   - Inline What-If scenarios (3 per plan)
 *   - Numeric risk_score
 *   - Method justification tags
 *   - Fixed impact_object bug (cargo ship no longer returns "vehicle")
 *
 * CONSTRAINT: String concatenation only — no backtick template literals
 */

import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

/* ========================================================================
   SPEECH CORRECTIONS
   ======================================================================== */

var SPEECH_CORRECTIONS: Array<{ wrong: string; right: string }> = [
  { wrong: "wins ", right: "winds " },
  { wrong: "win speed", right: "wind speed" },
  { wrong: "steady wins", right: "steady winds" },
  { wrong: "sustained wins", right: "sustained winds" },
  { wrong: "gus ", right: "gust " },
  { wrong: "hearicane", right: "hurricane" },
  { wrong: "hurrican ", right: "hurricane " },
  { wrong: "tornato", right: "tornado" },
  { wrong: "waives", right: "waves" },
  { wrong: "wave hight", right: "wave height" },
  { wrong: "serge", right: "surge" },
  { wrong: "currant", right: "current" },
  { wrong: "hale", right: "hail" },
  { wrong: "lightening", right: "lightning" },
  { wrong: "earthquak", right: "earthquake" },
  { wrong: "earth quake", right: "earthquake" },
  { wrong: "corrision", right: "corrosion" },
  { wrong: "corrotion", right: "corrosion" },
  { wrong: "corosion", right: "corrosion" },
  { wrong: "crake", right: "crack" },
  { wrong: "coading", right: "coating" },
  { wrong: "codeing", right: "coating" },
  { wrong: "coating lost", right: "coating loss" },
  { wrong: "marine grow", right: "marine growth" },
  { wrong: "bio fouling", right: "biofouling" },
  { wrong: "plat form", right: "platform" },
  { wrong: "pipe line", right: "pipeline" },
  { wrong: "presure", right: "pressure" },
  { wrong: "pressure vestle", right: "pressure vessel" },
  { wrong: "pressure vessle", right: "pressure vessel" },
  { wrong: "sadel", right: "saddle" },
  { wrong: "sadle", right: "saddle" },
  { wrong: "off shore", right: "offshore" },
  { wrong: "sub sea", right: "subsea" },
  { wrong: "splash own", right: "splash zone" },
  { wrong: "miles per hour", right: "mph" },
  { wrong: "mile per hour", right: "mph" },
  { wrong: "miles an hour", right: "mph" },
  { wrong: "mile an hour", right: "mph" },
  { wrong: "feet waves", right: "ft waves" },
  { wrong: "foot waves", right: "ft waves" },
  { wrong: "it's a stained", right: "it sustained" },
  { wrong: "its a stained", right: "it sustained" },
  { wrong: "a stained", right: "sustained" },
  { wrong: "debree", right: "debris" },
  { wrong: "impacked", right: "impacted" },
  { wrong: "ancor", right: "anchor" },
  { wrong: "leek", right: "leak" },
  { wrong: "weld too", right: "weld toe" },
];

function correctSpeechErrors(raw: string): string {
  var text = raw;
  for (var i = 0; i < SPEECH_CORRECTIONS.length; i++) {
    var idx = text.toLowerCase().indexOf(SPEECH_CORRECTIONS[i].wrong);
    while (idx !== -1) {
      text = text.substring(0, idx) + SPEECH_CORRECTIONS[i].right + text.substring(idx + SPEECH_CORRECTIONS[i].wrong.length);
      idx = text.toLowerCase().indexOf(SPEECH_CORRECTIONS[i].wrong, idx + SPEECH_CORRECTIONS[i].right.length);
    }
  }
  return text;
}

/* ========================================================================
   PARSER HELPERS
   ======================================================================== */

function lower(text: string): string { return text.toLowerCase().trim(); }

function includesAny(text: string, terms: string[]): boolean {
  for (var i = 0; i < terms.length; i++) { if (text.indexOf(terms[i]) !== -1) return true; }
  return false;
}

function findAllNumbersWithUnits(text: string): any {
  var result: any = { wind_mph: null, impact_speed_mph: null, wave_height_ft: null, seismic_magnitude: null, diameter_ft: null, diameter_in: null, vessel_length_ft: null };
  var match;

  var mphPattern = /(\d+(?:\.\d+)?)\s*(?:mph|mile)/gi;
  var mphMatches: Array<{ value: number; index: number }> = [];
  while ((match = mphPattern.exec(text)) !== null) {
    mphMatches.push({ value: parseFloat(match[1]), index: match.index });
  }

  var ftWavePattern = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:wave|waves|surge|swell)/gi;
  while ((match = ftWavePattern.exec(text)) !== null) { result.wave_height_ft = parseFloat(match[1]); }

  var diamFtPattern = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s*(?:diameter|wide|round)/gi;
  while ((match = diamFtPattern.exec(text)) !== null) { result.diameter_ft = parseFloat(match[1]); }

  var diamInPattern = /(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")\s/gi;
  while ((match = diamInPattern.exec(text)) !== null) { result.diameter_in = parseFloat(match[1]); }

  /* Vessel length: "200 ft cargo ship" or "200 foot vessel" */
  var vesselLen = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:cargo|ship|vessel|barge|tanker)/gi;
  while ((match = vesselLen.exec(text)) !== null) { result.vessel_length_ft = parseFloat(match[1]); }

  var lt = lower(text);
  for (var m = 0; m < mphMatches.length; m++) {
    var val = mphMatches[m].value;
    var nearby = text.substring(Math.max(0, mphMatches[m].index - 60), mphMatches[m].index + 20).toLowerCase();
    if (includesAny(nearby, ["wind", "winds", "tornado", "hurricane", "gust", "sustained", "steady"])) {
      result.wind_mph = val;
    } else if (includesAny(nearby, ["truck", "car", "vehicle", "hit", "struck", "traveling", "travelling", "speed", "impact"])) {
      result.impact_speed_mph = val;
    } else {
      if (mphMatches.length === 1 && includesAny(lt, ["wind", "winds", "tornado", "hurricane", "storm", "sustained", "steady"])) {
        result.wind_mph = val;
      } else if (mphMatches.length === 1 && includesAny(lt, ["hit", "struck", "truck", "car", "impact", "traveling"])) {
        result.impact_speed_mph = val;
      } else {
        if (val >= 40 && !result.wind_mph) result.wind_mph = val;
        else if (!result.impact_speed_mph) result.impact_speed_mph = val;
      }
    }
  }

  if (!result.wave_height_ft) {
    var ftFallback = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)/gi;
    while ((match = ftFallback.exec(text)) !== null) {
      var nearbyW = text.substring(Math.max(0, match.index - 40), match.index + 30).toLowerCase();
      if (includesAny(nearbyW, ["wave", "waves", "surge", "swell", "sea"])) {
        result.wave_height_ft = parseFloat(match[1]);
      }
    }
  }

  if (includesAny(lt, ["magnitude", "richter", "earthquake"])) {
    var seismic = /(\d+(?:\.\d+)?)\s*(?:magnitude)/gi;
    while ((match = seismic.exec(text)) !== null) { result.seismic_magnitude = parseFloat(match[1]); }
  }

  return result;
}

function inferAssetType(text: string): string {
  if (includesAny(text, ["bridge support", "bridge pier", "concrete support", "bridge column", "overpass"])) return "bridge_support";
  if (includesAny(text, ["gas pipeline", "pipeline", "gas line", "transmission line"])) return "gas_pipeline";
  /* FIXED: check rudder BEFORE generic ship to get correct component */
  if (includesAny(text, ["rudder"])) {
    if (includesAny(text, ["cargo ship", "ship", "vessel", "barge", "tanker"])) return "cargo_ship";
    return "cargo_ship";
  }
  if (includesAny(text, ["cargo ship", "ship", "vessel", "barge", "tanker"])) return "cargo_ship";
  if (includesAny(text, ["pressure vessel", "vessel shell", "saddle", "reactor vessel"])) return "pressure_vessel";
  if (includesAny(text, ["oil platform", "offshore platform", "platform", "jacket"])) return "offshore_platform";
  if (includesAny(text, ["brace", "node", "splash zone brace"])) return "platform_brace";
  if (includesAny(text, ["subsea pipeline", "subsea line"])) return "subsea_pipeline";
  if (includesAny(text, ["storage tank", "tank farm", "oil tank"])) return "storage_tank";
  if (includesAny(text, ["pipe rack", "piping", "process piping"])) return "piping";
  if (includesAny(text, ["dam", "spillway", "dam face"])) return "dam";
  if (includesAny(text, ["penstock"])) return "penstock";
  if (includesAny(text, ["lock gate", "lock chamber"])) return "lock_gate";
  if (includesAny(text, ["intake structure", "intake screen"])) return "intake_structure";
  if (includesAny(text, ["nuclear", "containment", "fuel pool"])) return "nuclear_component";
  if (includesAny(text, ["dock", "wharf", "pier", "bulkhead"])) return "dock_structure";
  if (includesAny(text, ["wind turbine", "monopile", "nacelle", "blade"])) return "wind_turbine";
  return "unknown_asset";
}

function inferIntakePath(text: string): string {
  if (includesAny(text, [
    "found", "observed", "noticed", "discovered", "diver found", "rov observed",
    "inspector found", "crack", "corrosion", "dent", "gouge",
    "leak", "staining", "coating loss", "wall loss", "marine growth"
  ])) return "condition_driven";
  return "event_driven";
}

function inferEventCategory(text: string, nums: any): string {
  var flags: string[] = [];
  if (includesAny(text, ["hit", "struck", "collision", "impact", "ran into", "fell on", "dropped", "unknown object", "anchor drag", "hits something"])) flags.push("impact");
  if (includesAny(text, ["tornado", "wind", "winds", "hurricane", "gust", "straight-line"])) flags.push("wind");
  if (includesAny(text, ["wave", "waves", "surge", "current", "sea state", "swell"])) flags.push("wave_surge");
  if (includesAny(text, ["flood", "rain", "inundation", "water intrusion"])) flags.push("rain_flood");
  if (includesAny(text, ["fire", "blast", "explosion", "overpressure"])) flags.push("fire_blast");
  if (includesAny(text, ["freeze", "cold snap", "ice storm"])) flags.push("extreme_cold");
  if (includesAny(text, ["extreme heat", "overheated"])) flags.push("extreme_heat");
  if (includesAny(text, ["earthquake", "ground movement", "subsidence", "seismic"])) flags.push("earthquake_ground_movement");
  if (includesAny(text, ["lightning", "electrical strike"])) flags.push("lightning_electrical");
  if (nums.wind_mph && nums.wind_mph > 0 && flags.indexOf("wind") === -1) flags.push("wind");
  if (nums.wave_height_ft && nums.wave_height_ft > 0 && flags.indexOf("wave_surge") === -1) flags.push("wave_surge");
  if (nums.impact_speed_mph && nums.impact_speed_mph > 0 && flags.indexOf("impact") === -1) flags.push("impact");
  if (flags.length > 1) return "multi_factor";
  if (flags.length === 1) return flags[0];
  return "unknown_event";
}

function inferFindingCategory(text: string): string {
  if (includesAny(text, ["corrosion", "pitting", "metal loss", "rust"])) return "corrosion";
  if (includesAny(text, ["crack", "linear indication", "fracture"])) return "crack_indication";
  if (includesAny(text, ["dent", "gouge", "impact mark"])) return "dent_gouge_impact";
  if (includesAny(text, ["coating loss", "coating failure"])) return "coating_failure";
  if (includesAny(text, ["section loss", "wall loss", "thinning"])) return "section_loss";
  if (includesAny(text, ["leak", "staining", "weeping"])) return "leak_or_staining";
  if (includesAny(text, ["support distress", "misalignment"])) return "support_distress";
  if (includesAny(text, ["marine growth", "biofouling", "obscured"])) return "marine_growth_obscured_condition";
  if (includesAny(text, ["cui", "corrosion under insulation"])) return "cui_suspected";
  if (includesAny(text, ["deformation", "bent", "buckled"])) return "deformation";
  if (includesAny(text, ["anode", "cp issue", "cathodic"])) return "anode_or_cp_issue";
  if (includesAny(text, ["suspected damage", "trouble"])) return "suspected_damage";
  return "unknown_condition";
}

/* ========================================================================
   REALITY EXTRACTION BUILDER
   ======================================================================== */

function buildRealityExtraction(text: string, parsed: any, nums: any): any {
  var asset: Array<{ label: string; value: string; state: string }> = [];
  var eventOrFinding: Array<{ label: string; value: string; state: string }> = [];
  var measured: Array<{ label: string; value: string; state: string }> = [];
  var environment: Array<{ value: string; state: string }> = [];
  var unknowns: string[] = [];

  /* Asset */
  asset.push({
    label: "Type",
    value: (parsed.asset_type || "unknown").replace(/_/g, " "),
    state: parsed.asset_type !== "unknown_asset" ? "confirmed" : "unknown"
  });
  if (parsed.component) {
    asset.push({
      label: "Component",
      value: parsed.component.replace(/_/g, " "),
      state: includesAny(text, [parsed.component.replace(/_/g, " ")]) ? "confirmed" : "inferred"
    });
  }
  if (nums.vessel_length_ft) {
    asset.push({ label: "Vessel Length", value: nums.vessel_length_ft + " ft", state: "confirmed" });
  }

  /* Event or Finding */
  if (parsed.intake_path === "event_driven") {
    eventOrFinding.push({
      label: "Type",
      value: (parsed.event_category || "unknown").replace(/_/g, " "),
      state: parsed.event_category !== "unknown_event" ? "confirmed" : "unknown"
    });
    if (parsed.impact_object) {
      var objState = "inferred";
      if (parsed.impact_object === "unknown_object") objState = "unknown";
      else if (includesAny(text, [parsed.impact_object])) objState = "confirmed";
      eventOrFinding.push({
        label: "Object",
        value: parsed.impact_object.replace(/_/g, " "),
        state: objState
      });
    }
  } else {
    eventOrFinding.push({
      label: "Type",
      value: (parsed.finding_category || "unknown").replace(/_/g, " "),
      state: parsed.finding_category !== "unknown_condition" ? "confirmed" : "unknown"
    });
  }

  /* Measured values */
  if (nums.wind_mph) {
    measured.push({ label: "Wind Speed", value: nums.wind_mph + " mph", state: "confirmed" });
  } else if (includesAny(text, ["wind", "winds", "tornado", "hurricane"])) {
    measured.push({ label: "Wind Speed", value: "Not provided", state: "unknown" });
    unknowns.push("Wind speed not specified");
  }

  if (nums.impact_speed_mph) {
    measured.push({ label: "Impact Speed", value: nums.impact_speed_mph + " mph", state: "confirmed" });
  } else if (includesAny(text, ["hit", "struck", "impact", "collision"])) {
    measured.push({ label: "Impact Speed", value: "Not provided", state: "unknown" });
    unknowns.push("Impact speed/energy not specified");
  }

  if (nums.wave_height_ft) {
    measured.push({ label: "Wave Height", value: nums.wave_height_ft + " ft", state: "confirmed" });
  } else if (includesAny(text, ["wave", "waves", "surge"])) {
    measured.push({ label: "Wave Height", value: "Not provided", state: "unknown" });
  }

  if (nums.diameter_ft) {
    measured.push({ label: "Diameter", value: nums.diameter_ft + " ft", state: "confirmed" });
  }
  if (nums.diameter_in) {
    measured.push({ label: "Diameter", value: nums.diameter_in + " in", state: "confirmed" });
  }

  /* Steering / operational indicators */
  if (includesAny(text, ["steering", "trouble steering", "troubles steering", "maneuver"])) {
    measured.push({ label: "Steering Issue", value: "Reported", state: "confirmed" });
  }
  if (includesAny(text, ["leak", "leaking"])) {
    measured.push({ label: "Leak", value: "Reported", state: "confirmed" });
  }

  /* Environment */
  for (var e = 0; e < (parsed.environment_context || []).length; e++) {
    var env = parsed.environment_context[e];
    environment.push({
      value: env.replace(/_/g, " "),
      state: includesAny(text, [env.replace(/_/g, " ").split(" ")[0].toLowerCase()]) ? "confirmed" : "inferred"
    });
  }

  /* Unknown critical variables */
  if (parsed.asset_type === "cargo_ship" || parsed.component === "rudder") {
    if (!includesAny(text, ["rudder", "hull", "propeller", "prop"])) unknowns.push("Affected component not confirmed");
    unknowns.push("Damage extent unknown");
    unknowns.push("Vessel condition (afloat/drydock) unknown");
    if (includesAny(text, ["unknown object"])) unknowns.push("Impact object identity unknown");
    unknowns.push("Secondary damage (prop/hull) unknown");
  }
  if (parsed.asset_type === "bridge_support") {
    if (!nums.impact_speed_mph) unknowns.push("Impact speed not confirmed");
    unknowns.push("Vehicle weight/class unknown");
    unknowns.push("Lateral displacement not confirmed");
    unknowns.push("Reinforcement condition unknown");
  }
  if (parsed.asset_type === "offshore_platform" || parsed.asset_type === "platform_brace") {
    unknowns.push("Member-level damage extent unknown");
    unknowns.push("Subsea condition not confirmed");
    if (!includesAny(text, ["debris"])) unknowns.push("Debris impact not confirmed");
  }
  if (parsed.asset_type === "gas_pipeline") {
    unknowns.push("Buried vs exposed status unknown");
    unknowns.push("Coating condition not confirmed");
    unknowns.push("Pressure integrity not confirmed");
  }

  return {
    asset: asset,
    event_or_finding: eventOrFinding,
    measured: measured,
    environment: environment,
    unknowns: unknowns,
  };
}

/* ========================================================================
   PARSER
   ======================================================================== */

function parseTranscript(rawText: string): any {
  var corrected = correctSpeechErrors(rawText);
  var text = lower(corrected);
  var intake = inferIntakePath(text);
  var asset = inferAssetType(text);
  var nums = findAllNumbersWithUnits(text);
  var eventCat = intake === "event_driven" ? inferEventCategory(text, nums) : null;
  var findCat = intake === "condition_driven" ? inferFindingCategory(text) : null;

  var component = null;
  if (includesAny(text, ["rudder"])) component = "rudder";
  else if (includesAny(text, ["bridge support"])) component = "bridge_support";
  else if (includesAny(text, ["pipeline"])) component = "pipeline";
  else if (includesAny(text, ["saddle"])) component = "saddle_region";
  else if (includesAny(text, ["brace"])) component = "brace";
  else if (includesAny(text, ["nozzle"])) component = "nozzle";
  else if (includesAny(text, ["support"])) component = "support";

  /* FIXED: impact object detection — ship/vessel context should NOT match "vehicle" */
  var impactObject = null;
  if (includesAny(text, ["truck"])) impactObject = "truck";
  else if (includesAny(text, ["car"]) && !includesAny(text, ["cargo"])) impactObject = "car";
  else if (includesAny(text, ["vehicle"]) && !includesAny(text, ["ship", "vessel", "cargo"])) impactObject = "vehicle";
  else if (includesAny(text, ["tree"])) impactObject = "tree";
  else if (includesAny(text, ["tornado"])) impactObject = "tornado";
  else if (includesAny(text, ["unknown object", "hits something", "hit something", "hit an unknown"])) impactObject = "unknown_object";
  else if (includesAny(text, ["anchor"])) impactObject = "anchor";
  else if (includesAny(text, ["debris"])) impactObject = "debris";

  var envContext: string[] = [];
  if (includesAny(text, ["underwater", "subsea", "diver", "rov"])) envContext.push("underwater");
  if (includesAny(text, ["bridge"])) envContext.push("civil_infrastructure");
  if (includesAny(text, ["gas pipeline", "pressurized"])) envContext.push("pressurized_service");
  if (includesAny(text, ["cargo ship", "ship", "vessel"])) envContext.push("marine_vessel");
  if (includesAny(text, ["offshore", "splash zone", "platform", "gulf"])) envContext.push("marine_exposure");
  if (includesAny(text, ["nuclear", "reactor", "fuel pool"])) envContext.push("nuclear");
  if (includesAny(text, ["dam", "penstock", "lock"])) envContext.push("freshwater_infrastructure");
  /* Infer underwater for ship/rudder */
  if ((asset === "cargo_ship" || component === "rudder") && envContext.indexOf("underwater") === -1) {
    envContext.push("underwater");
  }

  var missing: string[] = [];
  if (asset === "unknown_asset") missing.push("asset_type");
  if (intake === "event_driven" && eventCat === "unknown_event") missing.push("event_category");
  var conf = 88 - missing.length * 8;
  if (asset === "unknown_asset") conf -= 10;

  var parsed = {
    raw_text: rawText,
    corrected_text: corrected !== rawText ? corrected : null,
    intake_path: intake,
    asset_type: asset,
    component: component,
    event_category: eventCat,
    finding_category: findCat,
    impact_object: impactObject,
    measured_values: {
      wind_mph: nums.wind_mph || null,
      impact_speed_mph: nums.impact_speed_mph || null,
      wave_height_ft: nums.wave_height_ft || null,
      seismic_magnitude: nums.seismic_magnitude || null,
      vessel_length_ft: nums.vessel_length_ft || null,
    },
    dimensions: { diameter_ft: nums.diameter_ft || null, diameter_in: nums.diameter_in || null },
    environment_context: envContext,
    missing_inputs: missing,
    confidence: Math.max(0, Math.min(100, conf)),
    reality_extraction: null as any,
  };

  parsed.reality_extraction = buildRealityExtraction(text, parsed, nums);

  return parsed;
}

/* ========================================================================
   PLAN ENGINE
   ======================================================================== */

function buildPlan(p: any): any {
  var mech: string[] = [];
  var fail: string[] = [];
  var zones: string[] = [];
  var methods: Array<{ method: string; reason: string; priority: number; justification: string }> = [];
  var actions: string[] = [];
  var rat: string[] = [];
  var followUp: string[] = [];
  var decisionTrace: string[] = [];
  var whatIf: Array<{ scenario: string; risk_change: string; projected_severity: string; consequences: string[] }> = [];
  var severity = "moderate";
  var disp = "targeted_inspection";
  var riskScore = 40;

  var addM = function(m: string, r: string, pr: number, j: string) {
    for (var i = 0; i < methods.length; i++) {
      if (methods[i].method === m && methods[i].priority === pr) return;
    }
    methods.push({ method: m, reason: r, priority: pr, justification: j });
  };

  /* === BRIDGE SUPPORT IMPACT === */
  if (p.asset_type === "bridge_support" && p.event_category === "impact") {
    mech.push("localized_concrete_crushing", "spalling", "reinforcement_damage", "hidden_internal_cracking");
    fail.push("concrete_section_damage", "cover_loss", "reinforcement_distress");
    zones.push("direct_impact_zone", "full_circumference_near_impact", "vertical_zone_above_and_below", "foundation_interface", "adjacent_members");
    addM("VT", "Immediate damage mapping: cracking, spalling, impact zone.", 1, "First response method for all impact events");
    addM("Geometry Survey", "Check alignment and out-of-plumb condition.", 1, "Detects displacement invisible to naked eye");
    addM("Concrete Sounding", "Identify delaminated or hollow zones beyond visible damage.", 2, "Finds hidden voids behind intact surface");
    addM("Rebar Detection", "Map reinforcement condition if cover is compromised.", 2, "Required when spalling exposes or nears rebar");
    actions.push("Establish safety perimeter.", "Document impact elevation and vehicle size.", "Perform visual mapping before cleanup.", "Restrict loading until engineering review.");
    var spd = p.measured_values.impact_speed_mph || 0;
    riskScore = 55 + Math.min(spd * 0.4, 35);
    if (spd >= 70) { severity = "critical"; disp = "inspection_before_return"; actions.push("Escalate for urgent structural engineering review."); }
    else if (spd >= 50) { severity = "high"; disp = "restricted_operation"; }
    decisionTrace.push("Impact event on load-bearing infrastructure triggers high baseline severity.");
    if (spd > 0) decisionTrace.push("Impact speed " + spd + " mph elevates severity to " + severity + ".");
    decisionTrace.push("Bridge support is safety-critical: public traffic exposure.");
    decisionTrace.push("Geometry Survey prioritized because displacement may not be visible.");
    rat.push("High-speed vehicle impact creates damage beyond the visible crush zone.", "Concrete supports may have hidden cracking or rebar distress after major collision.");
    followUp.push("Was there visible spalling or exposed reinforcement?", "What was the vehicle weight/class?", "Which side was impacted?");
    whatIf.push(
      { scenario: "Wait 24 Hours", risk_change: "increases", projected_severity: "critical", consequences: ["Hidden cracking may propagate under traffic loading.", "Structural capacity unknown without assessment.", "Public safety exposure continues."] },
      { scenario: "Perform VT Only", risk_change: "increases", projected_severity: severity === "critical" ? "critical" : "high", consequences: ["Internal voids and rebar damage invisible to VT.", "Out-of-plumb condition may be missed.", "False confidence from clean surface appearance."] },
      { scenario: "Continue Normal Traffic", risk_change: "increases", projected_severity: "critical", consequences: ["Dynamic traffic loading may worsen hidden cracks.", "Sudden failure risk if section is compromised.", "Liability exposure without engineering assessment."] }
    );
  }

  /* === TORNADO / WIND OVER PIPELINE === */
  if (p.asset_type === "gas_pipeline" && (p.event_category === "wind" || p.event_category === "multi_factor")) {
    mech.push("debris_impact", "support_damage", "coating_damage", "bending_or_displacement", "third_party_contact");
    fail.push("coating_breach", "denting", "support_distress", "leak_risk");
    zones.push("exposed_segments", "supports_and_attachments", "road_crossings", "debris_contact_points", "valves_and_fittings");
    addM("VT", "Visible debris impact, coating damage, bending, support distress.", 1, "Fastest triage for scattered storm damage");
    addM("Drone VT", "Rapid corridor sweep if access area is broad or obstructed.", 1, "Covers miles of ROW faster than ground crew");
    addM("Leak Survey", "Verify no immediate containment issue.", 1, "Pressurized service: leak = immediate escalation");
    addM("UT", "Check suspect dents/gouges or local wall concerns.", 2, "Quantifies wall condition at damage locations");
    addM("Profile Measurement", "Measure denting or deformation geometry.", 2, "Dent depth drives code acceptability");
    var w = p.measured_values.wind_mph || 0;
    riskScore = 45 + Math.min(w * 0.3, 40);
    if (w >= 150) { severity = "critical"; disp = "restricted_operation"; actions.push("Escalate if any displacement, coating breach, or leak evidence."); }
    else if (w >= 100) { severity = "high"; disp = "priority_inspection_required"; }
    decisionTrace.push("Tornado/wind event over pressurized pipeline triggers elevated baseline.");
    if (w > 0) decisionTrace.push("Wind speed " + w + " mph recorded.");
    decisionTrace.push("Exposed segments and supports are primary damage targets.");
    decisionTrace.push("Leak Survey prioritized because pressurized gas = safety critical.");
    actions.push("Check for debris strikes and coating damage.", "Verify supports remain aligned.", "Perform leak screening if any impact signs.");
    rat.push("Extreme winds concentrate risk in exposed segments and debris strike locations.", "Tornado crossing a gas pipeline raises hidden damage concern even if line appears intact.");
    followUp.push("Is the line buried, exposed, or partially exposed?", "Were there debris strikes or support failures?", "Was any odor or pressure anomaly observed?");
    whatIf.push(
      { scenario: "Wait 7 Days", risk_change: "increases", projected_severity: severity === "critical" ? "critical" : "high", consequences: ["Coating damage allows corrosion initiation.", "Undetected dent under pressure cycles.", "Support distress may worsen."] },
      { scenario: "VT Only", risk_change: "increases", projected_severity: "high", consequences: ["Dent depth cannot be measured by VT.", "Wall loss under coating damage invisible.", "Internal deformation missed."] },
      { scenario: "Continue Operation Under Pressure", risk_change: "increases", projected_severity: "critical", consequences: ["Pressure cycling may grow undetected damage.", "Leak risk if wall is compromised.", "Regulatory exposure if not inspected."] }
    );
  }

  /* === CARGO SHIP / RUDDER === */
  if (p.asset_type === "cargo_ship" || p.component === "rudder") {
    mech.push("rudder_surface_damage", "rudder_stock_distress", "hidden_bending", "hydrodynamic_degradation");
    fail.push("rudder_deformation", "attachment_damage", "steering_loss", "crack_initiation");
    zones.push("rudder_leading_trailing_edges", "rudder_stock_connection", "hinge_regions", "adjacent_hull", "propeller_clearance_zone");
    addM("VT", "External inspection for dents, gouges, cracks, deformation.", 1, "First assessment of visible damage extent");
    addM("Diver VT", "Direct underwater confirmation of rudder condition.", 1, "Required because rudder is submerged component");
    addM("ROV VT", "Alternative underwater visual if diver access limited.", 1, "Pre-diver overview or poor-visibility alternative");
    addM("UT", "Check suspect thickness or internal concerns.", 2, "Quantifies hidden wall loss or deformation");
    addM("MT", "Surface crack screening at ferromagnetic components.", 2, "Detects crack initiation at stress concentrators");
    addM("Geometry Survey", "Assess alignment affecting steering.", 2, "Steering alignment risk requires measurement");
    actions.push("Document steering behavior and vibration.", "Inspect rudder and attachment before assuming surface-only damage.", "Escalate if maneuverability impaired.");
    riskScore = 72;
    severity = "high"; disp = "inspection_before_return";
    if (includesAny(lower(p.raw_text), ["trouble", "steering", "drift", "maneuver"])) {
      riskScore = 85;
      severity = "critical"; disp = "inspection_before_return";
      decisionTrace.push("Steering impairment reported: operational safety concern.");
    }
    decisionTrace.push("Rudder is safety-critical navigation component.");
    decisionTrace.push("Underwater component: Diver/ROV VT required for confirmation.");
    decisionTrace.push("Unknown impact object increases hidden damage uncertainty.");
    decisionTrace.push("Inspection before return: rudder affects vessel control.");
    rat.push("Underwater strike with rudder damage can involve hidden structural or alignment damage.", "Rudder damage is not cosmetic if steering may be affected.");
    followUp.push("Was there steering resistance or drift after impact?", "Is the vessel afloat or in drydock?", "Was the strike at the rudder or also hull/propeller?");
    whatIf.push(
      { scenario: "Wait 24 Hours", risk_change: "increases", projected_severity: "critical", consequences: ["Hidden rudder deformation may worsen under hydrodynamic load.", "Steering loss probability increases.", "If underway: risk of loss of control."] },
      { scenario: "Perform VT Only", risk_change: "increases", projected_severity: "high", consequences: ["Alignment issues not detectable by visual.", "Attachment damage at stock connection may be missed.", "Internal deformation invisible from surface."] },
      { scenario: "Continue Operation", risk_change: "increases", projected_severity: "critical", consequences: ["Hydrodynamic loading may worsen existing damage.", "Potential loss of maneuverability at worst time.", "Classification society and P&I exposure."] }
    );
  }

  /* === PRESSURE VESSEL IMPACT === */
  if (p.asset_type === "pressure_vessel" && (p.event_category === "impact" || p.impact_object === "tree")) {
    mech.push("localized_yielding", "shell_deformation", "saddle_overload", "coating_damage");
    fail.push("denting", "support_distress", "weld_toe_cracking");
    zones.push("impact_zone_shell", "saddle_region", "nozzle_connections", "adjacent_welds", "support_transitions");
    addM("VT", "Map dent geometry, strike marks, and coating damage.", 1, "Establishes visible damage boundaries");
    addM("Geometry Survey", "Check vessel alignment and saddle condition.", 1, "Saddle displacement changes load path");
    addM("UT", "Assess local wall condition at impact zone.", 2, "Quantifies remaining wall at deformation");
    addM("MT", "Crack screening at welds near impact zone.", 2, "Impact loading can initiate weld toe cracks");
    addM("Profile Measurement", "Measure dent depth and profile.", 2, "Dent profile drives ASME/API acceptability");
    actions.push("Remove debris before inspection if safe.", "Check saddle supports for displacement.", "Verify no pressure boundary compromise.");
    riskScore = 65;
    severity = "high"; disp = "priority_inspection_required";
    decisionTrace.push("Impact on pressure-retaining component triggers elevated severity.");
    decisionTrace.push("Saddle region concentrates stress during lateral impact.");
    decisionTrace.push("Pressure boundary integrity must be confirmed before return to service.");
    rat.push("Objects striking pressure vessels can cause hidden shell or weld damage beyond visible denting.", "Saddle regions concentrate stress during lateral impact.");
    followUp.push("Was the vessel pressurized at time of impact?", "Is any deformation visible?", "Are saddle supports intact?");
    whatIf.push(
      { scenario: "Wait 7 Days", risk_change: "increases", projected_severity: "critical", consequences: ["Pressure cycling on damaged shell.", "Crack initiation at stress concentrator.", "Corrosion at coating damage site."] },
      { scenario: "VT Only", risk_change: "increases", projected_severity: "high", consequences: ["Dent depth not quantified.", "Weld toe cracks invisible to VT.", "Shell deformation not profiled."] },
      { scenario: "Continue Operation Under Pressure", risk_change: "increases", projected_severity: "critical", consequences: ["Pressure cycling amplifies damage.", "Risk of through-wall progression.", "ASME/API compliance gap."] }
    );
  }

  /* === UNDERWATER CORROSION === */
  if (p.intake_path === "condition_driven" && (p.finding_category === "corrosion" || p.finding_category === "marine_growth_obscured_condition")) {
    mech.push("active_corrosion", "section_loss_progression", "hidden_damage_beneath_growth");
    fail.push("remaining_strength_reduction", "localized_wall_loss", "underestimated_extent");
    zones.push("primary_corrosion_zone", "adjacent_uncleaned_surface", "connected_members", "splash_zone");
    addM("Diver VT", "Map visible corrosion extent underwater.", 1, "Direct assessment at finding location");
    addM("Cleaning + Reinspect", "Marine growth obscures true condition.", 1, "HARD RULE: cleaning precedes NDE subsea");
    addM("Thickness Mapping", "Quantify actual metal loss over area.", 1, "Area mapping not single-point measurement");
    addM("UT", "Confirm remaining thickness.", 2, "Validates mapping at critical points");
    actions.push("Do not assume visible boundaries represent full extent.", "Clean and reinspect if growth present.", "Check CP status at finding location.");
    riskScore = 68;
    severity = "high"; disp = "priority_inspection_required";
    decisionTrace.push("Active corrosion finding on structural member.");
    decisionTrace.push("Marine growth present: true condition unknown until cleaned.");
    decisionTrace.push("Cleaning + Reinspect mandatory before confidence can be granted.");
    rat.push("Underwater corrosion often underrepresents true damage when growth or poor visibility is involved.", "HARD RULE: Cleaning always precedes quantitative NDE subsea.");
    followUp.push("Was marine growth present?", "Was cleaning performed before severity judgment?", "Is the member primary load-carrying?", "What is CP status?");
    whatIf.push(
      { scenario: "No Inspection", risk_change: "increases", projected_severity: "critical", consequences: ["Corrosion progression rate unknown.", "Section loss may exceed code limits.", "Member failure without warning."] },
      { scenario: "VT Only (No Cleaning)", risk_change: "increases", projected_severity: "high", consequences: ["Growth hides true corrosion boundaries.", "Pitting depth invisible.", "False confidence from clean-looking growth."] },
      { scenario: "Delay 30 Days", risk_change: "increases", projected_severity: "critical", consequences: ["Active corrosion does not pause.", "Section loss may progress beyond repair.", "CP degradation may accelerate."] }
    );
  }

  /* === CRACK FINDING === */
  if (p.intake_path === "condition_driven" && p.finding_category === "crack_indication") {
    mech.push("fatigue_cracking", "fracture_propagation", "environmental_cracking");
    fail.push("crack_growth_under_load", "through_wall_progression");
    zones.push("crack_origin_zone", "weld_toe_zone", "adjacent_member_transitions");
    addM("VT", "Map crack location, orientation, length.", 1, "Establishes crack geometry before sizing");
    addM("MT", "Surface crack screening at ferromagnetic weld zones.", 1, "Best surface crack detection for steel");
    addM("Cleaning + Reinspect", "Ensure surface is prepared for NDE.", 1, "Subsea: cleaning mandatory before NDE");
    addM("PAUT", "Characterize crack depth and through-wall extent.", 2, "Only method that sizes depth accurately");
    actions.push("Do not load-test or pressurize until crack is characterized.", "Document crack orientation relative to loading.");
    riskScore = 82;
    severity = "critical"; disp = "inspection_before_return";
    decisionTrace.push("Crack indication is highest-urgency finding type.");
    decisionTrace.push("Through-wall risk requires sizing before any operational decision.");
    decisionTrace.push("PAUT prioritized for depth characterization.");
    rat.push("Crack indications in loaded welded regions require elevated urgency and sizing.");
    followUp.push("Crack orientation relative to weld?", "Is the member under tension or cyclic loading?", "What material?");
    whatIf.push(
      { scenario: "Wait 24 Hours", risk_change: "increases", projected_severity: "critical", consequences: ["Crack may grow under service loading.", "Through-wall risk increases with time.", "Sudden failure possible."] },
      { scenario: "VT Only", risk_change: "increases", projected_severity: "critical", consequences: ["Crack depth unknown.", "Surface length does not indicate through-wall extent.", "Cannot determine remaining life."] },
      { scenario: "Continue Operation", risk_change: "increases", projected_severity: "critical", consequences: ["Cyclic loading is the primary crack growth driver.", "Every load cycle advances the crack front.", "Risk compounds exponentially."] }
    );
  }

  /* === OFFSHORE PLATFORM === */
  if ((p.asset_type === "offshore_platform" || p.asset_type === "platform_brace") && p.event_category) {
    if (methods.length === 0) {
      mech.push("lateral_overstress", "brace_fatigue", "coating_damage", "debris_impact");
      fail.push("connection_cracking", "brace_buckling");
      zones.push("splash_zone_braces", "node_joints", "windward_connections", "subsea_transitions");
      addM("VT", "Map visible damage to accessible members.", 1, "Baseline triage for all platform events");
      addM("Drone VT", "Rapid elevated inspection of topsides.", 1, "Covers inaccessible topsides quickly");
      addM("ROV VT", "Subsea overview before diver mobilization.", 1, "Risk-based pre-screening saves dive cost");
      addM("MT", "Crack screening at accessible welded connections.", 2, "Connections are primary failure initiation sites");
      addM("UT", "Assess suspect member conditions.", 2, "Quantifies wall condition at damage sites");
      actions.push("Prioritize splash zone and windward faces.", "Check all attachment and connection points.");
      var windV = p.measured_values.wind_mph || 0;
      var waveV = p.measured_values.wave_height_ft || 0;
      riskScore = 55 + Math.min(windV * 0.25, 25) + Math.min(waveV * 1.2, 20);
      if (windV >= 100 || waveV >= 25) { severity = "critical"; disp = "restricted_operation"; }
      else if (windV >= 74 || waveV >= 15) { severity = "high"; disp = "priority_inspection_required"; }
      decisionTrace.push("Storm event on offshore platform triggers multi-zone inspection.");
      if (windV > 0) decisionTrace.push("Wind: " + windV + " mph.");
      if (waveV > 0) decisionTrace.push("Waves: " + waveV + " ft.");
      decisionTrace.push("Splash zone is highest corrosion risk zone on any structure.");
      decisionTrace.push("Connections and nodes are primary fatigue initiation sites.");
      rat.push("Event loading on platforms concentrates at connections, nodes, and splash zone.");
      followUp.push("Was the event wind, wave, impact, or combination?", "Any visible member displacement?");
      whatIf.push(
        { scenario: "No Inspection", risk_change: "increases", projected_severity: "critical", consequences: ["Hidden connection damage progresses.", "Coating damage accelerates corrosion.", "Subsea condition unknown."] },
        { scenario: "Topside VT Only", risk_change: "increases", projected_severity: "high", consequences: ["Splash zone and subsea damage missed.", "Node joint condition unknown.", "Subsea coating damage undetected."] },
        { scenario: "Delay Until Next Scheduled", risk_change: "increases", projected_severity: "critical", consequences: ["Storm damage compounds with next event.", "Fatigue damage accumulates.", "Regulatory non-compliance risk."] }
      );
    }
  }

  /* === DAM / FRESHWATER === */
  if (p.asset_type === "dam" || p.asset_type === "penstock" || p.asset_type === "lock_gate" || p.asset_type === "intake_structure") {
    if (methods.length === 0) {
      mech.push("structural_deterioration", "scour", "seepage_progression", "concrete_degradation");
      fail.push("undermining", "concrete_spalling", "gate_seal_failure");
      zones.push("dam_face", "foundation_zone", "gate_seals", "spillway_area");
      addM("Diver VT", "Underwater visual of dam face and foundation.", 1, "Direct observation of submerged surfaces");
      addM("Dam Face Visual Survey", "Systematic grid survey.", 1, "Regulatory-compliant coverage method");
      addM("Concrete Sounding", "Identify delamination beyond visible damage.", 2, "Finds hollow zones behind intact surface");
      addM("Scour Survey", "Measure scour depth at foundation.", 2, "Foundation undermining is primary dam failure mode");
      actions.push("Check for seepage changes.", "Inspect gate seals and hinges.", "Document all concrete damage.");
      riskScore = 65;
      severity = "high"; disp = "priority_inspection_required";
      decisionTrace.push("Dam/hydro finding triggers elevated baseline due to consequence class.");
      decisionTrace.push("Foundation scour is primary failure mode for dams.");
      rat.push("Dam findings require immediate engineering assessment if high-hazard classification.");
      followUp.push("What is the dam hazard classification?", "Any seepage changes observed?", "Is FERC or USACE regulated?");
      whatIf.push(
        { scenario: "No Inspection", risk_change: "increases", projected_severity: "critical", consequences: ["Scour progression unknown.", "Seepage path may be active.", "Dam safety obligation unmet."] },
        { scenario: "Delay 30 Days", risk_change: "increases", projected_severity: "critical", consequences: ["Spring runoff may accelerate damage.", "Undermining may progress.", "Regulatory non-compliance."] },
        { scenario: "Visual Only (No Sounding)", risk_change: "increases", projected_severity: "high", consequences: ["Concrete delamination invisible from surface.", "Internal voids not detected.", "False confidence."] }
      );
    }
  }

  /* === GENERIC FALLBACK === */
  if (methods.length === 0) {
    mech.push("damage_not_fully_characterized");
    fail.push("hidden_damage_possible");
    zones.push("reported_zone", "adjacent_zone");
    addM("VT", "Start with visual mapping of reported area and adjacent zones.", 1, "Universal first response method");
    actions.push("Document the scene before any cleanup or load changes.");
    riskScore = 35;
    severity = "moderate"; disp = "targeted_inspection";
    decisionTrace.push("Generic plan: asset type does not match a specialized rule pack.");
    decisionTrace.push("VT is universal first-response method.");
    rat.push("Input was parsed but does not match a specialized rule pack yet.");
    followUp.push("What is the exact asset type?", "What is the affected component?");
    whatIf.push(
      { scenario: "No Inspection", risk_change: "increases", projected_severity: "high", consequences: ["Damage extent completely unknown.", "Hidden damage may progress.", "Liability exposure."] }
    );
  }

  for (var mi = 0; mi < (p.missing_inputs || []).length; mi++) {
    followUp.push("Provide or confirm: " + p.missing_inputs[mi]);
  }

  methods.sort(function(a, b) { return a.priority - b.priority; });

  var title = "Inspection Plan - " + (p.asset_type || "Unknown").replace(/_/g, " ");
  var summary = p.intake_path === "event_driven"
    ? "Event-driven inspection plan for " + (p.asset_type || "unknown").replace(/_/g, " ") + " based on spoken incident report."
    : "Condition-driven inspection plan for " + (p.asset_type || "unknown").replace(/_/g, " ") + " based on spoken finding report.";

  return {
    title: title,
    summary: summary,
    asset_type: p.asset_type,
    intake_path: p.intake_path,
    event_or_finding: p.raw_text,
    severity_band: severity,
    risk_score: Math.min(100, Math.max(0, Math.round(riskScore))),
    probable_damage_mechanisms: mech,
    likely_failure_modes: fail,
    prioritized_inspection_zones: zones,
    recommended_methods: methods,
    immediate_actions: actions,
    operational_disposition: disp,
    decision_trace: decisionTrace,
    what_if_scenarios: whatIf,
    rationale: rat,
    follow_up_questions: followUp,
  };
}

/* ========================================================================
   HANDLER
   ======================================================================== */

var handler: Handler = async function(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    var body = JSON.parse(event.body || "{}");
    var transcript = body.transcript;
    if (!transcript || !transcript.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "transcript is required" }) };
    }

    var parsed = parseTranscript(transcript);
    var plan = buildPlan(parsed);

    var dreResult = null;
    if (body.org_id && body.asset_id) {
      try {
        var supabase = getSupabase();
        var lt = lower(parsed.corrected_text || transcript);
        var record = {
          org_id: body.org_id,
          asset_id: body.asset_id,
          reported_by_user_id: body.user_id || null,
          intake_path: parsed.intake_path,
          source_type: "voice",
          title: plan.title,
          narrative: transcript,
          location_context: body.location_context || null,
          event_category: parsed.event_category || null,
          finding_category: parsed.finding_category || null,
          wind_mph: (parsed.measured_values || {}).wind_mph || null,
          impact_speed_mph: (parsed.measured_values || {}).impact_speed_mph || null,
          wave_height_ft: (parsed.measured_values || {}).wave_height_ft || null,
          seismic_magnitude: (parsed.measured_values || {}).seismic_magnitude || null,
          debris_present: includesAny(lt, ["debris"]),
          fire_exposure: includesAny(lt, ["fire", "blast"]),
          marine_growth_present: includesAny(lt, ["marine growth", "biofouling"]),
          crack_like_indication: includesAny(lt, ["crack"]),
          coating_loss_present: includesAny(lt, ["coating loss", "coating failure"]),
          deformation_present: includesAny(lt, ["deformation", "dent", "bent"]),
          wall_loss_suspected: includesAny(lt, ["wall loss", "section loss", "thinning"]),
          leak_evidence_present: includesAny(lt, ["leak", "weeping"]),
          raw_payload: { voice_transcript: transcript, corrected_text: parsed.corrected_text, parsed: parsed },
        };
        var insertRes = await supabase.from("damage_cases").insert(record).select("*").single();
        if (insertRes.data) {
          dreResult = { damage_case_id: insertRes.data.id, message: "Damage case created from voice input." };
        }
      } catch (e) { /* optional */ }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, parsed: parsed, plan: plan, dre_case: dreResult }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Unexpected error" }) };
  }
};

export { handler };
