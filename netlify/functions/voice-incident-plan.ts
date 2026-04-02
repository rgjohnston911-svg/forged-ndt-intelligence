/**
 * DEPLOY61v2 — voice-incident-plan.ts
 * netlify/functions/voice-incident-plan.ts
 *
 * Voice-to-Inspection Plan Engine
 * v2: Added speech-to-text error tolerance
 *   - Phonetic/typo correction map for common misheard words
 *   - Standalone mph/ft extraction without requiring keyword context
 *   - Multi-factor auto-detection when multiple numeric fields present
 *
 * POST { transcript, org_id?, asset_id? }
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
   SPEECH-TO-TEXT ERROR CORRECTION
   Common misheard words from browser SpeechRecognition
   ======================================================================== */

var SPEECH_CORRECTIONS: Array<{ wrong: string; right: string }> = [
  /* wind related */
  { wrong: "wins ", right: "winds " },
  { wrong: "win speed", right: "wind speed" },
  { wrong: "steady wins", right: "steady winds" },
  { wrong: "sustained wins", right: "sustained winds" },
  { wrong: "gus ", right: "gust " },
  { wrong: "gusts", right: "gusts" },
  { wrong: "hearicane", right: "hurricane" },
  { wrong: "hurrican ", right: "hurricane " },
  { wrong: "tornato", right: "tornado" },
  { wrong: "tornadoe", right: "tornado" },
  /* wave related */
  { wrong: "waives", right: "waves" },
  { wrong: "wave hight", right: "wave height" },
  { wrong: "serge", right: "surge" },
  { wrong: "currant", right: "current" },
  /* weather */
  { wrong: "hale", right: "hail" },
  { wrong: "lightening", right: "lightning" },
  { wrong: "lighting strike", right: "lightning strike" },
  { wrong: "earthquak", right: "earthquake" },
  { wrong: "earth quake", right: "earthquake" },
  /* inspection */
  { wrong: "corrision", right: "corrosion" },
  { wrong: "corrotion", right: "corrosion" },
  { wrong: "corosion", right: "corrosion" },
  { wrong: "pittin", right: "pitting" },
  { wrong: "crake", right: "crack" },
  { wrong: "fractur ", right: "fracture " },
  { wrong: "den ", right: "dent " },
  { wrong: "gouge", right: "gouge" },
  { wrong: "coading", right: "coating" },
  { wrong: "codeing", right: "coating" },
  { wrong: "coating lost", right: "coating loss" },
  { wrong: "marine grow", right: "marine growth" },
  { wrong: "by a fouling", right: "biofouling" },
  { wrong: "bio fouling", right: "biofouling" },
  /* assets */
  { wrong: "plat form", right: "platform" },
  { wrong: "pipe line", right: "pipeline" },
  { wrong: "presure", right: "pressure" },
  { wrong: "pressure vestle", right: "pressure vessel" },
  { wrong: "pressure vessle", right: "pressure vessel" },
  { wrong: "bridge support", right: "bridge support" },
  { wrong: "rudder", right: "rudder" },
  { wrong: "sadel", right: "saddle" },
  { wrong: "sadle", right: "saddle" },
  { wrong: "penstock", right: "penstock" },
  { wrong: "off shore", right: "offshore" },
  { wrong: "sub sea", right: "subsea" },
  { wrong: "splash own", right: "splash zone" },
  /* units */
  { wrong: "miles per hour", right: "mph" },
  { wrong: "mile per hour", right: "mph" },
  { wrong: "miles an hour", right: "mph" },
  { wrong: "mile an hour", right: "mph" },
  { wrong: "feet tall", right: "foot" },
  { wrong: "foot tall", right: "foot" },
  { wrong: "foot waves", right: "ft waves" },
  { wrong: "feet waves", right: "ft waves" },
  /* misc */
  { wrong: "it's a stained", right: "it sustained" },
  { wrong: "its a stained", right: "it sustained" },
  { wrong: "a stained", right: "sustained" },
  { wrong: "sustain ", right: "sustained " },
  { wrong: "debree", right: "debris" },
  { wrong: "debre", right: "debris" },
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
   PARSER
   ======================================================================== */

function lower(text: string): string { return text.toLowerCase().trim(); }

function includesAny(text: string, terms: string[]): boolean {
  for (var i = 0; i < terms.length; i++) {
    if (text.indexOf(terms[i]) !== -1) return true;
  }
  return false;
}

function findNumberBefore(text: string, units: string[]): number | undefined {
  for (var u = 0; u < units.length; u++) {
    var idx = text.indexOf(units[u]);
    if (idx === -1) continue;
    var before = text.substring(Math.max(0, idx - 30), idx).trim();
    var parts = before.split(/\s+/);
    for (var p = parts.length - 1; p >= 0; p--) {
      var cleaned = parts[p].replace(/[^0-9.]/g, "");
      if (cleaned.length > 0) {
        var num = parseFloat(cleaned);
        if (!isNaN(num) && num > 0) return num;
      }
    }
  }
  return undefined;
}

function findAllNumbersWithUnits(text: string): any {
  var result: any = { wind_mph: null, impact_speed_mph: null, wave_height_ft: null, seismic_magnitude: null, diameter_ft: null, diameter_in: null };

  /* Find all "NUMBER mph" patterns */
  var mphPattern = /(\d+(?:\.\d+)?)\s*(?:mph|mile)/gi;
  var mphMatches: Array<{ value: number; index: number }> = [];
  var match;
  while ((match = mphPattern.exec(text)) !== null) {
    mphMatches.push({ value: parseFloat(match[1]), index: match.index });
  }

  /* Find all "NUMBER ft/foot/feet" patterns for waves */
  var ftPattern = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s*(?:wave|waves|surge|swell)/gi;
  while ((match = ftPattern.exec(text)) !== null) {
    result.wave_height_ft = parseFloat(match[1]);
  }

  /* Find diameter patterns */
  var diamFtPattern = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s*(?:diameter|wide|round)/gi;
  while ((match = diamFtPattern.exec(text)) !== null) {
    result.diameter_ft = parseFloat(match[1]);
  }

  var diamInPattern = /(\d+(?:\.\d+)?)\s*(?:inch|inches|in|")\s/gi;
  while ((match = diamInPattern.exec(text)) !== null) {
    result.diameter_in = parseFloat(match[1]);
  }

  /* Assign mph values based on context */
  var lt = lower(text);
  for (var m = 0; m < mphMatches.length; m++) {
    var val = mphMatches[m].value;
    var nearby = text.substring(Math.max(0, mphMatches[m].index - 60), mphMatches[m].index + 20).toLowerCase();

    if (includesAny(nearby, ["wind", "winds", "tornado", "hurricane", "gust", "sustained", "steady"])) {
      result.wind_mph = val;
    } else if (includesAny(nearby, ["truck", "car", "vehicle", "hit", "struck", "traveling", "travelling", "speed", "impact"])) {
      result.impact_speed_mph = val;
    } else if (includesAny(nearby, ["ship", "vessel", "knot"])) {
      /* skip vessel speed for now */
    } else {
      /* If only one mph value and wind context exists anywhere, assign to wind */
      if (mphMatches.length === 1 && includesAny(lt, ["wind", "winds", "tornado", "hurricane", "storm", "sustained", "steady"])) {
        result.wind_mph = val;
      } else if (mphMatches.length === 1 && includesAny(lt, ["hit", "struck", "truck", "car", "impact", "traveling"])) {
        result.impact_speed_mph = val;
      } else {
        /* Assign to wind if > 40 (unlikely impact speed description for vehicles uses mph alone) */
        if (val >= 40 && !result.wind_mph) result.wind_mph = val;
        else if (!result.impact_speed_mph) result.impact_speed_mph = val;
      }
    }
  }

  /* Wave height fallback: "NUMBER ft" near wave-like words */
  if (!result.wave_height_ft) {
    var ftFallback = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)/gi;
    while ((match = ftFallback.exec(text)) !== null) {
      var nearbyWave = text.substring(Math.max(0, match.index - 40), match.index + 30).toLowerCase();
      if (includesAny(nearbyWave, ["wave", "waves", "surge", "swell", "sea", "water"])) {
        result.wave_height_ft = parseFloat(match[1]);
      }
    }
  }

  /* Diameter fallback for "NUMBER foot diameter" or "NUMBER ft of water" */
  if (!result.diameter_ft) {
    var ftDiam = /(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:diameter|of water|deep)/gi;
    while ((match = ftDiam.exec(text)) !== null) {
      result.diameter_ft = parseFloat(match[1]);
    }
  }

  /* Seismic */
  if (includesAny(lt, ["magnitude", "richter", "earthquake"])) {
    var seismic = /(\d+(?:\.\d+)?)\s*(?:magnitude)/gi;
    while ((match = seismic.exec(text)) !== null) {
      result.seismic_magnitude = parseFloat(match[1]);
    }
  }

  return result;
}

function inferAssetType(text: string): string {
  if (includesAny(text, ["bridge support", "bridge pier", "concrete support", "bridge column", "overpass"])) return "bridge_support";
  if (includesAny(text, ["gas pipeline", "pipeline", "gas line", "transmission line"])) return "gas_pipeline";
  if (includesAny(text, ["cargo ship", "ship", "vessel", "barge", "tanker"]) && includesAny(text, ["rudder"])) return "cargo_ship";
  if (includesAny(text, ["rudder"])) return "rudder";
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
  if (includesAny(text, ["cooling tower", "nuclear", "containment", "fuel pool"])) return "nuclear_component";
  if (includesAny(text, ["dock", "wharf", "pier", "bulkhead"])) return "dock_structure";
  if (includesAny(text, ["exchanger", "heat exchanger"])) return "exchanger";
  if (includesAny(text, ["column", "tower", "distillation"])) return "process_column";
  if (includesAny(text, ["wind turbine", "monopile", "nacelle", "blade"])) return "wind_turbine";
  return "unknown_asset";
}

function inferIntakePath(text: string): string {
  if (includesAny(text, [
    "found", "observed", "noticed", "discovered", "diver found", "rov observed",
    "inspector found", "suspected damage", "crack", "corrosion", "dent", "gouge",
    "leak", "staining", "coating loss", "wall loss", "marine growth"
  ])) return "condition_driven";
  return "event_driven";
}

function inferEventCategory(text: string, nums: any): string {
  var flags: string[] = [];
  if (includesAny(text, ["hit", "struck", "collision", "impact", "ran into", "fell on", "dropped", "unknown object", "anchor drag"])) flags.push("impact");
  if (includesAny(text, ["tornado", "wind", "winds", "hurricane", "gust", "straight-line"])) flags.push("wind");
  if (includesAny(text, ["wave", "waves", "surge", "current", "sea state", "swell"])) flags.push("wave_surge");
  if (includesAny(text, ["flood", "rain", "inundation", "water intrusion", "washout"])) flags.push("rain_flood");
  if (includesAny(text, ["fire", "blast", "explosion", "overpressure", "flash fire"])) flags.push("fire_blast");
  if (includesAny(text, ["freeze", "cold snap", "ice storm", "low temperature"])) flags.push("extreme_cold");
  if (includesAny(text, ["extreme heat", "overheated", "high temperature"])) flags.push("extreme_heat");
  if (includesAny(text, ["earthquake", "ground movement", "subsidence", "seismic"])) flags.push("earthquake_ground_movement");
  if (includesAny(text, ["lightning", "electrical strike"])) flags.push("lightning_electrical");

  /* Also check extracted numbers to infer categories */
  if (nums.wind_mph && nums.wind_mph > 0 && flags.indexOf("wind") === -1) flags.push("wind");
  if (nums.wave_height_ft && nums.wave_height_ft > 0 && flags.indexOf("wave_surge") === -1) flags.push("wave_surge");
  if (nums.impact_speed_mph && nums.impact_speed_mph > 0 && flags.indexOf("impact") === -1) flags.push("impact");
  if (nums.seismic_magnitude && nums.seismic_magnitude > 0 && flags.indexOf("earthquake_ground_movement") === -1) flags.push("earthquake_ground_movement");

  if (flags.length > 1) return "multi_factor";
  if (flags.length === 1) return flags[0];
  return "unknown_event";
}

function inferFindingCategory(text: string): string {
  if (includesAny(text, ["corrosion", "pitting", "metal loss", "rust"])) return "corrosion";
  if (includesAny(text, ["crack", "linear indication", "fracture", "toe crack"])) return "crack_indication";
  if (includesAny(text, ["dent", "gouge", "impact mark", "gouged"])) return "dent_gouge_impact";
  if (includesAny(text, ["coating loss", "coating failure", "disbondment"])) return "coating_failure";
  if (includesAny(text, ["section loss", "wall loss", "thinning"])) return "section_loss";
  if (includesAny(text, ["leak", "staining", "weeping"])) return "leak_or_staining";
  if (includesAny(text, ["support distress", "misalignment", "sagging"])) return "support_distress";
  if (includesAny(text, ["marine growth", "biofouling", "obscured"])) return "marine_growth_obscured_condition";
  if (includesAny(text, ["cui", "corrosion under insulation"])) return "cui_suspected";
  if (includesAny(text, ["deformation", "bent", "buckled", "out of plane"])) return "deformation";
  if (includesAny(text, ["anode", "cp issue", "cathodic"])) return "anode_or_cp_issue";
  if (includesAny(text, ["suspected damage"])) return "suspected_damage";
  return "unknown_condition";
}

function parseTranscript(rawText: string): any {
  /* Step 1: Correct common speech-to-text errors */
  var corrected = correctSpeechErrors(rawText);
  var text = lower(corrected);
  var intake = inferIntakePath(text);
  var asset = inferAssetType(text);

  /* Step 2: Extract all numeric values with smart context */
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

  var impactObject = null;
  if (includesAny(text, ["truck"])) impactObject = "truck";
  else if (includesAny(text, ["car", "vehicle"])) impactObject = "vehicle";
  else if (includesAny(text, ["tree"])) impactObject = "tree";
  else if (includesAny(text, ["tornado"])) impactObject = "tornado";
  else if (includesAny(text, ["ship", "barge"])) impactObject = "vessel";
  else if (includesAny(text, ["unknown object"])) impactObject = "unknown_object";
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

  var missing: string[] = [];
  if (asset === "unknown_asset") missing.push("asset_type");
  if (intake === "event_driven" && eventCat === "unknown_event") missing.push("event_category");
  var conf = 88 - missing.length * 8;
  if (asset === "unknown_asset") conf -= 10;

  /* Corrections applied flag */
  var corrections: string[] = [];
  if (corrected !== rawText) {
    corrections.push("Speech corrections applied");
  }

  return {
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
    },
    dimensions: {
      diameter_ft: nums.diameter_ft || null,
      diameter_in: nums.diameter_in || null,
    },
    environment_context: envContext,
    missing_inputs: missing,
    corrections: corrections,
    confidence: Math.max(0, Math.min(100, conf)),
  };
}

