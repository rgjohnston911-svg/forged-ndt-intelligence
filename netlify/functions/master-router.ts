/**
 * DEPLOY73 — Master Inspection Router v1
 * netlify/functions/master-router.ts
 * 
 * Universal intake router for ALL inspection contexts.
 * Four intake paths:
 *   1. scheduled_programmatic — annual, turnaround, RBI, compliance
 *   2. new_build_fabrication — construction, hold points, ITP
 *   3. event_driven — hurricane, impact, fire, explosion
 *   4. condition_driven — crack found, corrosion, leak, anomaly
 * 
 * Full implementation: Scheduled Inspection Intelligence Engine v1
 * Stub routes: new build, event, condition (hand off to existing engines)
 * 
 * POST /api/master-router
 * Body: { transcript: string }
 * Returns: { router, parsed_route, payload }
 * 
 * DETERMINISTIC — no AI calls, millisecond execution.
 * String concatenation only — no backtick template literals.
 * Architecture credit: GPT evaluation + Richard Johnston design
 */

import { Handler } from "@netlify/functions";

// ============================================================
// HELPERS
// ============================================================

function lwr(t: string): string { return (t || "").toLowerCase().trim(); }
function hasAny(t: string, items: string[]): boolean { for (var i = 0; i < items.length; i++) { if (t.indexOf(items[i]) !== -1) return true; } return false; }
function arrContains(items: string[], v: string): boolean { for (var i = 0; i < items.length; i++) { if (items[i] === v) return true; } return false; }
function uniq(items: string[]): string[] { var s: Record<string, boolean> = {}; var r: string[] = []; for (var i = 0; i < items.length; i++) { if (!s[items[i]]) { s[items[i]] = true; r.push(items[i]); } } return r; }

// ============================================================
// KEYWORD BANKS
// ============================================================

var SCHED_KW = ["annual inspection", "scheduled inspection", "routine inspection", "periodic inspection", "due for inspection", "inspection interval", "turnaround", "shutdown inspection", "rbi", "risk based inspection", "integrity program", "baseline inspection", "inspection of all components", "compliance inspection", "next inspection", "planned inspection"];
var BUILD_KW = ["new build", "fabrication", "construction", "during fabrication", "during construction", "fit-up", "hold point", "itp", "inspection test plan", "weld sequence", "pre-service", "final acceptance", "turnover", "shop fabrication", "field erection", "wps compliance"];
var EVENT_KW = ["hurricane", "impact", "truck hit", "collision", "storm", "earthquake", "tornado", "fell on", "ship hit", "struck", "blast", "fire event", "flood", "wave surge", "wind damage", "accident"];
var COND_KW = ["corrosion found", "crack found", "leak", "wall loss", "thinning", "deformation", "abnormal vibration", "hot spot", "coating damage", "pitting", "indication found", "defect found", "diver found corrosion", "suspected damage", "anomaly"];

// ============================================================
// ROUTE DETECTION
// ============================================================

function detectPath(t: string): string {
  var lo = lwr(t);
  if (hasAny(lo, SCHED_KW)) return "scheduled_programmatic";
  if (hasAny(lo, BUILD_KW)) return "new_build_fabrication";
  if (hasAny(lo, EVENT_KW)) return "event_driven";
  if (hasAny(lo, COND_KW)) return "condition_driven";
  return "unknown";
}

function detectProgType(t: string): string {
  var lo = lwr(t);
  if (hasAny(lo, ["annual", "yearly"])) return "annual";
  if (hasAny(lo, ["turnaround"])) return "turnaround";
  if (hasAny(lo, ["shutdown"])) return "shutdown";
  if (hasAny(lo, ["rbi", "risk based inspection"])) return "rbi_review";
  if (hasAny(lo, ["baseline"])) return "baseline_program";
  if (hasAny(lo, ["compliance"])) return "compliance_review";
  if (hasAny(lo, ["periodic"])) return "periodic";
  if (hasAny(lo, ["scheduled", "due for inspection", "planned inspection", "inspection interval"])) return "scheduled";
  return "unknown_program";
}

