/**
 * DEPLOY71 — Event Classification + Rule Pack Enrichment v1
 * netlify/functions/event-enrich.ts
 * 
 * Post-processor for voice-incident-plan output.
 * Takes the base plan + original transcript and:
 * 1. Classifies the event type with high confidence
 * 2. Applies asset-specific rule pack overrides
 * 3. Enforces minimum risk floors
 * 4. Adds missing methods, failure modes, zones
 * 5. Upgrades severity/disposition when warranted
 * 
 * DETERMINISTIC — no AI calls, millisecond execution.
 * String concatenation only — no backtick template literals.
 * All logic inlined — no lib/ imports.
 */

import { Handler } from "@netlify/functions";

// ============================================================
// EVENT CLASSIFICATION
// ============================================================

interface EventClassification {
  event_type: string;
  event_subtype: string;
  confidence: number;
  trigger_words_matched: string[];
  risk_floor: number;
  risk_floor_band: string;
  minimum_disposition: string;
}

interface RulePackOverride {
  rule_pack: string;
  additional_methods: any[];
  additional_failure_modes: string[];
  additional_damage_mechanisms: string[];
  additional_zones: string[];
  additional_immediate_actions: string[];
  additional_follow_up: string[];
  risk_adjustment: number;
  regulatory_references: string[];
}

interface EnrichmentOutput {
  event_classification: EventClassification;
  rule_pack_applied: RulePackOverride | null;
  enriched_plan: any;
  enrichment_notes: string[];
  enriched_at: string;
}

// Event trigger word maps
var EVENT_TRIGGERS: Record<string, { words: string[]; risk_floor: number; band: string; min_disp: string; subtype: string }> = {
  impact_vehicle: {
    words: ["truck", "vehicle", "car", "collision", "crashed", "struck", "hit", "slammed", "rammed", "18-wheeler", "semi", "trailer", "bus", "overpass", "barricade", "guardrail"],
    risk_floor: 60,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "vehicle_collision"
  },
  impact_object: {
    words: ["fell on", "dropped on", "tree fell", "crane", "dropped", "falling object", "debris struck", "impact", "struck by"],
    risk_floor: 50,
    band: "high",
    min_disp: "targeted_inspection",
    subtype: "object_impact"
  },
  impact_vessel: {
    words: ["ship hit", "vessel struck", "allision", "grounding", "ran aground", "berthing impact", "dock strike"],
    risk_floor: 55,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "vessel_collision"
  },
  storm_hurricane: {
    words: ["hurricane", "typhoon", "cyclone", "tropical storm", "category"],
    risk_floor: 75,
    band: "critical",
    min_disp: "restricted_operation",
    subtype: "hurricane"
  },
  storm_tornado: {
    words: ["tornado", "funnel cloud", "twister"],
    risk_floor: 70,
    band: "critical",
    min_disp: "restricted_operation",
    subtype: "tornado"
  },
  storm_wind: {
    words: ["high winds", "wind storm", "gust", "sustained winds", "wind damage", "mph wind"],
    risk_floor: 45,
    band: "moderate",
    min_disp: "targeted_inspection",
    subtype: "wind_event"
  },
  storm_flood: {
    words: ["flood", "flooding", "storm surge", "inundation", "water level", "submerged"],
    risk_floor: 55,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "flooding"
  },
  seismic: {
    words: ["earthquake", "seismic", "tremor", "aftershock", "magnitude", "richter"],
    risk_floor: 65,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "seismic_event"
  },
  fire: {
    words: ["fire", "blaze", "burned", "flames", "conflagration", "heat exposure", "thermal", "fire damage"],
    risk_floor: 60,
    band: "high",
    min_disp: "inspection_before_return",
    subtype: "fire_exposure"
  },
  explosion: {
    words: ["explosion", "blast", "detonation", "overpressure", "blowout", "rupture"],
    risk_floor: 80,
    band: "critical",
    min_disp: "shutdown_consideration",
    subtype: "explosion"
  },
  corrosion_active: {
    words: ["heavy corrosion", "severe corrosion", "wall loss", "pitting", "through-wall", "leak", "seepage", "weeping"],
    risk_floor: 50,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "active_corrosion"
  },
  corrosion_general: {
    words: ["corrosion", "rust", "oxidation", "coating failure", "coating damage", "marine growth", "disbondment"],
    risk_floor: 30,
    band: "moderate",
    min_disp: "targeted_inspection",
    subtype: "general_corrosion"
  },
  crack_found: {
    words: ["crack", "cracking", "fracture", "fissure", "linear indication", "crack-like"],
    risk_floor: 65,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "crack_indication"
  },
  fatigue: {
    words: ["fatigue", "cyclic", "vibration damage", "resonance", "oscillation"],
    risk_floor: 55,
    band: "high",
    min_disp: "priority_inspection_required",
    subtype: "fatigue_damage"
  },
  overload: {
    words: ["overload", "exceeded capacity", "over pressure", "overpressure", "exceeded design", "buckled", "deformed", "bent"],
    risk_floor: 60,
    band: "high",
    min_disp: "inspection_before_return",
    subtype: "overload"
  },
  erosion: {
    words: ["erosion", "scour", "undermining", "washout", "cavitation"],
    risk_floor: 45,
    band: "moderate",
    min_disp: "targeted_inspection",
    subtype: "erosion"
  },
  spalling: {
    words: ["spalling", "delamination", "concrete deterioration", "pop-out", "scaling", "concrete damage"],
    risk_floor: 40,
    band: "moderate",
    min_disp: "targeted_inspection",
    subtype: "concrete_deterioration"
  }
};