/* ========================================================================
   PLAN ENGINE
   ======================================================================== */

function buildPlan(p: any): any {
  var mech: string[] = [];
  var fail: string[] = [];
  var zones: string[] = [];
  var methods: Array<{ method: string; reason: string; priority: number }> = [];
  var actions: string[] = [];
  var rat: string[] = [];
  var followUp: string[] = [];
  var severity = "moderate";
  var disp = "targeted_inspection";

  var addM = function(m: string, r: string, pr: number) {
    for (var i = 0; i < methods.length; i++) {
      if (methods[i].method === m && methods[i].priority === pr) return;
    }
    methods.push({ method: m, reason: r, priority: pr });
  };

  /* === BRIDGE SUPPORT IMPACT === */
  if (p.asset_type === "bridge_support" && p.event_category === "impact") {
    mech.push("localized_concrete_crushing", "spalling", "reinforcement_damage", "hidden_internal_cracking");
    fail.push("concrete_section_damage", "cover_loss", "reinforcement_distress");
    zones.push("direct_impact_zone", "full_circumference_near_impact", "vertical_zone_above_and_below", "foundation_interface", "adjacent_members");
    addM("VT", "Immediate damage mapping: cracking, spalling, impact zone.", 1);
    addM("Geometry Survey", "Check alignment and out-of-plumb condition.", 1);
    addM("Concrete Sounding", "Identify delaminated or hollow zones beyond visible damage.", 2);
    addM("Rebar Detection", "Map reinforcement condition if cover is compromised.", 2);
    actions.push("Establish safety perimeter.", "Document impact elevation and vehicle size.", "Perform visual mapping before cleanup.");
    rat.push("High-speed vehicle impact creates damage beyond the visible crush zone.", "Concrete supports may have hidden cracking or rebar distress after major collision.");
    var spd = p.measured_values.impact_speed_mph || 0;
    if (spd >= 70) { severity = "critical"; disp = "inspection_before_return"; actions.push("Escalate for urgent structural engineering review."); }
    else if (spd >= 50) { severity = "high"; disp = "restricted_operation"; }
    followUp.push("Was there visible spalling or exposed reinforcement?", "What was the vehicle weight/class?", "Which side was impacted?");
  }

  /* === TORNADO / WIND OVER PIPELINE === */
  if (p.asset_type === "gas_pipeline" && (p.event_category === "wind" || p.event_category === "multi_factor")) {
    mech.push("debris_impact", "support_damage", "coating_damage", "bending_or_displacement", "third_party_contact");
    fail.push("coating_breach", "denting", "support_distress", "leak_risk");
    zones.push("exposed_segments", "supports_and_attachments", "road_crossings", "debris_contact_points", "valves_and_fittings");
    addM("VT", "Visible debris impact, coating damage, bending, support distress.", 1);
    addM("Drone VT", "Rapid corridor sweep if access area is broad or obstructed.", 1);
    addM("Leak Survey", "Verify no immediate containment issue.", 1);
    addM("UT", "Check suspect dents/gouges or local wall concerns.", 2);
    addM("Profile Measurement", "Measure denting or deformation geometry.", 2);
    actions.push("Check for debris strikes and coating damage.", "Verify supports remain aligned.", "Perform leak screening if any impact signs.");
    rat.push("Extreme winds concentrate risk in exposed segments and debris strike locations.", "Tornado crossing a gas pipeline raises hidden damage concern even if line appears intact.");
    var w = p.measured_values.wind_mph || 0;
    if (w >= 150) { severity = "critical"; disp = "restricted_operation"; actions.push("Escalate if any displacement, coating breach, or leak evidence."); }
    else if (w >= 100) { severity = "high"; disp = "priority_inspection_required"; }
    followUp.push("Is the line buried, exposed, or partially exposed?", "Were there debris strikes or support failures?", "Was any odor or pressure anomaly observed?");
  }

  /* === CARGO SHIP / RUDDER DAMAGE === */
  if (p.asset_type === "cargo_ship" || p.component === "rudder") {
    mech.push("rudder_surface_damage", "rudder_stock_distress", "hidden_bending", "hydrodynamic_degradation");
    fail.push("rudder_deformation", "attachment_damage", "steering_loss", "crack_initiation");
    zones.push("rudder_leading_trailing_edges", "rudder_stock_connection", "hinge_regions", "adjacent_hull", "propeller_clearance_zone");
    addM("VT", "External inspection for dents, gouges, cracks, deformation.", 1);
    addM("Diver VT", "Direct underwater confirmation of rudder condition.", 1);
    addM("ROV VT", "Alternative underwater visual if diver access limited.", 1);
    addM("UT", "Check suspect thickness or internal concerns.", 2);
    addM("MT", "Surface crack screening at ferromagnetic components.", 2);
    addM("Geometry Survey", "Assess alignment affecting steering.", 2);
    actions.push("Document steering behavior and vibration.", "Inspect rudder and attachment before assuming surface-only damage.", "Escalate if maneuverability impaired.");
    rat.push("Underwater strike with rudder damage can involve hidden structural or alignment damage.", "Rudder damage is not cosmetic if steering may be affected.");
    severity = "high"; disp = "inspection_before_return";
    followUp.push("Was there steering resistance or drift after impact?", "Is the vessel afloat or in drydock?", "Was the strike at the rudder or also hull/propeller?");
  }

  /* === PRESSURE VESSEL IMPACT === */
  if (p.asset_type === "pressure_vessel" && (p.event_category === "impact" || p.impact_object === "tree")) {
    mech.push("localized_yielding", "shell_deformation", "saddle_overload", "coating_damage");
    fail.push("denting", "support_distress", "weld_toe_cracking");
    zones.push("impact_zone_shell", "saddle_region", "nozzle_connections", "adjacent_welds", "support_transitions");
    addM("VT", "Map dent geometry, strike marks, and coating damage.", 1);
    addM("Geometry Survey", "Check vessel alignment and saddle condition.", 1);
    addM("UT", "Assess local wall condition at impact zone.", 2);
    addM("MT", "Crack screening at welds near impact zone.", 2);
    addM("Profile Measurement", "Measure dent depth and profile.", 2);
    actions.push("Remove debris before inspection if safe.", "Check saddle supports for displacement.", "Verify no pressure boundary compromise.");
    rat.push("Objects striking pressure vessels can cause hidden shell or weld damage beyond visible denting.", "Saddle regions concentrate stress during lateral impact.");
    severity = "high"; disp = "priority_inspection_required";
    followUp.push("Was the vessel pressurized at time of impact?", "Is any deformation visible at the impact zone?", "Are saddle supports intact?");
  }

  /* === UNDERWATER CORROSION === */
  if (p.intake_path === "condition_driven" && (p.finding_category === "corrosion" || p.finding_category === "marine_growth_obscured_condition")) {
    mech.push("active_corrosion", "section_loss_progression", "hidden_damage_beneath_growth");
    fail.push("remaining_strength_reduction", "localized_wall_loss", "underestimated_extent");
    zones.push("primary_corrosion_zone", "adjacent_uncleaned_surface", "connected_members", "splash_zone");
    addM("Diver VT", "Map visible corrosion extent underwater.", 1);
    addM("Cleaning + Reinspect", "Marine growth obscures true condition.", 1);
    addM("Thickness Mapping", "Quantify actual metal loss over area.", 1);
    addM("UT", "Confirm remaining thickness.", 2);
    actions.push("Do not assume visible boundaries represent full extent.", "Clean and reinspect if growth or fouling present.", "Check CP status at finding location.");
    rat.push("Underwater corrosion often underrepresents true damage when growth or poor visibility is involved.", "HARD RULE: Cleaning always precedes quantitative NDE subsea.");
    severity = "high"; disp = "priority_inspection_required";
    followUp.push("Was marine growth present?", "Was cleaning performed before severity judgment?", "Is the member primary load-carrying?", "What is CP status?");
  }

  /* === CRACK FINDING === */
  if (p.intake_path === "condition_driven" && p.finding_category === "crack_indication") {
    mech.push("fatigue_cracking", "fracture_propagation", "environmental_cracking");
    fail.push("crack_growth_under_load", "through_wall_progression");
    zones.push("crack_origin_zone", "weld_toe_zone", "adjacent_member_transitions");
    addM("VT", "Map crack location, orientation, length.", 1);
    addM("MT", "Surface crack screening at ferromagnetic weld zones.", 1);
    addM("Cleaning + Reinspect", "Ensure surface is prepared for NDE.", 1);
    addM("PAUT", "Characterize crack depth and through-wall extent.", 2);
    actions.push("Do not load-test or pressurize until crack is characterized.", "Document crack orientation relative to loading.");
    rat.push("Crack indications in loaded welded regions require elevated urgency and sizing.");
    severity = "critical"; disp = "inspection_before_return";
    followUp.push("What is the crack orientation relative to the weld?", "Is the member under tension or cyclic loading?", "What material?");
  }

  /* === OFFSHORE PLATFORM (event-driven with wind+wave) === */
  if ((p.asset_type === "offshore_platform" || p.asset_type === "platform_brace") && p.event_category) {
    if (methods.length === 0) {
      mech.push("lateral_overstress", "brace_fatigue", "coating_damage", "debris_impact");
      fail.push("connection_cracking", "brace_buckling");
      zones.push("splash_zone_braces", "node_joints", "windward_connections", "subsea_transitions");
      addM("VT", "Map visible damage to accessible members.", 1);
      addM("Drone VT", "Rapid elevated inspection of topsides.", 1);
      addM("ROV VT", "Subsea overview before diver mobilization.", 1);
      addM("MT", "Crack screening at accessible welded connections.", 2);
      addM("UT", "Assess suspect member conditions.", 2);
      actions.push("Prioritize splash zone and windward faces.", "Check all attachment and connection points.");
      rat.push("Event loading on platforms concentrates at connections, nodes, and splash zone.");
      severity = "high"; disp = "priority_inspection_required";

      /* Escalate based on extracted values */
      var windVal = p.measured_values.wind_mph || 0;
      var waveVal = p.measured_values.wave_height_ft || 0;
      if (windVal >= 100 || waveVal >= 25) { severity = "critical"; disp = "restricted_operation"; }
      else if (windVal >= 74 || waveVal >= 15) { severity = "high"; disp = "priority_inspection_required"; }

      followUp.push("Was the event wind, wave, impact, or combination?", "Any visible member displacement?");
    }
  }

  /* === DAM / FRESHWATER === */
  if (p.asset_type === "dam" || p.asset_type === "penstock" || p.asset_type === "lock_gate" || p.asset_type === "intake_structure") {
    if (methods.length === 0) {
      mech.push("structural_deterioration", "scour", "seepage_progression", "concrete_degradation");
      fail.push("undermining", "concrete_spalling", "gate_seal_failure");
      zones.push("dam_face", "foundation_zone", "gate_seals", "spillway_area");
      addM("Diver VT", "Underwater visual of dam face and foundation.", 1);
      addM("Dam Face Visual Survey", "Systematic grid survey for spalling, cracking, seepage.", 1);
      addM("Concrete Sounding", "Identify delamination beyond visible damage.", 2);
      addM("Scour Survey", "Measure scour depth at foundation.", 2);
      actions.push("Check for seepage changes.", "Inspect gate seals and hinges.", "Document all concrete damage.");
      rat.push("Dam findings require immediate engineering assessment if high-hazard classification.");
      severity = "high"; disp = "priority_inspection_required";
      followUp.push("What is the dam hazard classification?", "Any seepage changes observed?", "Is FERC or USACE regulated?");
    }
  }

  /* === GENERIC FALLBACK === */
  if (methods.length === 0) {
    mech.push("damage_not_fully_characterized");
    fail.push("hidden_damage_possible");
    zones.push("reported_zone", "adjacent_zone");
    addM("VT", "Start with visual mapping of reported area and adjacent zones.", 1);
    rat.push("Input was parsed but does not match a specialized rule pack yet.");
    actions.push("Document the scene before any cleanup or load changes.");
    followUp.push("What is the exact asset type?", "What is the affected component?");
    severity = "moderate"; disp = "targeted_inspection";
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
    probable_damage_mechanisms: mech,
    likely_failure_modes: fail,
    prioritized_inspection_zones: zones,
    recommended_methods: methods,
    immediate_actions: actions,
    operational_disposition: disp,
    rationale: rat,
    follow_up_questions: followUp,
    dre_intake_payload: {
      intake_path: p.intake_path,
      narrative: p.raw_text,
      event_category: p.event_category,
      finding_category: p.finding_category,
      source_type: "voice",
      wind_mph: (p.measured_values || {}).wind_mph || null,
      impact_speed_mph: (p.measured_values || {}).impact_speed_mph || null,
      wave_height_ft: (p.measured_values || {}).wave_height_ft || null,
      seismic_magnitude: (p.measured_values || {}).seismic_magnitude || null,
    },
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

    /* Optionally create damage case in DRE */
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
          dreResult = { damage_case_id: insertRes.data.id, message: "Damage case created from voice input. Run dre-run-evaluation for full DRE scoring." };
        }
      } catch (e) { /* DRE insert optional */ }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        parsed: parsed,
        plan: plan,
        dre_case: dreResult,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Unexpected error" }),
    };
  }
};

export { handler };