function classifyAsset(t: string): string {
  var lo = lwr(t);
  if (hasAny(lo, ["oil refinery", "refinery", "process unit", "petrochemical", "chemical plant"])) return "refinery_process_facility";
  if (hasAny(lo, ["pressure vessel", "separator", "reactor", "tower", "column", "drum"])) return "pressure_vessel";
  if (hasAny(lo, ["process piping", "piping", "pipe circuit"])) return "process_piping";
  if (hasAny(lo, ["storage tank", "tank farm", "tank"])) return "storage_tank";
  if (hasAny(lo, ["heat exchanger", "exchanger", "bundle", "shell and tube"])) return "heat_exchanger";
  if (hasAny(lo, ["boiler", "heater", "fired heater"])) return "boiler_heater";
  if (hasAny(lo, ["offshore platform", "platform", "jackup"])) return "offshore_platform";
  if (hasAny(lo, ["pipeline", "gas line", "pipe line"])) return "pipeline";
  if (hasAny(lo, ["bridge", "overpass", "civil structure"])) return "bridge_civil_structure";
  if (hasAny(lo, ["ship", "vessel", "cargo ship", "marine vessel", "hull", "rudder"])) return "marine_vessel";
  if (hasAny(lo, ["power plant", "turbine", "generation"])) return "power_generation";
  if (hasAny(lo, ["wastewater", "water plant"])) return "water_wastewater";
  if (hasAny(lo, ["steel structure", "structural steel", "pipe rack"])) return "structural_steel";
  return "unknown_asset";
}

function routeConfidence(path: string, asset: string, prog: string | null): number {
  var s = 45;
  if (path !== "unknown") s += 20;
  if (asset !== "unknown_asset") s += 20;
  if (prog && prog !== "unknown_program") s += 10;
  return Math.min(95, s);
}

function routeKeywords(t: string): string[] {
  var lo = lwr(t);
  var out: string[] = [];
  var all = SCHED_KW.concat(BUILD_KW).concat(EVENT_KW).concat(COND_KW);
  for (var i = 0; i < all.length; i++) { if (lo.indexOf(all[i]) !== -1) out.push(all[i]); }
  if (lo.indexOf("refinery") !== -1) out.push("refinery");
  if (lo.indexOf("annual") !== -1) out.push("annual");
  if (lo.indexOf("inspection") !== -1) out.push("inspection");
  return uniq(out);
}

function routeUnknowns(path: string, asset: string, t: string): string[] {
  var lo = lwr(t);
  var out: string[] = [];
  if (asset === "unknown_asset") out.push("Exact asset type not confirmed");
  if (path === "unknown") out.push("Inspection context not clearly identified");
  if (path === "scheduled_programmatic") {
    if (!hasAny(lo, ["pressure vessel", "piping", "tank", "exchanger", "heater", "all components", "offshore", "pipeline"])) out.push("Exact component scope not confirmed");
    if (!hasAny(lo, ["service", "history", "corrosion", "repair", "thinning", "interval"])) out.push("Service and inspection history not confirmed");
  }
  return out;
}

// ============================================================
// SCHEDULED ENGINE — Component detection
// ============================================================

function schedComponents(asset: string, t: string): string[] {
  var lo = lwr(t);
  var out: string[] = [];
  if (asset === "refinery_process_facility") { out.push("pressure_vessel"); out.push("process_piping"); out.push("storage_tank"); out.push("heat_exchanger"); out.push("relief_device"); out.push("structural_support"); }
  if (asset === "offshore_platform") { out.push("platform_member"); out.push("structural_support"); out.push("subsea_component"); out.push("process_piping"); out.push("pressure_vessel"); }
  if (asset === "pipeline") out.push("process_piping");
  if (asset === "bridge_civil_structure") { out.push("bridge_member"); out.push("structural_support"); }
  if (asset === "pressure_vessel") out.push("pressure_vessel");
  if (asset === "process_piping") out.push("process_piping");
  if (asset === "storage_tank") out.push("storage_tank");
  if (asset === "heat_exchanger") out.push("heat_exchanger");
  if (asset === "boiler_heater") { out.push("boiler"); out.push("fired_heater"); }
  if (asset === "structural_steel") out.push("structural_support");
  if (hasAny(lo, ["pressure vessel", "separator", "reactor", "tower", "column", "drum"])) out.push("pressure_vessel");
  if (hasAny(lo, ["piping", "line", "circuit"])) out.push("process_piping");
  if (hasAny(lo, ["tank"])) out.push("storage_tank");
  if (hasAny(lo, ["exchanger"])) out.push("heat_exchanger");
  if (hasAny(lo, ["heater"])) out.push("fired_heater");
  if (hasAny(lo, ["boiler"])) out.push("boiler");
  if (hasAny(lo, ["relief", "psv", "prv"])) out.push("relief_device");
  if (hasAny(lo, ["support", "pipe rack", "steel"])) out.push("structural_support");
  if (hasAny(lo, ["subsea"])) out.push("subsea_component");
  if (out.length === 0) out.push("unknown_component");
  return uniq(out);
}