function classifyEvent(transcript: string): EventClassification {
  var lower = transcript.toLowerCase();
  var bestMatch = "";
  var bestScore = 0;
  var bestTriggers: string[] = [];

  var eventTypes = Object.keys(EVENT_TRIGGERS);
  for (var i = 0; i < eventTypes.length; i++) {
    var eventType = eventTypes[i];
    var config = EVENT_TRIGGERS[eventType];
    var matchCount = 0;
    var matched: string[] = [];

    for (var j = 0; j < config.words.length; j++) {
      if (lower.indexOf(config.words[j].toLowerCase()) >= 0) {
        matchCount++;
        matched.push(config.words[j]);
      }
    }

    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestMatch = eventType;
      bestTriggers = matched;
    }
  }

  if (bestMatch && bestScore > 0) {
    var cfg = EVENT_TRIGGERS[bestMatch];
    var confidence = Math.min(95, 50 + (bestScore * 15));
    return {
      event_type: bestMatch.split("_")[0],
      event_subtype: cfg.subtype,
      confidence: confidence,
      trigger_words_matched: bestTriggers,
      risk_floor: cfg.risk_floor,
      risk_floor_band: cfg.band,
      minimum_disposition: cfg.min_disp
    };
  }

  return {
    event_type: "unclassified",
    event_subtype: "unknown",
    confidence: 10,
    trigger_words_matched: [],
    risk_floor: 25,
    risk_floor_band: "low",
    minimum_disposition: "targeted_inspection"
  };
}

// ============================================================
// ASSET-SPECIFIC RULE PACKS
// ============================================================