function schedServiceSignals(t: string, asset: string): string[] {
  var lo = lwr(t);
  var out: string[] = [];
  if (hasAny(lo, ["high temperature", "hot service", "heater"])) out.push("high_temperature_service");
  if (hasAny(lo, ["sour", "h2s"])) out.push("wet_h2s_service");
  if (hasAny(lo, ["caustic"])) out.push("caustic_service");
  if (hasAny(lo, ["chloride"])) out.push("chloride_service");
  if (hasAny(lo, ["hydrogen"])) out.push("hydrogen_service");
  if (hasAny(lo, ["insulated", "insulation", "cui"])) out.push("insulated_equipment");
  if (hasAny(lo, ["corrosion", "wall loss", "thinning"])) out.push("known_corrosion_history");
  if (hasAny(lo, ["vibration"])) out.push("vibration_history");
  if (hasAny(lo, ["cyclic", "startup", "shutdown"])) out.push("cyclic_operation");
  if (hasAny(lo, ["marine", "salt", "offshore", "splash zone"])) out.push("marine_exposure");
  if (asset === "offshore_platform") out.push("marine_exposure");
  return uniq(out);
}

function schedDegradation(svc: string[], comps: string[], asset: string): string[] {
  var out: string[] = ["general_corrosion", "localized_corrosion"];
  if (arrContains(svc, "insulated_equipment")) out.push("cui");
  if (arrContains(svc, "high_temperature_service")) out.push("creep");
  if (arrContains(svc, "wet_h2s_service")) out.push("wet_h2s_damage");
  if (arrContains(svc, "caustic_service")) out.push("caustic_cracking");
  if (arrContains(svc, "chloride_service")) out.push("chloride_scc");
  if (arrContains(svc, "hydrogen_service")) out.push("hydrogen_damage");
  if (arrContains(svc, "vibration_history")) out.push("vibration_fatigue");
  if (arrContains(svc, "cyclic_operation")) out.push("thermal_fatigue");
  if (arrContains(svc, "marine_exposure")) { out.push("marine_corrosion"); out.push("coating_breakdown"); }
  if (arrContains(comps, "process_piping")) out.push("erosion_corrosion");
  if (arrContains(comps, "heat_exchanger")) out.push("erosion");
  if (arrContains(comps, "pressure_vessel")) out.push("fatigue");
  if (arrContains(comps, "platform_member") || asset === "offshore_platform") { out.push("splash_zone_attack"); out.push("fatigue"); }
  return uniq(out);
}

// ============================================================
// SCHEDULED ENGINE — Authority
// ============================================================

function authFor(ct: string, asset: string): string[] {
  if (ct === "pressure_vessel") return ["API 510", "API 580", "API 581", "ASME Section V", "ASME VIII", "Plant Procedure"];
  if (ct === "process_piping" || ct === "pump_compressor_piping") return ["API 570", "API 580", "API 581", "ASME Section V", "Plant Procedure"];
  if (ct === "storage_tank") return ["API 653", "API 580", "API 581", "ASME Section V", "Plant Procedure"];
  if (ct === "heat_exchanger" || ct === "fired_heater" || ct === "boiler") return ["API 510", "API 580", "API 581", "ASME Section V", "Plant Procedure"];
  if (ct === "structural_support" || ct === "bridge_member") return ["AWS D1.1", "Plant Procedure"];
  if (ct === "platform_member" || ct === "subsea_component") return ["API RP 2A", "ASME Section V", "Plant Procedure"];
  if (ct === "relief_device") return ["Plant Procedure", "API 580"];
  return ["Plant Procedure"];
}

// ============================================================
// SCHEDULED ENGINE — Priority
// ============================================================

function schedPriority(ct: string, deg: string[], svc: string[], prog: string, asset: string): string {
  var s = 0;
  if (ct === "pressure_vessel" || ct === "process_piping" || ct === "heat_exchanger" || ct === "fired_heater" || ct === "boiler" || ct === "platform_member" || ct === "subsea_component") s += 2;
  if (ct === "storage_tank" || ct === "bridge_member" || ct === "structural_support") s += 1;
  if (arrContains(deg, "cui")) s += 2;
  if (arrContains(deg, "wet_h2s_damage")) s += 2;
  if (arrContains(deg, "chloride_scc")) s += 2;
  if (arrContains(deg, "caustic_cracking")) s += 2;
  if (arrContains(deg, "hydrogen_damage")) s += 2;
  if (arrContains(deg, "creep")) s += 2;
  if (arrContains(deg, "erosion_corrosion")) s += 1;
  if (arrContains(deg, "thermal_fatigue")) s += 1;
  if (arrContains(deg, "vibration_fatigue")) s += 1;
  if (arrContains(deg, "marine_corrosion")) s += 1;
  if (arrContains(deg, "splash_zone_attack")) s += 2;
  if (arrContains(svc, "high_temperature_service")) s += 1;
  if (arrContains(svc, "wet_h2s_service")) s += 1;
  if (arrContains(svc, "hydrogen_service")) s += 1;
  if (arrContains(svc, "known_corrosion_history")) s += 2;
  if (arrContains(svc, "marine_exposure")) s += 1;
  if (prog === "turnaround" || prog === "shutdown") s += 1;
  if (prog === "rbi_review") s += 1;
  if (asset === "offshore_platform") s += 1;
  if (s >= 8) return "critical";
  if (s >= 5) return "high";
  if (s >= 3) return "moderate";
  return "low";
}

// ============================================================
// SCHEDULED ENGINE — Method cards
// ============================================================

function schedMethods(ct: string, deg: string[], pri: string, asset: string): any[] {
  var m: any[] = [];
  function add(method: string, p: string, rat: string, tgt: string[], auth: string[]) { m.push({ method: method, priority: p, rationale: rat, targets: tgt, authority: auth }); }

  add("Review Records", "P1", "Establish prior history, thickness trends, repairs, and interval basis before scope lock.", ["history", "previous findings", "remaining life"], ["API 580", "API 581", "Plant Procedure"]);
  add("External Visual", "P1", "Baseline screen for leaks, corrosion, distortion, coating failure, support condition.", ["external condition", "leaks", "coatings"], authFor(ct, asset));

  if (ct === "pressure_vessel" || ct === "process_piping" || ct === "heat_exchanger" || ct === "boiler" || ct === "fired_heater" || ct === "subsea_component") {
    add("UT", "P1", "Primary wall condition and thickness assessment.", ["shells", "heads", "lines", "wall loss areas"], authFor(ct, asset));
    add("Thickness Monitoring", "P1", "TML trending to compare with historical rates.", ["TML points", "corrosion circuits"], ["API 510", "API 570", "API 580", "Plant Procedure"]);
  }
  if (ct === "storage_tank") {
    add("UT", "P1", "Assess shell and critical tank zones.", ["shell courses", "floor regions"], authFor(ct, asset));
    add("MFL", "P2", "Tank floor screening for bottom-side corrosion.", ["tank floors"], ["API 653", "Plant Procedure"]);
  }
  if (ct === "heat_exchanger") {
    add("IRIS", "P2", "Tube inspection for exchanger tube wall condition.", ["tube bundles"], authFor(ct, asset));
  }
  if (arrContains(deg, "cui")) {
    add("CUI Screening", "P1", "Targeted CUI screening before broader scope.", ["insulated piping", "insulated vessels"], authFor(ct, asset));
  }
  if (arrContains(deg, "fatigue") || arrContains(deg, "thermal_fatigue") || arrContains(deg, "vibration_fatigue") || arrContains(deg, "chloride_scc") || arrContains(deg, "caustic_cracking") || arrContains(deg, "wet_h2s_damage")) {
    add("MT", "P2", "Surface crack screening at welds, attachments, nodes.", ["weld toes", "attachments", "nozzles"], authFor(ct, asset));
    add("PT", "P2", "Alternative crack screening for nonmagnetic surfaces.", ["surface cracks", "austenitic areas"], authFor(ct, asset));
  }
  if (pri === "high" || pri === "critical") {
    add("Corrosion Mapping", "P2", "Broader wall-loss characterization for high-priority circuits.", ["high-risk circuits"], authFor(ct, asset));
  }
  if (ct === "process_piping" && pri === "critical") {
    add("Guided Wave", "P3", "Long-run screening where access is limited.", ["inaccessible runs"], authFor(ct, asset));
  }
  if (ct === "structural_support" || ct === "bridge_member") {
    add("VT", "P1", "Assess supports, weld condition, coating state, distortion.", ["supports", "steel members"], authFor(ct, asset));
  }
  if (asset === "offshore_platform") {
    add("Drone VT", "P1", "Rapid topside and elevated member overview.", ["topsides", "elevated members"], authFor(ct, asset));
    add("ROV VT", "P1", "Subsea and splash zone screening.", ["subsea", "splash zone"], authFor(ct, asset));
  }
  // Dedupe
  var seen: Record<string, boolean> = {};
  var out: any[] = [];
  for (var i = 0; i < m.length; i++) {
    var k = m[i].method + "|" + m[i].priority;
    if (!seen[k]) { seen[k] = true; out.push(m[i]); }
  }
  return out;
}