function getBridgeCivilRulePack(eventClass: EventClassification, transcript: string): RulePackOverride {
  var lower = transcript.toLowerCase();
  var methods: any[] = [];
  var failureModes: string[] = [];
  var damageMechs: string[] = [];
  var zones: string[] = [];
  var actions: string[] = [];
  var followUp: string[] = [];
  var regulatory: string[] = [];
  var riskAdj = 0;

  // Base bridge methods
  methods.push({ method: "VT", priority: 1, reason: "Visual mapping of all visible damage, spalling, displacement, and cracking.", justification: "Universal first response" });
  methods.push({ method: "Hammer Sounding", priority: 1, reason: "Detect delamination and subsurface voids in concrete members.", justification: "Concrete integrity screening" });

  // Impact-specific
  if (eventClass.event_type === "impact") {
    methods.push({ method: "Crack Mapping", priority: 1, reason: "Document all crack patterns — radial, longitudinal, and transverse from impact zone.", justification: "Structural damage characterization" });
    methods.push({ method: "UT", priority: 2, reason: "Assess embedded steel reinforcement condition and concrete thickness at impact zone.", justification: "Subsurface damage quantification" });
    methods.push({ method: "Impact Echo", priority: 2, reason: "Detect internal voids, delamination, and honeycombing from impact energy.", justification: "Concrete internal integrity" });
    methods.push({ method: "GPR", priority: 2, reason: "Locate rebar position and detect rebar fracture or displacement within concrete.", justification: "Reinforcement condition assessment" });
    methods.push({ method: "Rebound Hammer", priority: 3, reason: "Assess concrete compressive strength at and around impact zone.", justification: "Material property verification" });

    failureModes = [
      "Shear cracking at impact zone",
      "Flexural cracking from lateral displacement",
      "Rebar fracture or yield",
      "Concrete spalling and delamination",
      "Load path redistribution",
      "Bearing damage at support",
      "Foundation displacement"
    ];

    damageMechs = [
      "Direct impact energy transfer",
      "Inertial loading from sudden deceleration",
      "Shear failure at column-to-cap connection",
      "Concrete crushing at impact point",
      "Rebar bond failure from concrete cracking"
    ];

    zones = [
      "Impact zone (direct contact area)",
      "Column above and below impact",
      "Column-to-cap beam connection",
      "Column-to-footing connection",
      "Adjacent spans (load redistribution)",
      "Bearing seats",
      "Deck above impact point"
    ];

    actions = [
      "Establish safety exclusion zone around damaged support",
      "Document scene with photographic evidence before any cleanup",
      "Assess immediate structural stability — check for visible displacement, lean, or settlement",
      "Restrict traffic loading if displacement or major cracking observed",
      "Notify bridge owner and structural engineer of record"
    ];

    followUp = [
      "What is the approximate impact speed?",
      "What is the vehicle weight class?",
      "Is there visible lateral displacement of the column?",
      "Is reinforcement (rebar) exposed at any point?",
      "Is there cracking in the cap beam or deck above?",
      "Is the column plumb or does it show lean?",
      "What is the column material — reinforced concrete, steel, or prestressed?"
    ];

    regulatory = ["AASHTO LRFD Bridge Design", "FHWA Bridge Inspection Manual", "NBIS (23 CFR 650)"];
    riskAdj = 20;
  }

  // Seismic
  if (eventClass.event_type === "seismic") {
    methods.push({ method: "Crack Mapping", priority: 1, reason: "Document all seismic-induced cracking patterns.", justification: "Post-earthquake assessment" });
    methods.push({ method: "UT", priority: 2, reason: "Check for internal damage to prestressed elements.", justification: "Tendon/strand integrity" });
    failureModes = ["Column plastic hinging", "Bearing unseating", "Abutment displacement", "Shear key failure", "Deck joint damage"];
    damageMechs = ["Cyclic lateral loading", "Foundation settlement", "Liquefaction effects"];
    zones = ["Column bases", "Column-cap connections", "Bearings", "Abutments", "Expansion joints"];
    regulatory = ["AASHTO Guide Specifications for Seismic Bridge Design", "Caltrans Seismic Design Criteria"];
    riskAdj = 15;
  }

  // Scour/erosion
  if (eventClass.event_type === "erosion" || lower.indexOf("scour") >= 0) {
    methods.push({ method: "Underwater VT", priority: 1, reason: "Assess foundation exposure and scour depth.", justification: "Foundation stability" });
    methods.push({ method: "Sonar / Bathymetry", priority: 2, reason: "Map scour hole geometry and depth.", justification: "Scour quantification" });
    failureModes = ["Foundation undermining", "Pier settlement", "Riprap displacement"];
    zones = ["Pier foundations", "Abutment foundations", "Channel bed", "Riprap protection"];
    regulatory = ["FHWA HEC-18 Scour Guidelines", "NBIS Underwater Inspection"];
    riskAdj = 10;
  }

  return {
    rule_pack: "bridge_civil_v1",
    additional_methods: methods,
    additional_failure_modes: failureModes,
    additional_damage_mechanisms: damageMechs,
    additional_zones: zones,
    additional_immediate_actions: actions,
    additional_follow_up: followUp,
    risk_adjustment: riskAdj,
    regulatory_references: regulatory
  };
}