// ============================================================
// SCHEDULED ENGINE — Component plan
// ============================================================

function filterDeg(ct: string, all: string[]): string[] {
  var r: string[] = [];
  for (var i = 0; i < all.length; i++) {
    var d = all[i];
    if (ct === "storage_tank") { if (d === "general_corrosion" || d === "localized_corrosion" || d === "cui" || d === "fatigue" || d === "coating_breakdown") r.push(d); }
    else if (ct === "process_piping") { if (d === "general_corrosion" || d === "localized_corrosion" || d === "cui" || d === "erosion_corrosion" || d === "vibration_fatigue" || d === "chloride_scc" || d === "caustic_cracking" || d === "wet_h2s_damage") r.push(d); }
    else if (ct === "pressure_vessel" || ct === "heat_exchanger" || ct === "boiler" || ct === "fired_heater") { if (d === "general_corrosion" || d === "localized_corrosion" || d === "cui" || d === "fatigue" || d === "thermal_fatigue" || d === "hydrogen_damage" || d === "creep" || d === "wet_h2s_damage") r.push(d); }
    else if (ct === "platform_member" || ct === "subsea_component") { if (d === "marine_corrosion" || d === "coating_breakdown" || d === "fatigue" || d === "splash_zone_attack" || d === "localized_corrosion") r.push(d); }
    else r.push(d);
  }
  if (r.length === 0) r.push("unknown_degradation");
  return uniq(r);
}

function compRationale(ct: string, prog: string, pri: string): string {
  var b = "";
  if (ct === "pressure_vessel") b = "Pressure-containing equipment requires interval-based condition review tied to service and thickness history.";
  else if (ct === "process_piping") b = "Piping inspection should align to corrosion circuit logic, TML review, and service-specific screening.";
  else if (ct === "storage_tank") b = "Tank planning should prioritize shell, floor, and history-based corrosion zones.";
  else if (ct === "heat_exchanger") b = "Exchanger planning should consider shell-side, tube-side, and localized degradation risk.";
  else if (ct === "platform_member" || ct === "subsea_component") b = "Offshore scheduled inspection should prioritize topside, splash zone, and subsea integrity.";
  else if (ct === "bridge_member" || ct === "structural_support") b = "Structural inspection should focus on condition, coating, weld integrity, and dimensional stability.";
  else if (ct === "relief_device") b = "Relief devices require functional testing and set-pressure verification per plant program.";
  else b = "Programmatic inspection requires scope definition, history review, and code routing.";
  return b + " Program: " + prog + ". Priority: " + pri + ".";
}

function compFollowUps(ct: string, asset: string): string[] {
  var q: string[] = ["Last inspection date and last known condition?", "Known corrosion history, prior repairs, or active degradation?", "Exact service conditions for this component?"];
  if (ct === "pressure_vessel") q.push("Insulated, cyclic, high-temp, or hydrogen service?");
  if (ct === "process_piping") q.push("Corrosion circuits and TML locations assigned?");
  if (ct === "storage_tank") q.push("Floor condition history known? Internal access planned?");
  if (ct === "heat_exchanger") q.push("Tube-side degradation history? Bundle access available?");
  if (asset === "offshore_platform") q.push("Include topside, splash zone, and subsea scope?");
  return q;
}