function getPipelineRulePack(eventClass: EventClassification, transcript: string): RulePackOverride {
  var lower = transcript.toLowerCase();
  var methods: any[] = [];
  var failureModes: string[] = [];
  var damageMechs: string[] = [];
  var zones: string[] = [];
  var actions: string[] = [];
  var followUp: string[] = [];
  var regulatory: string[] = [];
  var riskAdj = 0;

  methods.push({ method: "VT", priority: 1, reason: "External visual assessment of coating, alignment, and surface condition.", justification: "Baseline surface assessment" });

  if (eventClass.event_type === "impact" || eventClass.event_type === "storm") {
    methods.push({ method: "UT Thickness", priority: 1, reason: "Quantify wall thickness at and around damage zone.", justification: "Wall integrity verification" });
    methods.push({ method: "MFL / Intelligent Pig", priority: 2, reason: "Full-length internal scanning for dents, gouges, and wall loss.", justification: "Comprehensive internal assessment" });
    methods.push({ method: "PAUT", priority: 2, reason: "Weld and HAZ examination at girth welds near damage.", justification: "Weld integrity under loading event" });
    methods.push({ method: "MT", priority: 2, reason: "Surface crack detection at dent/gouge locations.", justification: "Crack screening at stress concentrators" });
    methods.push({ method: "Strain Gauge", priority: 3, reason: "Measure residual strain from displacement or ground movement.", justification: "Deformation quantification" });

    failureModes = [
      "Dent with gouge (highest failure risk)",
      "Girth weld cracking from ground movement",
      "Coating damage exposing bare metal",
      "Ovality from lateral loading",
      "Support or anchor failure",
      "Leak at fitting or valve"
    ];

    damageMechs = [
      "Third-party mechanical damage",
      "Ground movement from weather event",
      "Hydrostatic pressure on buried pipe during flooding",
      "Fatigue at support points from vibration",
      "External corrosion at coating holiday"
    ];

    zones = [
      "Point of impact / closest approach",
      "Girth welds within 2 diameters of damage",
      "Coating damage area + 12 inches beyond",
      "Pipe supports and anchors",
      "Above-ground/below-ground transition",
      "Nearby valves and fittings"
    ];

    actions = [
      "Verify pipeline pressure and flow status",
      "Establish safety perimeter per pipeline emergency response plan",
      "Deploy leak detection (gas/hydrocarbon sensors)",
      "Notify pipeline control room and operations",
      "Restrict excavation near damage zone"
    ];

    followUp = [
      "What is the pipe diameter and wall thickness?",
      "What is the operating pressure?",
      "Is the product gas, liquid, or multiphase?",
      "Is there any visible coating damage?",
      "Is the pipe exposed or buried at the damage location?",
      "Any detected leaks or pressure changes?"
    ];

    regulatory = ["API 1104", "ASME B31.4 / B31.8", "PHMSA 49 CFR 192/195", "API 1160", "ASME B31G"];
    riskAdj = 15;
  }

  if (eventClass.event_type === "corrosion") {
    methods.push({ method: "UT Thickness Grid", priority: 1, reason: "Map remaining wall thickness over corroded area.", justification: "Corrosion rate determination" });
    methods.push({ method: "Pit Depth Gauge", priority: 1, reason: "Measure individual pit depths for ASME B31G assessment.", justification: "Pitting damage quantification" });
    methods.push({ method: "Holiday Detection", priority: 2, reason: "Assess coating integrity around corrosion area.", justification: "Corrosion cause identification" });
    failureModes = ["Through-wall leak from pitting", "Burst from general wall loss", "External corrosion at coating holiday"];
    damageMechs = ["External corrosion from coating failure", "Internal corrosion from product chemistry", "MIC (microbiologically influenced corrosion)"];
    zones = ["Corroded area + 24 inches beyond", "Low points (water accumulation)", "Soil-to-air interface", "Under pipe supports"];
    regulatory = ["API 570", "ASME B31G", "API 579-1 Part 4/5/6"];
    riskAdj = 10;
  }

  return {
    rule_pack: "pipeline_v1",
    additional_methods: methods,
    additional_failure_modes: failureModes,
    additional_damage_mechanisms: damageMechs,
    additional_zones: zones,
    additional_immediate_actions: actions,
    additional_follow_up: followUp,
    risk_adjustment: riskAdj,
    regulatory_references: regulatory
  };
}

function getPressureVesselRulePack(eventClass: EventClassification, transcript: string): RulePackOverride {
  var methods: any[] = [];
  var failureModes: string[] = [];
  var damageMechs: string[] = [];
  var zones: string[] = [];
  var actions: string[] = [];
  var followUp: string[] = [];
  var regulatory: string[] = [];
  var riskAdj = 0;

  methods.push({ method: "VT", priority: 1, reason: "External surface assessment for dents, bulging, coating damage, and distortion.", justification: "Baseline visual" });

  if (eventClass.event_type === "impact") {
    methods.push({ method: "UT Thickness", priority: 1, reason: "Measure wall thickness at impact point and surrounding area.", justification: "Impact damage assessment" });
    methods.push({ method: "MT", priority: 1, reason: "Crack detection at impact zone, welds, and nozzle connections.", justification: "Crack screening" });
    methods.push({ method: "PAUT", priority: 2, reason: "Weld examination at longitudinal and circumferential seams near impact.", justification: "Weld integrity" });

    failureModes = [
      "Shell denting with potential cracking",
      "Nozzle connection damage",
      "Saddle/support displacement",
      "Internal baffle or tray damage",
      "Weld cracking at stress concentration",
      "Insulation damage hiding corrosion"
    ];

    damageMechs = ["Direct impact loading", "Local stress concentration at dent", "Support overload from lateral force"];
    zones = ["Impact point + 2 feet radius", "Nearest welds (longitudinal and circumferential)", "Nozzle connections within impact zone", "Support saddles", "Foundation bolts"];
    actions = [
      "Verify vessel is depressurized or assess continued operation risk",
      "Inspect support saddles for displacement or bolt damage",
      "Check for insulation damage that could hide condition",
      "Measure dent depth if visible deformation present"
    ];
    followUp = [
      "Is the vessel pressurized or depressurized?",
      "What is the design pressure and current operating pressure?",
      "Is there visible shell distortion or denting?",
      "Are any nozzles or connections in the impact zone?",
      "What is the vessel contents — gas, liquid, or mixed?"
    ];
    regulatory = ["API 510", "ASME VIII Div 1", "API 579-1 Part 8 (Dents)", "NBIC Part 2 (Inspection)"];
    riskAdj = 15;
  }

  if (eventClass.event_type === "fire") {
    methods.push({ method: "UT Thickness", priority: 1, reason: "Assess wall thickness for thermal degradation.", justification: "Fire damage assessment" });
    methods.push({ method: "Hardness Testing", priority: 1, reason: "Detect metallurgical changes from heat exposure.", justification: "Material property verification" });
    methods.push({ method: "Metallographic Replication", priority: 2, reason: "Assess microstructure for heat-affected changes.", justification: "Creep/thermal damage" });

    failureModes = ["Metallurgical degradation", "Temper embrittlement", "Creep damage", "PRV failure to operate", "Shell distortion"];
    damageMechs = ["Thermal exposure above design temperature", "Loss of pressure relief", "Thermal gradient stress"];
    zones = ["Fire-impingement zone", "Upper shell (hot gas exposure)", "PRV and safety systems", "Support legs and skirt"];
    regulatory = ["API 579-1 Part 11 (Fire Damage)", "API 510", "ASME VIII"];
    riskAdj = 20;
  }

  return {
    rule_pack: "pressure_vessel_v1",
    additional_methods: methods,
    additional_failure_modes: failureModes,
    additional_damage_mechanisms: damageMechs,
    additional_zones: zones,
    additional_immediate_actions: actions,
    additional_follow_up: followUp,
    risk_adjustment: riskAdj,
    regulatory_references: regulatory
  };
}