function buildCompPlan(ct: string, asset: string, prog: string, deg: string[], svc: string[]): any {
  var fd = filterDeg(ct, deg);
  var pri = schedPriority(ct, fd, svc, prog, asset);
  return {
    component_type: ct,
    governing_authority: authFor(ct, asset),
    probable_degradation: fd,
    priority: pri,
    rationale: compRationale(ct, prog, pri),
    recommended_methods: schedMethods(ct, fd, pri, asset),
    follow_up_questions: compFollowUps(ct, asset)
  };
}

// ============================================================
// SCHEDULED ENGINE — What-if
// ============================================================

function schedWhatIf(pri: string): string[] {
  if (pri === "critical") return ["Degradation may continue without updated condition data.", "Interval basis may no longer reflect actual equipment condition.", "Undetected wall loss or cracking may progress to FFS concerns.", "Compliance and integrity program exposure increases."];
  if (pri === "high") return ["Unknown degradation may progress between intervals.", "Remaining life assumptions may become unreliable.", "High-risk components may stay under-scoped."];
  if (pri === "moderate") return ["Routine degradation may continue without updated data.", "Scope may remain too generic without service/history clarification."];
  return ["Delaying low-priority scheduled work may reduce interval confidence."];
}

// ============================================================
// SCHEDULED ENGINE — Main
// ============================================================

function runScheduled(text: string): any {
  var asset = classifyAsset(text);
  var prog = detectProgType(text);
  var comps = schedComponents(asset, text);
  var svc = schedServiceSignals(text, asset);
  var deg = schedDegradation(svc, comps, asset);
  var kw = routeKeywords(text);
  var unk = routeUnknowns("scheduled_programmatic", asset, text);

  var plans: any[] = [];
  for (var i = 0; i < comps.length; i++) {
    plans.push(buildCompPlan(comps[i], asset, prog, deg, svc));
  }
  // Sort by priority
  var rank: Record<string, number> = { critical: 4, high: 3, moderate: 2, low: 1 };
  plans.sort(function(a: any, b: any) { return rank[b.priority] - rank[a.priority]; });

  var overallPri = "low";
  for (var i = 0; i < plans.length; i++) { if (rank[plans[i].priority] > rank[overallPri]) overallPri = plans[i].priority; }

  var disp = "routine_program_inspection";
  if (overallPri === "critical") disp = "shutdown_scope_review";
  else if (overallPri === "high") disp = "accelerated_integrity_review";
  else if (overallPri === "moderate") disp = "prioritized_program_inspection";

  // Collect all authorities
  var allAuth: string[] = [];
  for (var i = 0; i < plans.length; i++) { for (var j = 0; j < plans[i].governing_authority.length; j++) { allAuth.push(plans[i].governing_authority[j]); } }
  allAuth = uniq(allAuth);

  var actions: string[] = ["Confirm exact component inventory in scope before locking methods.", "Review prior inspection reports, thickness history, repairs, and interval basis.", "Group scope by governing code family (API 510 / 570 / 653) before field execution."];
  if (asset === "offshore_platform") actions.push("Separate topside, splash zone, and subsea scope before campaign.");
  if (overallPri === "high" || overallPri === "critical") actions.push("Prioritize high-risk circuits and pressure-containing components first.");
  if (unk.length > 0) actions.push("Resolve service, history, and program-basis unknowns before final approval.");

  var fups: string[] = ["Is this a full annual review, turnaround scope, or RBI interval review?", "What exact component groups are in scope?", "What service conditions apply and what prior degradation history is known?", "Last inspection dates and last known findings?", "Known corrosion circuits, TMLs, prior repairs, or active mechanisms?"];
  if (asset === "refinery_process_facility") fups.push("Organize by API 510 / 570 / 653 categories?");
  if (asset === "offshore_platform") fups.push("Separate topside, splash zone, and subsea campaigns?");

  var compDisplay: string[] = [];
  for (var i = 0; i < comps.length; i++) compDisplay.push(comps[i].replace(/_/g, " "));

  return {
    engine: "Scheduled Inspection Intelligence Engine v1",
    intake_path: "scheduled_programmatic",
    parsed: {
      raw_text: text, asset_class: asset, program_type: prog,
      confidence: routeConfidence("scheduled_programmatic", asset, prog),
      detected_keywords: kw, inferred_components: comps,
      service_signals: svc, degradation_signals: deg,
      unknown_critical_variables: unk
    },
    facility_summary: "Scheduled inspection for " + asset.replace(/_/g, " ") + ". Program: " + prog + ". Components: " + compDisplay.join(", ") + ".",
    overall_priority: overallPri,
    disposition: disp,
    immediate_actions: actions,
    prioritized_components: plans,
    what_happens_if_you_wait: schedWhatIf(overallPri),
    follow_up_questions: fups,
    code_authority_trace: {
      applicable_families: allAuth,
      method_authority: ["Method selection routed by component type, degradation risk, and governing code family.", "Pressure-containing methods align to API family with NDE per ASME Section V.", "Structural/civil routes to AWS D1.1. Offshore structural to API RP 2A."],
      disposition_authority: ["Disposition based on programmatic risk prioritization, component criticality, and degradation likelihood.", "Does not replace certified inspector judgment, owner/user responsibility, or full RBI software."],
      scoring_basis: ["Priority scoring: component criticality + service signals + degradation mechanisms + program type.", "RBI-style planning overlay, not full quantitative API 581 implementation."]
    }
  };
}