function getMarineVesselRulePack(eventClass: EventClassification, transcript: string): RulePackOverride {
  var methods: any[] = [];
  var failureModes: string[] = [];

  methods.push({ method: "VT", priority: 1, reason: "Above-waterline visual assessment of hull, superstructure, and deck.", justification: "Baseline damage assessment" });
  methods.push({ method: "Underwater VT", priority: 1, reason: "Dive inspection of hull below waterline at impact/damage zone.", justification: "Below-waterline damage assessment" });
  methods.push({ method: "UT Thickness", priority: 1, reason: "Measure hull plating thickness at damage zone.", justification: "Structural integrity" });
  methods.push({ method: "MT", priority: 2, reason: "Crack detection at welds and high-stress areas near damage.", justification: "Crack screening" });

  failureModes = ["Hull breach", "Frame/stiffener buckling", "Rudder/propeller damage", "Steering gear misalignment", "Ballast tank compromise"];

  return {
    rule_pack: "marine_vessel_v1",
    additional_methods: methods,
    additional_failure_modes: failureModes,
    additional_damage_mechanisms: ["Impact loading", "Grounding forces", "Hydrodynamic overload"],
    additional_zones: ["Hull plating at impact", "Frames and stiffeners", "Rudder and stern gear", "Ballast tanks adjacent to damage"],
    additional_immediate_actions: ["Assess watertight integrity", "Check bilge and ballast levels", "Verify steering and propulsion"],
    additional_follow_up: ["Is the vessel taking on water?", "Is steering functional?", "What is the vessel draft before and after incident?"],
    risk_adjustment: 15,
    regulatory_references: ["SOLAS", "Class Society Rules (DNV/ABS/LR)", "USCG 46 CFR"]
  };
}

function getDamHydroRulePack(eventClass: EventClassification, transcript: string): RulePackOverride {
  var methods: any[] = [];

  methods.push({ method: "VT", priority: 1, reason: "Visual assessment of dam face, spillway, and visible structural elements.", justification: "Baseline condition" });
  methods.push({ method: "Underwater VT", priority: 1, reason: "Dive inspection of submerged dam face, foundation, and outlets.", justification: "Submerged condition assessment" });
  methods.push({ method: "Sonar / Bathymetry", priority: 2, reason: "Map scour and undermining at dam toe and foundation.", justification: "Scour quantification" });
  methods.push({ method: "Crack Mapping", priority: 2, reason: "Document all visible cracking on dam face and spillway.", justification: "Structural integrity" });
  methods.push({ method: "Seepage Monitoring", priority: 2, reason: "Quantify seepage flow rate and turbidity.", justification: "Internal erosion detection" });

  return {
    rule_pack: "dam_hydro_v1",
    additional_methods: methods,
    additional_failure_modes: ["Internal erosion / piping", "Foundation undermining", "Spillway erosion", "Gate malfunction", "Concrete deterioration", "Slope instability"],
    additional_damage_mechanisms: ["Hydraulic forces", "Seepage and piping", "Freeze-thaw cycling", "Alkali-silica reaction", "Scour"],
    additional_zones: ["Dam face (upstream and downstream)", "Foundation / toe", "Spillway", "Outlet works", "Abutments", "Seepage collection system"],
    additional_immediate_actions: ["Monitor reservoir level", "Assess seepage for turbidity or increased flow", "Check emergency action plan readiness"],
    additional_follow_up: ["Is there increased seepage downstream?", "Is seepage clear or turbid (carrying soil)?", "What is the current reservoir level vs normal?", "When was last formal inspection?"],
    risk_adjustment: 15,
    regulatory_references: ["FERC Part 12D", "USACE EM 1110-2-2100", "FEMA Dam Safety Guidelines", "State Dam Safety Regulations"]
  };
}

// ============================================================
// ASSET TYPE DETECTION
// ============================================================

function detectAssetClass(transcript: string, parsedAssetType: string): string {
  var lower = (transcript + " " + parsedAssetType).toLowerCase();

  if (lower.indexOf("bridge") >= 0 || lower.indexOf("overpass") >= 0 || lower.indexOf("viaduct") >= 0 || lower.indexOf("column") >= 0 || lower.indexOf("pier") >= 0 || lower.indexOf("abutment") >= 0) return "Bridge/Civil";
  if (lower.indexOf("pipeline") >= 0 || lower.indexOf("pipe") >= 0 || lower.indexOf("gas line") >= 0 || lower.indexOf("oil line") >= 0 || lower.indexOf("transmission line") >= 0) return "Pipeline";
  if (lower.indexOf("offshore") >= 0 || lower.indexOf("platform") >= 0 || lower.indexOf("jacket") >= 0 || lower.indexOf("riser") >= 0) return "Offshore";
  if (lower.indexOf("pressure vessel") >= 0 || lower.indexOf("reactor") >= 0 || lower.indexOf("heat exchanger") >= 0 || lower.indexOf("boiler") >= 0 || lower.indexOf("drum") >= 0) return "Refinery/Process";
  if (lower.indexOf("ship") >= 0 || lower.indexOf("vessel") >= 0 || lower.indexOf("hull") >= 0 || lower.indexOf("rudder") >= 0 || lower.indexOf("cargo") >= 0 || lower.indexOf("barge") >= 0) return "Marine Vessel";
  if (lower.indexOf("dam") >= 0 || lower.indexOf("spillway") >= 0 || lower.indexOf("hydro") >= 0 || lower.indexOf("reservoir") >= 0 || lower.indexOf("penstock") >= 0) return "Dam/Hydro";
  if (lower.indexOf("wind turbine") >= 0 || lower.indexOf("monopile") >= 0 || lower.indexOf("nacelle") >= 0 || lower.indexOf("blade") >= 0) return "Wind Energy";
  if (lower.indexOf("storage tank") >= 0 || lower.indexOf("tank farm") >= 0 || lower.indexOf("aboveground storage") >= 0) return "Storage/Terminal";
  if (lower.indexOf("nuclear") >= 0 || lower.indexOf("containment") >= 0) return "Nuclear";
  if (lower.indexOf("rail") >= 0 || lower.indexOf("track") >= 0 || lower.indexOf("railroad") >= 0) return "Rail";

  return "Other";
}

// ============================================================
// ENRICHMENT ENGINE
// ============================================================