// ============================================================
// STUB ROUTES
// ============================================================

function buildStub(engine: string, path: string, asset: string, summary: string, actions: string[], fups: string[]): any {
  return { engine: engine, intake_path: path, asset_class: asset, summary: summary, immediate_actions: actions, follow_up_questions: fups };
}

function newBuildStub(t: string, asset: string): any {
  return buildStub("New Build / Fabrication Engine (Stub)", "new_build_fabrication", asset,
    "New build / fabrication route for " + asset.replace(/_/g, " ") + ". Handles hold points, WPS compliance, in-process NDE, and acceptance.",
    ["Confirm shop fabrication, field erection, or turnover acceptance.", "Identify hold points, ITP requirements, and applicable code.", "Group into pre-weld, in-process, post-weld, and acceptance stages."],
    ["New construction, fabrication, repair, or turnover?", "Governing code family?", "Hold points and NDE methods required?"]
  );
}

function eventStub(t: string, asset: string): any {
  return buildStub("Event / Damage Engine Route (Stub)", "event_driven", asset,
    "Event-driven route for " + asset.replace(/_/g, " ") + ". Hand off to DRE / voice incident planning.",
    ["Preserve evidence before cleanup.", "Confirm event type, severity, affected component.", "Escalate to asset-specific event rule pack."],
    ["What exactly happened?", "What component was affected?", "Visible displacement, cracking, leakage, or loss of containment?"]
  );
}

function conditionStub(t: string, asset: string): any {
  return buildStub("Condition / Anomaly Engine Route (Stub)", "condition_driven", asset,
    "Condition-driven route for " + asset.replace(/_/g, " ") + ". Handles cracks found, corrosion, leaks, anomalies.",
    ["Confirm anomaly type and exact location.", "Preserve condition and review prior history.", "Determine if condition escalates to FFS review."],
    ["What defect or anomaly was found?", "Exact component and service?", "Active, growing, leaking, or structurally significant?"]
  );
}

function unknownStub(t: string): any {
  return buildStub("Unknown Route Handler", "unknown", "unknown_asset",
    "Input did not clearly match scheduled, new build, event, or condition logic.",
    ["Ask whether this is scheduled, new build, event, or condition inspection.", "Confirm exact asset type."],
    ["Is this scheduled, new build, post-event, or condition inspection?", "What is the exact asset type?", "What component is in scope?"]
  );
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
    var text = body.transcript || "";
    var path = detectPath(text);
    var asset = classifyAsset(text);
    var prog = path === "scheduled_programmatic" ? detectProgType(text) : null;

    var parsedRoute = {
      raw_text: text,
      intake_path: path,
      confidence: routeConfidence(path, asset, prog),
      detected_asset_class: asset,
      detected_program_type: prog,
      detected_keywords: routeKeywords(text),
      unknown_critical_variables: routeUnknowns(path, asset, text)
    };

    var payload: any = null;
    if (path === "scheduled_programmatic") payload = runScheduled(text);
    else if (path === "new_build_fabrication") payload = newBuildStub(text, asset);
    else if (path === "event_driven") payload = eventStub(text, asset);
    else if (path === "condition_driven") payload = conditionStub(text, asset);
    else payload = unknownStub(text);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ router: "Master Inspection Router v1", parsed_route: parsedRoute, payload: payload })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Router failed: " + (err.message || "unknown") })
    };
  }
};

export { handler };