function enrichPlan(transcript: string, basePlan: any, parsed: any): EnrichmentOutput {
  var notes: string[] = [];

  // Step 1: Classify event
  var eventClass = classifyEvent(transcript);
  notes.push("Event classified as: " + eventClass.event_type + " / " + eventClass.event_subtype + " (confidence: " + eventClass.confidence + "%)");

  // Step 2: Detect asset class
  var assetType = (parsed && parsed.asset_type) ? parsed.asset_type : "";
  var assetClass = detectAssetClass(transcript, assetType);
  notes.push("Asset class: " + assetClass);

  // Step 3: Get rule pack
  var rulePack: RulePackOverride | null = null;

  if (assetClass === "Bridge/Civil") {
    rulePack = getBridgeCivilRulePack(eventClass, transcript);
  } else if (assetClass === "Pipeline") {
    rulePack = getPipelineRulePack(eventClass, transcript);
  } else if (assetClass === "Refinery/Process") {
    rulePack = getPressureVesselRulePack(eventClass, transcript);
  } else if (assetClass === "Marine Vessel") {
    rulePack = getMarineVesselRulePack(eventClass, transcript);
  } else if (assetClass === "Dam/Hydro") {
    rulePack = getDamHydroRulePack(eventClass, transcript);
  }

  if (rulePack) {
    notes.push("Rule pack applied: " + rulePack.rule_pack);
  } else {
    notes.push("No specific rule pack — using event classification only");
  }

  // Step 4: Build enriched plan
  var enriched = JSON.parse(JSON.stringify(basePlan || {}));

  // Apply risk floor
  if (enriched.risk_score !== undefined && enriched.risk_score < eventClass.risk_floor) {
    notes.push("Risk score raised from " + enriched.risk_score + " to " + eventClass.risk_floor + " (event classification floor)");
    enriched.risk_score = eventClass.risk_floor;
  }

  // Apply risk adjustment from rule pack
  if (rulePack && rulePack.risk_adjustment > 0 && enriched.risk_score !== undefined) {
    var adjusted = Math.min(100, enriched.risk_score + rulePack.risk_adjustment);
    if (adjusted > enriched.risk_score) {
      notes.push("Risk score adjusted from " + enriched.risk_score + " to " + adjusted + " (" + rulePack.rule_pack + " adjustment)");
      enriched.risk_score = adjusted;
    }
  }

  // Update severity band based on final risk score
  var finalRisk = enriched.risk_score || 0;
  if (finalRisk >= 80) { enriched.severity_band = "critical"; }
  else if (finalRisk >= 60) { enriched.severity_band = "high"; }
  else if (finalRisk >= 35) { enriched.severity_band = "moderate"; }
  else { enriched.severity_band = "low"; }

  // Update disposition
  var dispOrder = ["continue_normal", "continue_with_monitoring", "targeted_inspection", "priority_inspection_required", "restricted_operation", "inspection_before_return", "shutdown_consideration"];
  var currentDispIdx = dispOrder.indexOf(enriched.operational_disposition || "");
  var minDispIdx = dispOrder.indexOf(eventClass.minimum_disposition);
  if (minDispIdx > currentDispIdx) {
    notes.push("Disposition upgraded from " + (enriched.operational_disposition || "none") + " to " + eventClass.minimum_disposition);
    enriched.operational_disposition = eventClass.minimum_disposition;
  }

  // Merge rule pack content
  if (rulePack) {
    // Methods — add new ones that don't already exist
    var existingMethods: string[] = [];
    if (enriched.recommended_methods) {
      for (var i = 0; i < enriched.recommended_methods.length; i++) {
        existingMethods.push((enriched.recommended_methods[i].method || "").toUpperCase());
      }
    } else {
      enriched.recommended_methods = [];
    }
    for (var i = 0; i < rulePack.additional_methods.length; i++) {
      var newMethod = rulePack.additional_methods[i];
      if (existingMethods.indexOf((newMethod.method || "").toUpperCase()) < 0) {
        enriched.recommended_methods.push(newMethod);
      }
    }

    // Failure modes
    if (!enriched.likely_failure_modes) enriched.likely_failure_modes = [];
    for (var i = 0; i < rulePack.additional_failure_modes.length; i++) {
      if (enriched.likely_failure_modes.indexOf(rulePack.additional_failure_modes[i]) < 0) {
        enriched.likely_failure_modes.push(rulePack.additional_failure_modes[i]);
      }
    }

    // Damage mechanisms
    if (!enriched.probable_damage_mechanisms) enriched.probable_damage_mechanisms = [];
    for (var i = 0; i < rulePack.additional_damage_mechanisms.length; i++) {
      if (enriched.probable_damage_mechanisms.indexOf(rulePack.additional_damage_mechanisms[i]) < 0) {
        enriched.probable_damage_mechanisms.push(rulePack.additional_damage_mechanisms[i]);
      }
    }

    // Zones
    if (!enriched.prioritized_inspection_zones) enriched.prioritized_inspection_zones = [];
    for (var i = 0; i < rulePack.additional_zones.length; i++) {
      if (enriched.prioritized_inspection_zones.indexOf(rulePack.additional_zones[i]) < 0) {
        enriched.prioritized_inspection_zones.push(rulePack.additional_zones[i]);
      }
    }

    // Immediate actions
    if (!enriched.immediate_actions) enriched.immediate_actions = [];
    for (var i = 0; i < rulePack.additional_immediate_actions.length; i++) {
      if (enriched.immediate_actions.indexOf(rulePack.additional_immediate_actions[i]) < 0) {
        enriched.immediate_actions.push(rulePack.additional_immediate_actions[i]);
      }
    }

    // Follow-up questions
    if (!enriched.follow_up_questions) enriched.follow_up_questions = [];
    for (var i = 0; i < rulePack.additional_follow_up.length; i++) {
      if (enriched.follow_up_questions.indexOf(rulePack.additional_follow_up[i]) < 0) {
        enriched.follow_up_questions.push(rulePack.additional_follow_up[i]);
      }
    }

    // Regulatory references
    enriched.regulatory_references = rulePack.regulatory_references;
  }

  // Fix event classification in parsed output
  var enrichedParsed = JSON.parse(JSON.stringify(parsed || {}));
  if (eventClass.event_type !== "unclassified") {
    enrichedParsed.event_category = eventClass.event_subtype;
    enrichedParsed.event_classification = eventClass;
  }
  enrichedParsed.asset_class = assetClass;

  return {
    event_classification: eventClass,
    rule_pack_applied: rulePack,
    enriched_plan: enriched,
    enrichment_notes: notes,
    enriched_at: new Date().toISOString()
  };
}

// ============================================================
// HANDLER
// ============================================================

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var transcript: string = body.transcript || "";
    var basePlan: any = body.plan || {};
    var parsed: any = body.parsed || {};

    var result = enrichPlan(transcript, basePlan, parsed);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Enrichment failed: " + (err.message || "unknown error") })
    };
  }
};

export { handler };
