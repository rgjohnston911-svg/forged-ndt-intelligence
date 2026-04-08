// DEPLOY168 — decision-core.ts v2.5.3
// v2.5.3: Hot-fluid human impact routing
// DEPLOY168: Universal thermal/flammable injury logic inside
//   resolveConsequenceReality. Reads physics.thermal.operating_temp_f +
//   physics.energy.stored_energy_significant + transcript flammable
//   context. Upgrades human_impact from "Low" to thermal burn / flash fire
//   language when a pressure-boundary thinning mechanism releases hot fluid.
//   Fixes Scenario 3 Human Impact: Low on 640F hot hydrocarbon process
//   line. Universal: no asset-class branches, degrades gracefully when
//   temperature or fluid context absent.
// DEPLOY167 — decision-core.ts v2.5.2
// v2.5.2: Tiered asset correction penalty
// DEPLOY167: assessAssetCorrectionStrength() helper distinguishes clean
//   recovery (3+ class-specific signals in transcript) from genuine
//   ambiguity (0-1 signals). STRONG corrections carry NO confidence penalty
//   -- the decision-core successfully inferred the correct class despite
//   upstream error and should be rewarded, not punished. MODERATE gets
//   0.02. WEAK (legacy DEPLOY117 behavior) gets 0.05 + WARNING. Unblocks
//   Scenario 3 confidence drop on clean piping recoveries.
// DEPLOY162 — decision-core.ts v2.5.1
// v2.5.1: Word-boundary matcher for asset resolver + hot hydrocarbon fix
// DEPLOY162: hasWordBoundary() helper + applied to train/car/jacket/bridge/span/
//   deck/pier/coal/brace/web/riser/rov. Prevents substring false positives:
//   "train" matching "restraint", "car" matching "carbon", "jacket" matching
//   "jacketing". Fixes Scenario 3 formal hot-hydrocarbon overhead line where
//   structural lock was falsely firing and derailment label was appearing on
//   a refinery line.
// DEPLOY122 — decision-core.ts v2.5
// v2.5: Evidence Provenance Integration
// DEPLOY122: Accepts evidence_provenance from pipeline. Uses provenance trust weights
//   in damage mechanism scoring (State 2). Provenance trust band feeds into
//   contradiction detector as confidence penalty when evidence base is weak.
//   Provenance data included in output JSON for UI rendering.
// DEPLOY121 — decision-core.ts v2.4.1
// v2.4.1: Implied-only fatigue penalty
// DEPLOY121 FIX: When fatigue prerequisites are ONLY implied defaults (piping auto-cyclic +
//   implied welds) and transcript has zero explicit fatigue indicators, reduce fatigue bonus.
//   Prevents corrosion/erosion transcripts from being classified as fatigue_mechanical.
// v2.4: Asset Classification Hardening + CUI Wall Loss Detection
// DEPLOY120 FIX 1: Raw thickness readings detected as wall loss evidence
//   "0.190 inch versus 0.280 nominal" = measured wall loss, triggers corrosion boost
// DEPLOY120 FIX 2: CUI evidence keywords — sweating, wet insulation, wet lagging → corrosive
// DEPLOY120 FIX 3: Separator/drum → pressure_vessel classification
// DEPLOY120 FIX 4: Offshore platform detection from "unknown" (signal counting like bridge)
// DEPLOY120 FIX 5: Expanded piping detection — "header", "elbow" as standalone line words
// DEPLOY120 FIX 6: Expanded process context — propane, lpg, carbon steel, etc.
// v2.3.1: Evidence Hierarchy — OBSERVED vs SUSPECTED scoring fix
// DEPLOY115 FIX 1: Wall loss evidence detection (wallLossReported, wallLossQuantified, wallLossMeasuredByNDE)
//   Includes field slang: "thinned out", "% down", "eating", "washed out", "corroded", "pitted"
// DEPLOY115 FIX 2: Corrosion mechanisms boosted when wall loss is measured by NDE
//                   Crack/fatigue mechanisms penalized when cracking is only "suspected" not confirmed
//                   Environmental cracking (SCC/SSC/HIC) gets gentler penalty than fatigue
// DEPLOY115 FIX 3: Physics narrative override constrained — no longer flips corrosion/thinning
//                   narrative to fatigue/Paris Law on piping where cyclic+stress_conc are implied defaults
// DEPLOY115 FIX 4: Piping lock — reactor/exchanger mentions no longer override established piping
//                   classification. "Hot hydro line coming off the reactor" = piping, not vessel.
//                   Added process context: hydro, intrados, downstream, upstream
// DEPLOY115 FIX 5: Structural domain lock — bridges/offshore NEVER reclassified as piping/vessel.
//                   Prevents "steel" matching "tee", "line at weld toe" matching piping "line".
//                   Structural signals: girder, bridge, span, train, coal, gusset, brace, web, etc.
//                   Unknown assets auto-lock to bridge if 2+ bridge signals detected.
// v2.3: Industrial Context Intelligence Layer + Event-to-Physics Translation
// Context inference: hydrocracking→H2S+hydrogen, amine→H2S+caustic, etc.
// Event translation: rapid cooldown→thermal cycling, emergency shutdown, etc.
// System-wide: all fixes apply via State 1 physics → all downstream engines benefit
// FIX 1: Consequence escalation — structural instability + stored pressure energy → AUTO CRITICAL
//         Fire exposure + stored pressure energy → AUTO CRITICAL
//         Structural failure induces pressure boundary failure — cannot be evaluated independently
// FIX 2: Inspection domain expansion — fire exposure triggers materials testing track,
//         structural deformation triggers dimensional survey + bolt inspection track
// FIX 3: Creep time-at-temperature qualification — short fire duration adds evidence_against note
//         distinguishing strength reduction / microstructural change from true creep accumulation
// v2.1: PVHO authority stack, mechanism uncertainty preservation (H2S), FFS gap check
// v2.0: Production Physics Sufficiency Engine (State 5 upgraded)
// PHYSICS-FIRST DECISION CORE — Klein Bottle Architecture
// 6 States + Reality Confidence + Contradiction Detector + Physics Computations
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY
// @ts-nocheck
import type { Handler, HandlerEvent } from "@netlify/functions";

// ============================================================================
// TYPES
// ============================================================================
interface StressState { primary_load_types: string[]; cyclic_loading: boolean; cyclic_source: string | null; stress_concentration_present: boolean; stress_concentration_locations: string[]; tensile_stress: boolean; compressive_stress: boolean; load_path_criticality: string; residual_stress_likely: boolean; }
interface ThermalState { operating_temp_c: number | null; operating_temp_f: number | null; thermal_cycling: boolean; fire_exposure: boolean; fire_duration_min: number | null; creep_range: boolean; cryogenic: boolean; }
interface ChemicalState { corrosive_environment: boolean; environment_agents: string[]; h2s_present: boolean; co2_present: boolean; chlorides_present: boolean; caustic_present: boolean; hydrogen_present: boolean; material_susceptibility: string[]; coating_intact: boolean | null; sour_service: boolean; }
interface EnergyState { pressure_cycling: boolean; vibration: boolean; impact_event: boolean; impact_description: string | null; flow_erosion_risk: boolean; cavitation: boolean; stored_energy_significant: boolean; }
interface TimeState { service_years: number | null; cycles_estimated: string | null; time_since_inspection_years: number | null; }
interface ValidatedMechanism { id: string; name: string; physics_basis: string; preconditions_met: string[]; reality_state: string; reality_score: number; evidence_for: string[]; evidence_against: string[]; observation_basis: boolean; severity: string; }
interface RejectedMechanism { id: string; name: string; rejection_reason: string; missing_precondition: string; met_preconditions?: string[]; }
interface MethodWeight { method: string; physics_principle: string; detects: string; cannot_detect: string; reliability: number; coverage: number; limitations: string[]; }
interface PrecedenceGate { gate: string; result: string; reason: string; required_action: string | null; }
interface RecoveryItem { priority: number; action: string; physics_reason: string; who: string; }
interface StrategyPhase { phase: number; name: string; objective: string; actions: string[]; gate: string; time_frame: string; }
interface HardLock { code: string; reason: string; disposition: string; physics_basis: string; }
interface FatigueResult { enabled: boolean; delta_k: number | null; growth_per_cycle_m: number | null; days_to_critical: number | null; status: string; narrative: string; }
interface CriticalFlawResult { enabled: boolean; critical_depth_mm: number | null; stress_ratio: number | null; status: string; narrative: string; }
interface WallLossResult { enabled: boolean; remaining_life_years: number | null; severity_ratio: number | null; status: string; narrative: string; }
interface LeakBurstResult { enabled: boolean; tendency: string; through_wall_risk: number | null; fracture_risk: number | null; narrative: string; }

// ============================================================================
// HELPERS
// ============================================================================
function hasWord(text: string, word: string): boolean { return text.indexOf(word) !== -1; }
function roundN(n: number, d: number): number { var f = Math.pow(10, d); return Math.round(n * f) / f; }

// ============================================================================
// v2.5.1: WORD-BOUNDARY MATCHER
// hasWord() is plain substring search and produces false positives whenever
// a short keyword is a substring of an unrelated word. Examples observed in
// production: "train" inside "restraint", "car" inside "carbon", "jacket"
// inside "jacketing". Use hasWordBoundary() for any keyword short enough to
// be a substring of process terminology.
// ============================================================================
function hasWordBoundary(text: string, word: string): boolean {
  var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("\\b" + escaped + "\\b", "i");
  return re.test(text);
}

// ============================================================================
// DEPLOY117: NEGATION-AWARE EVIDENCE DETECTION
// "No cracks found" must NOT trigger visible_cracking = true.
// Checks for negation words within 25 chars before the keyword.
// Negation patterns: "no ", "not ", "without ", "none ", "negative ",
//   "ruled out", "no visible", "no evidence", "absent", "did not find",
//   "didn't find", "no sign", "no indication"
// ============================================================================
function hasWordNotNegated(text: string, word: string): boolean {
  var idx = text.indexOf(word);
  if (idx === -1) return false;

  // Check ALL occurrences — if ANY is non-negated, return true
  var searchFrom = 0;
  while (idx !== -1) {
    var preStart = Math.max(0, idx - 25);
    var preBuf = text.substring(preStart, idx);

    var negated = false;
    if (preBuf.indexOf("no ") !== -1) negated = true;
    else if (preBuf.indexOf("not ") !== -1) negated = true;
    else if (preBuf.indexOf("without ") !== -1) negated = true;
    else if (preBuf.indexOf("none ") !== -1) negated = true;
    else if (preBuf.indexOf("negative") !== -1) negated = true;
    else if (preBuf.indexOf("ruled out") !== -1) negated = true;
    else if (preBuf.indexOf("no visible") !== -1) negated = true;
    else if (preBuf.indexOf("no evidence") !== -1) negated = true;
    else if (preBuf.indexOf("absent") !== -1) negated = true;
    else if (preBuf.indexOf("did not") !== -1) negated = true;
    else if (preBuf.indexOf("didn") !== -1) negated = true;
    else if (preBuf.indexOf("no sign") !== -1) negated = true;
    else if (preBuf.indexOf("no indication") !== -1) negated = true;

    if (!negated) return true; // Found non-negated occurrence

    searchFrom = idx + word.length;
    idx = text.indexOf(word, searchFrom);
  }
  return false; // All occurrences were negated
}
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }

// ============================================================================
// v2.5.2 DEPLOY167: ASSET CORRECTION STRENGTH ASSESSMENT
// Distinguishes clean recovery (strong multi-signal evidence for the corrected
// class) from genuine ambiguity (weak single-signal correction). Clean
// recoveries carry NO confidence penalty -- the decision-core successfully
// inferred the correct class despite upstream error, which should be rewarded,
// not punished. Universal: signal lists are class-specific but scoring is
// identical for all asset types. Degrades gracefully on unknown classes.
// STRONG   = 3+ class-specific signals -> no penalty, no warning
// MODERATE = 2 class-specific signals -> 0.02 penalty, informational note
// WEAK     = 0-1 signals                -> 0.05 penalty + warning (legacy DEPLOY117)
// ============================================================================
function assessAssetCorrectionStrength(lt: string, correctedClass: string, originalClass: string): any {
  var signals: string[] = [];

  if (correctedClass === "piping" || correctedClass === "pipeline") {
    if (hasWord(lt, "process line")) signals.push("process line");
    if (hasWord(lt, "piping system")) signals.push("piping system");
    if (hasWord(lt, "overhead line") || hasWord(lt, "overhead piping") || hasWord(lt, "overhead process")) signals.push("overhead line");
    if (hasWord(lt, "a106") || hasWord(lt, "a 106")) signals.push("ASTM A106");
    if (hasWord(lt, "a53") || hasWord(lt, "a 53")) signals.push("ASTM A53");
    if (hasWord(lt, "a333") || hasWord(lt, "a 333")) signals.push("ASTM A333");
    if (hasWord(lt, "a312") || hasWord(lt, "a 312")) signals.push("ASTM A312");
    if (hasWord(lt, "nps ") || hasWord(lt, "nominal pipe size")) signals.push("NPS designation");
    if (hasWord(lt, "schedule 40") || hasWord(lt, "schedule 80") || hasWord(lt, "sch 40") || hasWord(lt, "sch 80") || hasWord(lt, "sch. 40") || hasWord(lt, "sch. 80") || hasWord(lt, "std wall") || hasWord(lt, "xs wall")) signals.push("pipe schedule");
    if (hasWord(lt, "dead leg")) signals.push("dead leg");
    if (hasWord(lt, "spring can") || hasWord(lt, "spring hanger")) signals.push("spring support");
    if (hasWord(lt, "long-radius elbow") || hasWord(lt, "long radius elbow") || hasWord(lt, "lr elbow")) signals.push("long-radius elbow");
    if (hasWord(lt, "branch connection") || hasWord(lt, "welded branch")) signals.push("branch connection");
    if (hasWord(lt, "pipe support")) signals.push("pipe support");
    if (/\d+[\s-]*inch\s+(pipe|line)/.test(lt)) signals.push("sized pipe/line");
  }

  if (correctedClass === "pressure_vessel") {
    if (hasWord(lt, "pressure vessel")) signals.push("pressure vessel");
    if (hasWord(lt, "shell and tube") || hasWord(lt, "shell-and-tube")) signals.push("shell and tube");
    if (hasWord(lt, "tube bundle")) signals.push("tube bundle");
    if (hasWord(lt, "u-tube") || hasWord(lt, "u tube")) signals.push("u-tube");
    if (hasWord(lt, "floating head")) signals.push("floating head");
    if (hasWord(lt, "hydrocracker") || hasWord(lt, "hydrotreater")) signals.push("hydroprocessing reactor");
    if (hasWord(lt, "reactor vessel")) signals.push("reactor vessel");
    if (hasWord(lt, "knockout drum") || hasWord(lt, "ko drum")) signals.push("knockout drum");
    if (hasWord(lt, "flash drum")) signals.push("flash drum");
    if (hasWord(lt, "surge drum")) signals.push("surge drum");
    if (hasWord(lt, "asme section viii") || hasWord(lt, "section viii")) signals.push("ASME VIII");
    if (hasWord(lt, "tangent line") || hasWord(lt, "tan-tan")) signals.push("tangent line");
    if (hasWord(lt, "head to shell") || hasWord(lt, "head-to-shell")) signals.push("head to shell junction");
    if (hasWord(lt, "man-way") || hasWord(lt, "manway")) signals.push("manway");
    if (hasWord(lt, "decompression chamber") || hasWord(lt, "hyperbaric")) signals.push("hyperbaric vessel");
  }

  if (correctedClass === "tank" || correctedClass === "storage_tank") {
    if (hasWord(lt, "storage tank")) signals.push("storage tank");
    if (hasWord(lt, "aboveground tank") || hasWord(lt, "aboveground storage")) signals.push("aboveground storage tank");
    if (hasWord(lt, "api 650") || hasWord(lt, "api-650")) signals.push("API 650");
    if (hasWord(lt, "api 653") || hasWord(lt, "api-653")) signals.push("API 653");
    if (hasWord(lt, "floating roof")) signals.push("floating roof");
    if (hasWord(lt, "fixed roof") || hasWord(lt, "cone roof") || hasWord(lt, "dome roof")) signals.push("fixed roof");
    if (hasWord(lt, "tank farm")) signals.push("tank farm");
    if (hasWord(lt, "rim seal")) signals.push("rim seal");
    if (hasWord(lt, "wind girder")) signals.push("wind girder");
    if (hasWord(lt, "tank shell")) signals.push("tank shell");
    if (hasWord(lt, "tank bottom") || hasWord(lt, "floor plate")) signals.push("tank bottom");
  }

  if (correctedClass === "bridge" || correctedClass === "rail_bridge" || correctedClass === "bridge_steel" || correctedClass === "bridge_concrete") {
    if (hasWordBoundary(lt, "bridge")) signals.push("bridge");
    if (hasWord(lt, "girder")) signals.push("girder");
    if (hasWord(lt, "truss")) signals.push("truss");
    if (hasWord(lt, "abutment")) signals.push("abutment");
    if (hasWordBoundary(lt, "pier")) signals.push("pier");
    if (hasWordBoundary(lt, "deck")) signals.push("bridge deck");
    if (hasWord(lt, "stringer")) signals.push("stringer");
    if (hasWord(lt, "floor beam")) signals.push("floor beam");
    if (hasWord(lt, "gusset")) signals.push("gusset");
    if (hasWord(lt, "aashto")) signals.push("AASHTO");
    if (hasWord(lt, "nbis")) signals.push("NBIS");
    if (hasWord(lt, "fracture critical") || hasWord(lt, "fracture-critical")) signals.push("fracture-critical member");
  }

  if (correctedClass === "offshore_platform") {
    if (hasWord(lt, "offshore platform")) signals.push("offshore platform");
    if (hasWordBoundary(lt, "jacket")) signals.push("jacket");
    if (hasWord(lt, "jacket leg")) signals.push("jacket leg");
    if (hasWord(lt, "topside")) signals.push("topside");
    if (hasWord(lt, "splash zone")) signals.push("splash zone");
    if (hasWordBoundary(lt, "riser")) signals.push("riser");
    if (hasWord(lt, "caisson")) signals.push("caisson");
    if (hasWord(lt, "boat landing")) signals.push("boat landing");
    if (hasWord(lt, "subsea")) signals.push("subsea");
    if (hasWord(lt, "api rp 2a") || hasWord(lt, "rp 2a")) signals.push("API RP 2A");
    if (hasWord(lt, "production platform")) signals.push("production platform");
    if (hasWord(lt, "fpso")) signals.push("FPSO");
  }

  var signalCount = signals.length;
  var strength = "WEAK";
  if (signalCount >= 3) strength = "STRONG";
  else if (signalCount === 2) strength = "MODERATE";

  return { strength: strength, signals: signals, signal_count: signalCount, corrected_class: correctedClass, original_class: originalClass };
}

// ============================================================================
// STATE 1: PHYSICAL REALITY ENGINE
// ============================================================================
function resolvePhysicalReality(transcript: string, events: string[], numVals: any, flags: any, assetClass: string) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var nv = numVals || {};
  var conf = 0.5;

  var loads: string[] = [];
  var cyclic = false; var cyclicSrc: string | null = null;
  var stressConc = false; var stressConcLocs: string[] = [];
  var tensile = false; var compress = false;
  var loadPath = "unknown"; var residual = false;

  function hasEvent(term: string): boolean {
    for (var ei = 0; ei < events.length; ei++) { if (events[ei].toLowerCase().indexOf(term) !== -1) return true; }
    return false;
  }
  if (hasEvent("cycl") || hasEvent("fatigue") || hasEvent("vibrat") || hasEvent("traffic") || hasEvent("train") || hasEvent("railroad") || hasEvent("operational_cycling")) {
    cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+parsed_event" : "parsed_event_cyclic";
  }
  if (hasEvent("impact") || hasEvent("collision") || hasEvent("struck") || hasEvent("hit")) {
    loads.push("impact"); compress = true;
  }
  if (hasEvent("crack") || hasEvent("indication") || hasEvent("flaw") || hasEvent("defect")) {
    stressConc = true; stressConcLocs.push("parsed_indication");
  }
  if (hasEvent("deform") || hasEvent("buckl") || hasEvent("dent") || hasEvent("alignment")) {
    compress = true; loads.push("deformation_indicator");
  }
  if (hasEvent("flood") || hasEvent("storm") || hasEvent("wave") || hasEvent("wind") || hasEvent("earthquake") || hasEvent("seismic")) {
    loads.push("environmental"); if (!cyclic) { cyclic = true; cyclicSrc = "environmental_event"; }
  }
  if (hasEvent("tension") || hasEvent("fracture") || hasEvent("overload") || hasEvent("pressure")) {
    tensile = true;
  }

  if (hasWord(lt, "pressure") || assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline") {
    tensile = true; loads.push("internal_pressure"); loads.push("biaxial_tension");
  }
  if (hasWord(lt, "cycl") || (hasWord(lt, "pressuri") && hasWord(lt, "depressuri")) || hasWord(lt, "startup") || hasWord(lt, "shutdown")) {
    cyclic = true; cyclicSrc = "pressure_or_operational_cycling";
  }
  if (hasWord(lt, "decompression") || hasWord(lt, "recompression") || hasWord(lt, "hyperbaric") || hasWord(lt, "autoclave") || hasWord(lt, "pressure test") || hasWord(lt, "hydro test") || hasWord(lt, "hydrotest")) {
    cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+inherent_pressure_cycling" : "inherent_pressure_cycling";
  }
  if ((assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline") && !cyclic) {
    cyclic = true; cyclicSrc = "operational_pressure_cycling_implied";
  }
  if ((hasWordNotNegated(lt, "crack") || hasWordNotNegated(lt, "indication")) && hasWord(lt, "weld") && (assetClass === "pressure_vessel" || assetClass === "piping")) {
    if (!cyclic) { cyclic = true; cyclicSrc = "crack_at_weld_implies_cyclic_history"; }
  }
  if (hasWord(lt, "vibrat")) { cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+vibration" : "vibration"; loads.push("vibration"); }
  if (hasWord(lt, "fatigue") || hasWord(lt, "cyclic load")) { cyclic = true; if (!cyclicSrc) cyclicSrc = "fatigue_indicated"; }
  if (hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "hit") || hasWord(lt, "collision") || hasWord(lt, "hard hit")) { loads.push("impact"); compress = true; }
  if (hasWord(lt, "wind") || hasWord(lt, "wave") || hasWord(lt, "current")) { loads.push("environmental"); cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+environmental" : "environmental"; }

  if (assetClass === "bridge" || assetClass === "rail_bridge" || hasWord(lt, "railroad") || hasWord(lt, "railway") || hasWord(lt, "train") || hasWord(lt, "rail bridge") || hasWord(lt, "highway bridge") || hasWord(lt, "traffic")) {
    if (!cyclic) { cyclic = true; cyclicSrc = "traffic_cyclic_loading"; }
    loads.push("traffic_loading");
    tensile = true;
  }
  if (hasWord(lt, "fracture-critical") || hasWord(lt, "fracture critical")) {
    tensile = true; loadPath = "primary";
    stressConc = true; stressConcLocs.push("fracture_critical_member");
  }
  if (hasWord(lt, "gusset")) { stressConc = true; stressConcLocs.push("gusset_connection"); }
  if (hasWord(lt, "rivet") || hasWord(lt, "bolt hole") || hasWord(lt, "bolted")) { stressConc = true; stressConcLocs.push("fastener_hole"); }
  if (hasWord(lt, "tension member") || hasWord(lt, "lower chord") || hasWord(lt, "bottom chord")) { tensile = true; loadPath = "primary"; }
  if (hasWord(lt, "floor beam") || hasWord(lt, "stringer")) { stressConc = true; stressConcLocs.push("beam_connection"); }
  if (hasWord(lt, "prior repair") || hasWord(lt, "repair") && hasWord(lt, "member")) { stressConc = true; stressConcLocs.push("prior_repair_zone"); residual = true; }
  if (assetClass === "offshore_platform" || hasWordBoundary(lt, "jacket") || hasWord(lt, "platform") && hasWord(lt, "offshore")) {
    tensile = true;
    if (!cyclic) { cyclic = true; cyclicSrc = "wave_current_cycling"; }
    loads.push("gravity_loading"); loads.push("wave_loading");
    loadPath = "primary";
  }
  if (hasWord(lt, "brace") || hasWord(lt, "node") || hasWord(lt, "leg") || hasWord(lt, "jacket leg")) {
    stressConc = true; stressConcLocs.push("structural_node_connection");
  }
  if (hasWord(lt, "boat landing") || hasWord(lt, "conductor") || hasWord(lt, "caisson") || hasWord(lt, "riser")) {
    stressConc = true; stressConcLocs.push("appurtenance_connection");
  }
  if (hasWord(lt, "splash zone")) { stressConc = true; stressConcLocs.push("splash_zone"); }

  if (hasWord(lt, "weld toe") || hasWord(lt, "weld root")) { stressConc = true; stressConcLocs.push("weld_toe_or_root"); }
  if (hasWord(lt, "nozzle") || hasWord(lt, "branch")) { stressConc = true; stressConcLocs.push("nozzle_junction"); }
  if (hasWord(lt, "circumferential weld") || hasWord(lt, "girth weld")) { stressConc = true; stressConcLocs.push("circumferential_weld"); }
  if (hasWord(lt, "weld") && !stressConc) { stressConc = true; stressConcLocs.push("weld_general"); residual = true; }
  if (fl.dent_or_gouge_present) { stressConc = true; stressConcLocs.push("dent_or_gouge"); }
  if (hasWord(lt, "notch") || hasWord(lt, "gouge") || hasWord(lt, "thread")) { stressConc = true; stressConcLocs.push("geometric_discontinuity"); }
  if (!stressConc && (assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || assetClass === "tank")) {
    stressConc = true; stressConcLocs.push("welds_implied_for_" + assetClass); residual = true;
  }
  if (assetClass === "pressure_vessel" && stressConcLocs.indexOf("nozzle_junction") === -1) {
    stressConcLocs.push("head_to_shell_junction_implied");
  }

  if (fl.primary_member_involved || hasWord(lt, "primary") || hasWord(lt, "jacket leg") || hasWord(lt, "main girder")) loadPath = "primary";
  else if (hasWord(lt, "brace") || hasWord(lt, "secondary") || hasWord(lt, "stiffener")) loadPath = "secondary";

  if (loads.length > 0) conf += 0.12;
  if (stressConc) conf += 0.08;

  var tempC: number | null = nv.temperature_c || null;
  var tempF: number | null = nv.temperature_f || null;
  if (!tempC && tempF) tempC = Math.round((tempF - 32) * 5 / 9);
  if (!tempF && tempC) tempF = Math.round(tempC * 9 / 5 + 32);
  var thermalCyc = hasWord(lt, "thermal cycl") || (hasWord(lt, "startup") && hasWord(lt, "shutdown"));

  // ==========================================================================
  // EVENT-TO-PHYSICS TRANSLATION — v2.3
  // Maps field language to physics preconditions.
  // Inspectors describe EVENTS, not physics.
  // Engine translates events → physical state changes.
  // Includes field slang from Universal Field Language Interpreter v1/v2.
  // ==========================================================================
  if (!thermalCyc) {
    var thermalEventInferred = false;
    // Rapid temperature change → thermal gradient → differential contraction
    if (hasWord(lt, "rapid cool") || hasWord(lt, "rapid cooldown") || hasWord(lt, "cool-down rate") || hasWord(lt, "fast cooldown") || hasWord(lt, "crashed the temp") || hasWord(lt, "dropped temp fast")) thermalEventInferred = true;
    // Thermal shock / transient → sudden thermal stress
    if (hasWord(lt, "thermal shock") || hasWord(lt, "thermal transient") || hasWord(lt, "thermal excursion") || hasWord(lt, "thermal upset") || hasWord(lt, "heat checked") || hasWord(lt, "heat check")) thermalEventInferred = true;
    // Quench (not heat treatment quench-and-temper)
    if (hasWord(lt, "quench") && !hasWord(lt, "quench and temper") && !hasWord(lt, "quenched and tempered")) thermalEventInferred = true;
    // Temperature swing / spike
    if (hasWord(lt, "temperature swing") || hasWord(lt, "temperature excursion") || hasWord(lt, "temperature spike") || hasWord(lt, "temp swing") || hasWord(lt, "temp excursion")) thermalEventInferred = true;
    // Emergency / unplanned shutdown → rapid cooldown from operating temp
    if (hasWord(lt, "emergency shutdown") || hasWord(lt, "emergency depressur") || hasWord(lt, "unplanned shutdown") || hasWord(lt, "forced shutdown") || hasWord(lt, "unit trip") || hasWord(lt, "tripped the unit") || hasWord(lt, "e-stop") || hasWord(lt, "esd")) thermalEventInferred = true;
    // Steam-out events → rapid heating/cooling of cold equipment
    if (hasWord(lt, "steam-out") || hasWord(lt, "steamout") || hasWord(lt, "steam out") || hasWord(lt, "steamed it out")) thermalEventInferred = true;
    // Intermittent / batch operation → inherent thermal cycling
    if (hasWord(lt, "batch operation") || hasWord(lt, "intermittent") || hasWord(lt, "batch process") || hasWord(lt, "on-off service") || hasWord(lt, "swing service") || hasWord(lt, "cycling service")) thermalEventInferred = true;
    // Large temperature differential stated explicitly
    if ((hasWord(lt, "cooldown") || hasWord(lt, "cool down")) && (hasWord(lt, "200") || hasWord(lt, "300") || hasWord(lt, "400") || hasWord(lt, "500"))) thermalEventInferred = true;
    // Field slang for thermal events
    if (hasWord(lt, "burned up") || hasWord(lt, "fried") || hasWord(lt, "cooked") || hasWord(lt, "overheated")) thermalEventInferred = true;
    // Water hammer / process upset → pressure + thermal transient
    if (hasWord(lt, "water hammer") || hasWord(lt, "hammered") && (hasWord(lt, "line") || hasWord(lt, "pipe") || hasWord(lt, "system")) || hasWord(lt, "slugging") || hasWord(lt, "process upset")) thermalEventInferred = true;
    if (thermalEventInferred) {
      thermalCyc = true;
    }
  }

  var fireExp = !!fl.fire_exposure || hasWord(lt, "fire");
  var fireDur = fl.fire_duration_minutes || nv.fire_duration_minutes || null;
  var creep = (tempF !== null && tempF > 700) || (tempC !== null && tempC > 370);
  var cryo = (tempF !== null && tempF < -20) || (tempC !== null && tempC < -29);
  if (fireExp) conf += 0.05;
  if (tempC !== null) conf += 0.05;

  var corrosive = false; var agents: string[] = [];
  var negMarine = hasWord(lt, "no marine") || hasWord(lt, "not marine") || hasWord(lt, "marine: no") || hasWord(lt, "marine environment: no") || hasWord(lt, "marine environment. no") || hasWord(lt, "non-marine") || hasWord(lt, "non marine");
  var negH2s = hasWord(lt, "no h2s") || hasWord(lt, "not sour") || hasWord(lt, "no sour") || hasWord(lt, "h2s: no");
  var negChloride = hasWord(lt, "no chloride") || hasWord(lt, "no chlor") || hasWord(lt, "chloride: no");
  var negCorrosion = hasWord(lt, "no corros") || hasWord(lt, "corrosion: no") || hasWord(lt, "not corroded");

  var h2s = !negH2s && (hasWord(lt, "h2s") || hasWord(lt, "hydrogen sulfide") || hasWord(lt, "sour"));
  var co2 = hasWord(lt, "co2") || hasWord(lt, "sweet corros");
  var chlorides = !negMarine && !negChloride && (hasWord(lt, "chloride") || hasWord(lt, "seawater") || hasWord(lt, "splash zone") || hasWord(lt, "salt"));
  if (!negMarine && hasWord(lt, "marine") && !hasWord(lt, "marine environment. no") && !hasWord(lt, "marine environment: no") && !hasWord(lt, "no. marine") && !hasWord(lt, "no marine")) {
    var marineIdx = lt.indexOf("marine");
    var preMarineChunk = lt.substring(Math.max(0, marineIdx - 15), marineIdx);
    if (preMarineChunk.indexOf("no") === -1 && preMarineChunk.indexOf("not") === -1 && preMarineChunk.indexOf("non") === -1) {
      chlorides = true;
    }
  }
  var caustic = hasWord(lt, "caustic") || hasWord(lt, "naoh") || hasWord(lt, "amine");
  var hydrogen = hasWord(lt, "hydrogen") && !h2s || hasWord(lt, "htha");
  if (h2s) { corrosive = true; agents.push("H2S"); }
  if (co2) { corrosive = true; agents.push("CO2"); }
  if (chlorides) { corrosive = true; agents.push("chlorides"); }
  if (caustic) { corrosive = true; agents.push("caustic"); }
  if (hydrogen) agents.push("hydrogen");
  if (!negCorrosion && (hasWord(lt, "corros") || hasWord(lt, "rust") || hasWord(lt, "scale"))) corrosive = true;
  // DEPLOY117: Wall loss / thinning indicators imply corrosive or erosive environment
  // If you have confirmed wall loss, the environment caused it — corrosive by definition
  if (!negCorrosion && (hasWord(lt, "wall loss") || hasWord(lt, "metal loss") || hasWord(lt, "thinning") || hasWord(lt, "thinned") || hasWord(lt, "pitted") || hasWord(lt, "pitting") || hasWord(lt, "eating") || hasWord(lt, "washed out") || hasWord(lt, "corroded") || hasWord(lt, "worn"))) {
    if (!corrosive) { corrosive = true; if (agents.indexOf("implied_corrosive") === -1) agents.push("implied_corrosive"); }
  }
  // DEPLOY120: CUI evidence — wet insulation + external rust = corrosive environment
  if (!negCorrosion && (hasWord(lt, "sweating") || hasWord(lt, "wet insulation") || hasWord(lt, "wet lagging") || hasWord(lt, "damaged insulation") || hasWord(lt, "rusty") || hasWord(lt, "rust spot") || hasWord(lt, "under the insulation") || hasWord(lt, "under insulation") || hasWord(lt, "paper thin"))) {
    if (!corrosive) { corrosive = true; if (agents.indexOf("cui_indicators") === -1) agents.push("cui_indicators"); }
  }
  if (hasWord(lt, "soil") || hasWord(lt, "buried")) { corrosive = true; agents.push("soil"); }
  if (hasWord(lt, "river") || hasWord(lt, "flood") || hasWord(lt, "creek") || hasWord(lt, "water") || hasWord(lt, "submerge")) { corrosive = true; agents.push("water_exposure"); }
  if (hasWord(lt, "atmospheric") || hasWord(lt, "outdoor") || hasWord(lt, "exposed") || hasWord(lt, "weather")) { corrosive = true; agents.push("atmospheric"); }
  if (hasWord(lt, "pack rust") || hasWord(lt, "rust stain") || hasWord(lt, "rust bleed") || hasWord(lt, "rusting")) { corrosive = true; if (agents.indexOf("atmospheric") === -1) agents.push("atmospheric"); }
  if ((assetClass === "bridge" || assetClass === "rail_bridge") && !corrosive) { corrosive = true; agents.push("atmospheric_implied_for_bridge"); }
  if (hasEvent("corros") || hasEvent("rust") || hasEvent("oxide") || hasEvent("scale")) { corrosive = true; if (agents.indexOf("parsed_corrosion") === -1) agents.push("parsed_corrosion"); }
  if (hasEvent("flood") || hasEvent("water") || hasEvent("river") || hasEvent("rain") || hasEvent("weather") || hasEvent("atmospheric")) { corrosive = true; if (agents.indexOf("environmental_exposure") === -1) agents.push("environmental_exposure"); }
  if (hasEvent("marine") || hasEvent("salt") || hasEvent("seawater") || hasEvent("offshore")) { if (!negMarine) { chlorides = true; corrosive = true; if (agents.indexOf("chlorides") === -1) agents.push("chlorides"); } }


  // ==========================================================================
  // INDUSTRIAL CONTEXT INTELLIGENCE LAYER — v2.3
  // Infers chemical environment from industrial unit/process context.
  // Field inspectors describe EQUIPMENT, not chemistry.
  // Engine must translate equipment context → chemical environment.
  // This runs AFTER explicit keyword detection so it only ADDS flags —
  // it never overrides explicit negation (negH2s, negCorrosion, etc.)
  // ==========================================================================
  var contextInferred: string[] = [];

  // HYDROCRACKING / HYDROTREATING → H2S + hydrogen service
  // Field slang: "the cracker", "H2 unit", "high pressure loop", "recycle gas"
  if (hasWord(lt, "hydrocrack") || hasWord(lt, "hydrotreater") || hasWord(lt, "hydrotreating") || hasWord(lt, "hydroprocessing") || hasWord(lt, "hydrodesulfur") || hasWord(lt, "the cracker") || hasWord(lt, "high pressure loop") || hasWord(lt, "recycle gas") || hasWord(lt, "h2 unit") || hasWord(lt, "hp separator") || hasWord(lt, "lp separator") || hasWord(lt, "reactor effluent")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("hydrocracking/hydrotreating → H2S inferred"); }
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("hydrocracking/hydrotreating → hydrogen inferred"); }
  }

  // CATALYTIC REFORMING → hydrogen service
  // Field slang: "the reformer", "CCR", "regen section"
  if (hasWord(lt, "catalytic reform") || hasWord(lt, "platformer") || hasWord(lt, "reformer unit") || hasWord(lt, "naphtha reform") || hasWord(lt, "ccr unit") || hasWord(lt, "the reformer") || hasWord(lt, "regen section") || hasWord(lt, "reformate")) {
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("catalytic reformer → hydrogen inferred"); }
  }

  // AMINE UNIT → H2S + amine (caustic-like) environment
  // Field slang: "the scrubber", "gas sweetener", "sweetening unit", "acid gas scrubber"
  if (hasWord(lt, "amine unit") || hasWord(lt, "amine service") || hasWord(lt, "amine system") || hasWord(lt, "amine contactor") || hasWord(lt, "amine regenerat") || hasWord(lt, "amine absorber") || hasWord(lt, "amine stripper") || hasWord(lt, "mdea") || hasWord(lt, "dea unit") || hasWord(lt, "mea unit") || hasWord(lt, "gas sweeten") || hasWord(lt, "acid gas scrubber") || hasWord(lt, "the scrubber") || hasWord(lt, "lean amine") || hasWord(lt, "rich amine")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("amine unit → H2S inferred (acid gas service)"); }
    if (!caustic) { caustic = true; corrosive = true; if (agents.indexOf("caustic") === -1) agents.push("caustic"); contextInferred.push("amine unit → amine/caustic environment inferred"); }
  }

  // CRUDE UNIT / DISTILLATION → H2S + naphthenic acid potential
  // Field slang: "the tower", "the column", "CDU", "VDU", "pipe still", "crude side"
  if (hasWord(lt, "crude unit") || hasWord(lt, "crude distill") || hasWord(lt, "atmospheric distill") || hasWord(lt, "vacuum distill") || hasWord(lt, "crude tower") || hasWord(lt, "atmospheric tower") || hasWord(lt, "vacuum tower") || hasWord(lt, "pipe still") || hasWord(lt, "cdu") || hasWord(lt, "vdu") || hasWord(lt, "crude column") || hasWord(lt, "overhead system") || hasWord(lt, "crude side")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("crude unit → H2S inferred"); }
    corrosive = true;
    if (agents.indexOf("naphthenic_acid") === -1) { agents.push("naphthenic_acid"); contextInferred.push("crude unit → naphthenic acid potential inferred"); }
  }

  // FCC / FLUID CATALYTIC CRACKING → H2S
  // Field slang: "the cat", "cat unit", "the FCC", "riser reactor"
  if (hasWord(lt, "fluid catalytic") || hasWord(lt, "cat cracker") || hasWord(lt, "fccu") || hasWord(lt, "the cat") || hasWord(lt, "cat unit") || hasWord(lt, "riser reactor") || hasWord(lt, "regenerator") && (hasWord(lt, "cat") || hasWord(lt, "fcc"))) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("FCC unit → H2S inferred"); }
  }

  // SULFUR RECOVERY / CLAUS → concentrated H2S
  // Field slang: "the SRU", "the Claus", "sulfur block", "tail gas unit", "TGTU"
  if (hasWord(lt, "sulfur recovery") || hasWord(lt, "claus unit") || hasWord(lt, "claus reactor") || hasWord(lt, "tail gas") || hasWord(lt, "sulfur plant") || hasWord(lt, "the sru") || hasWord(lt, "sulfur block") || hasWord(lt, "tgtu")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("sulfur recovery → concentrated H2S inferred"); }
  }

  // DELAYED COKER → H2S + hydrogen + thermal cycling
  // Field slang: "the coker", "the drum", "coke cutting", "decoking"
  if (hasWord(lt, "delayed coker") || hasWord(lt, "coker drum") || hasWord(lt, "coke drum") || hasWord(lt, "the coker") || hasWord(lt, "coke cutting") || hasWord(lt, "decoking") || hasWord(lt, "coke heater")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("coker → H2S inferred"); }
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("coker → hydrogen inferred"); }
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("coker drum → thermal cycling inferred (heat/quench cycles)"); }
  }

  // SOUR WATER / SOUR GAS / ACID GAS → H2S
  // Field slang: "sour drum", "KO drum", "knockout drum", "sour stripper", "the SWS"
  if (hasWord(lt, "sour water") || hasWord(lt, "sour gas") || hasWord(lt, "acid gas") || hasWord(lt, "sour service") || hasWord(lt, "sour drum") || hasWord(lt, "knockout drum") || hasWord(lt, "ko drum") || hasWord(lt, "sour stripper") || hasWord(lt, "the sws")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("sour/acid gas service → H2S inferred"); }
  }

  // HYDROGEN UNIT / HYDROGEN PLANT → hydrogen environment
  // Field slang: "H2 plant", "steam reformer", "SMR", "hydrogen loop", "H2 recycle"
  if (hasWord(lt, "hydrogen plant") || hasWord(lt, "hydrogen unit") || hasWord(lt, "hydrogen makeup") || hasWord(lt, "h2 makeup") || hasWord(lt, "hydrogen compressor") || hasWord(lt, "hydrogen header") || hasWord(lt, "h2 plant") || hasWord(lt, "steam reform") || hasWord(lt, "smr unit") || hasWord(lt, "hydrogen loop") || hasWord(lt, "h2 recycle") || hasWord(lt, "psa unit") || hasWord(lt, "pressure swing adsorption")) {
    if (!hydrogen) { hydrogen = true; if (agents.indexOf("hydrogen") === -1) agents.push("hydrogen"); contextInferred.push("hydrogen unit → hydrogen environment inferred"); }
  }

  // HIGH-TEMP HYDROGEN SERVICE MATERIAL → HTHA susceptibility
  if (hydrogen && (hasWord(lt, "2.25cr") || hasWord(lt, "2-1/4cr") || hasWord(lt, "2 1/4 cr") || hasWord(lt, "1cr-1/2mo") || hasWord(lt, "c-1/2mo") || hasWord(lt, "carbon steel") || hasWord(lt, "c-mn") || hasWord(lt, "carbon-manganese"))) {
    if (agents.indexOf("HTHA_susceptible_material") === -1) { agents.push("HTHA_susceptible_material"); contextInferred.push("material + hydrogen → HTHA susceptibility per Nelson curve"); }
  }

  // CAUSTIC SERVICE (explicit process)
  // Field slang: "caustic tree", "caustic treating", "the caustic"
  if (hasWord(lt, "caustic wash") || hasWord(lt, "caustic injection") || hasWord(lt, "naoh injection") || hasWord(lt, "caustic tower") || hasWord(lt, "caustic scrubber") || hasWord(lt, "spent caustic") || hasWord(lt, "caustic tree") || hasWord(lt, "caustic treating") || hasWord(lt, "the caustic") || hasWord(lt, "caustic drum")) {
    if (!caustic) { caustic = true; corrosive = true; if (agents.indexOf("caustic") === -1) agents.push("caustic"); contextInferred.push("caustic service → caustic environment inferred"); }
  }

  // BOILER FEEDWATER / DEAERATOR → oxygen corrosion
  if (hasWord(lt, "boiler feedwater") || hasWord(lt, "deaerator") || hasWord(lt, "bfw system")) {
    corrosive = true;
    if (agents.indexOf("dissolved_oxygen") === -1) { agents.push("dissolved_oxygen"); contextInferred.push("boiler feedwater → dissolved oxygen corrosion potential"); }
  }

  // COOLING WATER → chlorides + microbiological
  // Field slang: "circ water", "CW system", "the cooling", "basin water"
  if (hasWord(lt, "cooling water") || hasWord(lt, "cooling tower") || hasWord(lt, "cw system") || hasWord(lt, "condenser water") || hasWord(lt, "circ water") || hasWord(lt, "the cooling") || hasWord(lt, "basin water") || hasWord(lt, "fin fan") || hasWord(lt, "air cooler") && hasWord(lt, "water")) {
    corrosive = true;
    if (!chlorides && !negChloride) { chlorides = true; if (agents.indexOf("chlorides") === -1) agents.push("chlorides"); contextInferred.push("cooling water → chloride potential inferred"); }
  }

  // FLARE SYSTEM → H2S + thermal cycling
  // Field slang: "the flare", "LP flare", "HP flare", "flare KO drum"
  if (hasWord(lt, "flare header") || hasWord(lt, "flare stack") || hasWord(lt, "flare system") || hasWord(lt, "flare line") || hasWord(lt, "flare tip") || hasWord(lt, "the flare") || hasWord(lt, "lp flare") || hasWord(lt, "hp flare") || hasWord(lt, "flare ko drum") || hasWord(lt, "flare knockout")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("flare system → H2S potential inferred"); }
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("flare system → thermal cycling inferred (intermittent flaring)"); }
  }

  // WET GAS / WET H2S → aqueous H2S (most aggressive for HIC)
  if (hasWord(lt, "wet gas") || hasWord(lt, "wet h2s") || hasWord(lt, "wet sour")) {
    if (!h2s && !negH2s) { h2s = true; corrosive = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("wet gas/wet H2S → aqueous H2S (aggressive HIC risk)"); }
  }

  // STEAM SYSTEM → thermal cycling + dissolved oxygen
  if (hasWord(lt, "steam header") || hasWord(lt, "steam line") || hasWord(lt, "steam trap") || hasWord(lt, "condensate return") || hasWord(lt, "condensate system") || hasWord(lt, "steam drum") && !hasWord(lt, "boiler")) {
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("steam system → thermal cycling inferred"); }
    corrosive = true;
    if (agents.indexOf("dissolved_oxygen") === -1) { agents.push("dissolved_oxygen"); contextInferred.push("steam/condensate → dissolved oxygen + CO2 corrosion potential"); }
  }

  // FIRED HEATER / FURNACE → thermal cycling + creep potential
  // Field slang: "the heater", "fire side", "radiant section", "convection section", "tube went soft"
  if (hasWord(lt, "fired heater") || hasWord(lt, "process heater") || hasWord(lt, "the heater") || hasWord(lt, "fire side") || hasWord(lt, "radiant section") || hasWord(lt, "convection section") || hasWord(lt, "tube went soft") || hasWord(lt, "furnace tube") || hasWord(lt, "heater tube") || hasWord(lt, "radiant tube") || hasWord(lt, "convection tube")) {
    if (!thermalCyc) { thermalCyc = true; contextInferred.push("fired heater → thermal cycling inferred (startup/shutdown cycles)"); }
    contextInferred.push("fired heater/furnace → elevated temperature service, creep potential");
  }

  // DEAD LEG → stagnant corrosion risk
  // Field slang: "dead leg", "dead end", "no flow", "stagnant line"
  if (hasWord(lt, "dead leg") || hasWord(lt, "dead end") && (hasWord(lt, "pipe") || hasWord(lt, "line")) || hasWord(lt, "no flow") || hasWord(lt, "stagnant line") || hasWord(lt, "stagnant") && hasWord(lt, "piping")) {
    corrosive = true;
    if (agents.indexOf("stagnant_corrosion") === -1) { agents.push("stagnant_corrosion"); contextInferred.push("dead leg → stagnant/trapped fluid corrosion risk"); }
  }

  // HEAT EXCHANGER → context depends on shell/tube side
  // Field slang: "the exchanger", "shell side", "tube side", "tube bundle"
  if (hasWord(lt, "exchanger") || hasWord(lt, "shell side") || hasWord(lt, "tube side") || hasWord(lt, "tube bundle") || hasWord(lt, "u-tube") || hasWord(lt, "floating head")) {
    corrosive = true;
    if (agents.indexOf("exchanger_service") === -1) { agents.push("exchanger_service"); contextInferred.push("heat exchanger → multi-fluid service, corrosion potential on both sides"); }
  }

  // RAIN LINE ATTACK / OVERHEAD CORROSION
  // Field slang: "rain line", "overhead", "top of line", "dew point corrosion"
  if (hasWord(lt, "rain line") || hasWord(lt, "overhead corros") || hasWord(lt, "top of line") || hasWord(lt, "dew point") || hasWord(lt, "overhead system") || hasWord(lt, "overhead line")) {
    corrosive = true;
    if (!h2s && !negH2s) { h2s = true; if (agents.indexOf("H2S") === -1) agents.push("H2S"); contextInferred.push("overhead/rain line → H2S + HCl condensation zone inferred"); }
    if (!chlorides && !negChloride) { chlorides = true; if (agents.indexOf("chlorides") === -1) agents.push("chlorides"); contextInferred.push("overhead/rain line → chloride (HCl) condensation inferred"); }
  }

  // FIELD LEAK / SEEPAGE LANGUAGE → flag corrosion + consequence
  // Field slang: "sweating", "weeping", "bleeding", "dripping", "leaker"
  if (hasWord(lt, "sweating") || hasWord(lt, "weeping") || hasWord(lt, "seeping") || hasWord(lt, "leaker") || hasWord(lt, "dripping") || hasWord(lt, "active leak")) {
    corrosive = true;
    if (agents.indexOf("active_leak_indicator") === -1) { agents.push("active_leak_indicator"); contextInferred.push("field leak language detected → active corrosion/degradation likely"); }
  }

  // POLYTHIONIC ACID CRACKING CONTEXT
  // Field slang: "polythionic", "PTA cracking", "sensitized stainless"
  if (hasWord(lt, "polythionic") || (hasWord(lt, "sensitized") && hasWord(lt, "stainless")) || hasWord(lt, "pta crack")) {
    corrosive = true;
    if (agents.indexOf("polythionic_acid") === -1) { agents.push("polythionic_acid"); contextInferred.push("polythionic acid cracking context → shutdown/turnaround risk for sensitized stainless"); }
  }

  var suscept: string[] = [];
  if (h2s && tensile) suscept.push("SSC");
  if (h2s) suscept.push("HIC");
  if (chlorides && (hasWord(lt, "stainless") || hasWord(lt, "austenitic"))) suscept.push("chloride_SCC");
  if (caustic && tensile) suscept.push("caustic_SCC");
  var coatingOk: boolean | null = null;
  if (hasWord(lt, "coating fail") || hasWord(lt, "coating breakdown") || hasWord(lt, "coating damage")) coatingOk = false;
  else if (hasWord(lt, "coating intact") || hasWord(lt, "coating good")) coatingOk = true;
  if (corrosive) conf += 0.05;

  var presCyc = cyclic && (hasWord(lt, "pressure") || assetClass === "pressure_vessel" || assetClass === "piping");
  var vib = hasWord(lt, "vibrat");
  var impactEv = hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "collision") || hasWord(lt, "dropped object");
  var flowEro = hasWord(lt, "erosion") || hasWord(lt, "high velocity");
  var cav = hasWord(lt, "cavitat");

  // FIELD SLANG — vibration indicators
  if (!vib) {
    if (hasWord(lt, "singing") || hasWord(lt, "chattering") || hasWord(lt, "shaking") || hasWord(lt, "humming") || hasWord(lt, "buzzing") || hasWord(lt, "rattling")) {
      vib = true;
      if (!cyclic) { cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+vibration_field_language" : "vibration_field_language"; }
    }
  }

  // FIELD SLANG — erosion / flow damage indicators
  if (!flowEro) {
    if (hasWord(lt, "eating the elbow") || (hasWord(lt, "chewed up") && (hasWord(lt, "elbow") || hasWord(lt, "bend") || hasWord(lt, "tee"))) || hasWord(lt, "washed out") || hasWord(lt, "channeling") || hasWord(lt, "grooved") || (hasWord(lt, "thinned out") && hasWord(lt, "elbow"))) {
      flowEro = true;
    }
  }

  // FIELD SLANG — impact indicators
  if (!impactEv) {
    if (hasWord(lt, "got hit") || hasWord(lt, "took a hit") || hasWord(lt, "hammered") || hasWord(lt, "beat up") || hasWord(lt, "banged up") || hasWord(lt, "dented") || hasWord(lt, "dinged")) {
      impactEv = true;
    }
  }

  // FIELD SLANG — corrosion/damage descriptors → wall loss confidence boost
  if (hasWord(lt, "eaten up") || hasWord(lt, "rotted") || hasWord(lt, "eating away") || hasWord(lt, "rusted out") || hasWord(lt, "paper thin") || hasWord(lt, "necked down") || hasWord(lt, "metal loss")) {
    corrosive = true;
    if (agents.indexOf("field_corrosion_language") === -1) agents.push("field_corrosion_language");
  }
  var storedE = assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || assetClass === "offshore_platform" || hasWord(lt, "pressur") || hasWord(lt, "production platform") || hasWord(lt, "hydrocarbon");

  var svcYears: number | null = nv.service_years || null;
  var cyclesEst: string | null = cyclic ? (nv.cycle_count ? String(nv.cycle_count) : "cyclic_but_unknown_count") : null;
  var timeSinceInsp: number | null = nv.years_since_inspection || null;
  if (svcYears) conf += 0.05;
  if (conf > 1) conf = 1;

  var parts: string[] = [];
  if (loads.length) parts.push("Loading: " + loads.join(", "));
  if (cyclic) parts.push("Cyclic: " + (cyclicSrc || "yes"));
  if (stressConc) parts.push("Stress concentrations: " + stressConcLocs.join(", "));
  if (fireExp) parts.push("Fire exposure" + (fireDur ? " (" + fireDur + "min)" : ""));
  if (corrosive) parts.push("Corrosive (" + agents.join(", ") + ")");
  if (suscept.length) parts.push("Susceptible: " + suscept.join(", "));
  if (storedE) parts.push("Stored pressure energy");
  if (contextInferred.length > 0) parts.push("Context inferred: " + contextInferred.join("; "));
  var summary = parts.length ? parts.join(". ") + "." : "Limited physical context from transcript.";

  var hotspots: string[] = [];
  var interactionScore = 0;
  var interactionWarnings: string[] = [];

  if (corrosive && cyclic) {
    interactionScore += 25;
    hotspots.push("Corrosion + cyclic stress at same location");
    interactionWarnings.push("Corrosion creates surface pits that become stress risers, accelerating fatigue crack initiation. Combined damage rate is faster than either mechanism alone.");
  }
  if (stressConc && cyclic) {
    interactionScore += 20;
    for (var hi = 0; hi < stressConcLocs.length; hi++) hotspots.push("Cyclic loading at " + stressConcLocs[hi]);
    interactionWarnings.push("Cyclic stress concentrates at geometric discontinuities (" + stressConcLocs.join(", ") + "). These are the most likely crack initiation sites.");
  }
  if (corrosive && stressConc) {
    interactionScore += 15;
    hotspots.push("Corrosion attack at stress concentration");
    interactionWarnings.push("Corrosion preferentially attacks areas of high stress and geometric change. Weld toes, crevices, and transitions are most vulnerable.");
  }
  if (fireExp && storedE) {
    interactionScore += 20;
    hotspots.push("Fire-exposed pressure boundary");
    interactionWarnings.push("Fire may degrade material properties while pressure maintains load. Reduced strength under sustained stress creates failure risk.");
  }
  if (h2s && tensile) {
    interactionScore += 25;
    hotspots.push("Sour environment under tensile stress");
    interactionWarnings.push("H2S charges hydrogen into material under tensile stress. This can cause sudden cracking with little warning. High-priority inspection zone.");
  }
  if (impactEv && storedE) {
    interactionScore += 15;
    hotspots.push("Impact damage on pressurized component");
    interactionWarnings.push("Impact creates local deformation and residual stress. Under pressure, this zone becomes a stress concentration that may initiate cracking.");
  }
  if (interactionScore > 100) interactionScore = 100;
  var interactionLevel = interactionScore >= 60 ? "HIGH" : interactionScore >= 30 ? "MODERATE" : "LOW";
  if (hotspots.length === 0) {
    interactionWarnings.push("No significant force interaction detected. Individual force assessment applies.");
  }

  return {
    stress: { primary_load_types: loads, cyclic_loading: cyclic, cyclic_source: cyclicSrc, stress_concentration_present: stressConc, stress_concentration_locations: stressConcLocs, tensile_stress: tensile, compressive_stress: compress, load_path_criticality: loadPath, residual_stress_likely: residual } as StressState,
    thermal: { operating_temp_c: tempC, operating_temp_f: tempF, thermal_cycling: thermalCyc, fire_exposure: fireExp, fire_duration_min: fireDur, creep_range: creep, cryogenic: cryo } as ThermalState,
    chemical: { corrosive_environment: corrosive, environment_agents: agents, h2s_present: h2s, co2_present: co2, chlorides_present: chlorides, caustic_present: caustic, hydrogen_present: hydrogen, material_susceptibility: suscept, coating_intact: coatingOk, sour_service: h2s } as ChemicalState,
    energy: { pressure_cycling: presCyc, vibration: vib, impact_event: impactEv, impact_description: impactEv ? "Impact event in transcript" : null, flow_erosion_risk: flowEro, cavitation: cav, stored_energy_significant: storedE } as EnergyState,
    time: { service_years: svcYears, cycles_estimated: cyclesEst, time_since_inspection_years: timeSinceInsp } as TimeState,
    field_interaction: { hotspots: hotspots, interaction_score: interactionScore, interaction_level: interactionLevel, warnings: interactionWarnings },
    physics_summary: summary,
    physics_confidence: roundN(conf, 2),
    context_inferred: contextInferred
  };
}

// ============================================================================
// STATE 2: DAMAGE REALITY ENGINE
// ============================================================================
var MECH_DEFS = [
  { id: "fatigue_mechanical", name: "Mechanical Fatigue", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"],
    pre: function(s: any, t: any, c: any, e: any) { return s.cyclic_loading && s.stress_concentration_present; },
    preLabels: ["Cyclic loading", "Stress concentration"] },
  { id: "fatigue_thermal", name: "Thermal Fatigue", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"],
    pre: function(s: any, t: any) { return t.thermal_cycling && s.stress_concentration_present; },
    preLabels: ["Thermal cycling", "Stress concentration"] },
  { id: "fatigue_vibration", name: "Vibration Fatigue", sev: "medium", eKeys: ["crack_confirmed"],
    pre: function(s: any, t: any, c: any, e: any) { return e.vibration && s.stress_concentration_present; },
    preLabels: ["Vibration", "Stress concentration"] },
  { id: "general_corrosion", name: "General Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed", "leak_suspected"],
    pre: function(s: any, t: any, c: any) { return c.corrosive_environment; },
    preLabels: ["Corrosive environment"] },
  { id: "pitting", name: "Pitting Corrosion", sev: "high", eKeys: ["critical_wall_loss_confirmed", "leak_confirmed"],
    pre: function(s: any, t: any, c: any) { return c.chlorides_present || c.co2_present; },
    preLabels: ["Localized corrosive agent (Cl-/CO2)"] },
  { id: "scc_chloride", name: "Chloride SCC", sev: "critical", eKeys: ["crack_confirmed"],
    pre: function(s: any, t: any, c: any) { return s.tensile_stress && c.chlorides_present && c.material_susceptibility.indexOf("chloride_SCC") !== -1; },
    preLabels: ["Tensile stress", "Chlorides", "Susceptible material (austenitic/duplex)"] },
  { id: "scc_caustic", name: "Caustic SCC", sev: "critical", eKeys: ["crack_confirmed"],
    pre: function(s: any, t: any, c: any) { return s.tensile_stress && c.caustic_present; },
    preLabels: ["Tensile stress", "Caustic environment"] },
  { id: "ssc_sulfide", name: "Sulfide Stress Cracking", sev: "critical", eKeys: ["crack_confirmed"],
    pre: function(s: any, t: any, c: any) { return s.tensile_stress && c.h2s_present; },
    preLabels: ["Tensile stress", "H2S present"] },
  { id: "hic", name: "Hydrogen Induced Cracking", sev: "high", eKeys: ["crack_confirmed", "visible_cracking"],
    pre: function(s: any, t: any, c: any) { return c.h2s_present; },
    preLabels: ["H2S present (hydrogen source)"] },
  { id: "co2_corrosion", name: "CO2 (Sweet) Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed"],
    pre: function(s: any, t: any, c: any) { return c.co2_present && c.corrosive_environment; },
    preLabels: ["CO2 present", "Water phase"] },
  { id: "creep", name: "Creep Damage", sev: "critical", eKeys: [],
    pre: function(s: any, t: any) { return t.creep_range && s.tensile_stress; },
    preLabels: ["Temperature in creep range", "Sustained tensile stress"] },
  { id: "brittle_fracture", name: "Brittle Fracture", sev: "critical", eKeys: ["crack_confirmed"],
    pre: function(s: any, t: any, c: any, e: any, fl: any) { return t.cryogenic && (!!fl.crack_confirmed || !!fl.visible_cracking || !!fl.dent_or_gouge_present); },
    preLabels: ["Low temperature", "Pre-existing flaw"] },
  { id: "erosion", name: "Erosion / Erosion-Corrosion", sev: "medium", eKeys: ["critical_wall_loss_confirmed"],
    pre: function(s: any, t: any, c: any, e: any) { return e.flow_erosion_risk; },
    preLabels: ["High flow velocity or erosive conditions"] },
  { id: "overload_buckling", name: "Mechanical Overload / Buckling", sev: "high", eKeys: ["visible_deformation", "dent_or_gouge_present"],
    pre: function(s: any, t: any, c: any, e: any) { return s.compressive_stress || e.impact_event; },
    preLabels: ["Compressive overload or impact energy"] },
  { id: "fire_damage", name: "Fire / Thermal Damage", sev: "high", eKeys: ["fire_exposure", "fire_property_degradation_confirmed"],
    pre: function(s: any, t: any) { return t.fire_exposure; },
    preLabels: ["Fire or elevated temperature exposure"] },
  { id: "cui", name: "Corrosion Under Insulation", sev: "medium", eKeys: ["critical_wall_loss_confirmed"],
    pre: function(s: any, t: any) { return t.operating_temp_f !== null && t.operating_temp_f >= 0 && t.operating_temp_f <= 350; },
    preLabels: ["Temperature in CUI range (0-350F)", "Insulated equipment"] },
  { id: "hydrogen_damage", name: "High Temp Hydrogen Attack", sev: "critical", eKeys: [],
    pre: function(s: any, t: any, c: any) { return c.hydrogen_present && t.operating_temp_f !== null && t.operating_temp_f > 400; },
    preLabels: ["Hydrogen environment", "Elevated temperature (>400F)"] }
];

function resolveDamageReality(physics: any, flags: any, transcript: string, provenance?: any) {
  var fl = flags || {};
  var lt = transcript.toLowerCase();
  var validated: ValidatedMechanism[] = [];
  var rejected: RejectedMechanism[] = [];

  // ============================================================================
  // EVIDENCE HIERARCHY — DEPLOY115
  // Distinguishes OBSERVED (measured by NDE) from SUSPECTED (reported concern).
  // Measured wall loss from UT/thickness gauging is the strongest thinning evidence.
  // "Cracking suspected" is NOT the same as "crack confirmed by NDE".
  // Field inspectors use slang: "thinned out", "35% down", "eating itself up"
  // ============================================================================
  var wallLossReported = hasWord(lt, "wall loss") || hasWord(lt, "metal loss") || hasWord(lt, "thinning") || hasWord(lt, "wall thinning") || hasWord(lt, "thickness loss") || hasWord(lt, "thinned") || hasWord(lt, "thinned out") || hasWord(lt, "corroded") || hasWord(lt, "pitted") || hasWord(lt, "washed out") || hasWord(lt, "eating") || hasWord(lt, "reduced thickness") || hasWord(lt, "reduced wall") || hasWord(lt, "paper thin") || /\d+\s*(?:percent|%)\s*(?:down|loss|gone|reduced)/i.test(transcript) || /\d+\.?\d*\s*(?:inch|in\.?|mm)\s*(?:versus|vs\.?|compared\s*to|from|against)\s*\d+\.?\d*/i.test(transcript) || (/(?:nominal|original|design|minimum)\s*(?:of\s*)?\d+\.?\d*/i.test(transcript) && /(?:shows|reads?|measured|found|actual)\s*\d+\.?\d*/i.test(transcript)) || (/\d+\.?\d*\s*(?:inch|in\.?|mm)/.test(transcript) && hasWord(lt, "nominal") && hasWord(lt, "versus"));
  var wallLossQuantified = wallLossReported && (/\d+\s*(?:percent|%)\s*(?:wall\s*loss|metal\s*loss|thinning|thickness\s*loss|down|loss|gone|reduced)/i.test(transcript) || /(?:wall\s*loss|metal\s*loss|thinning|thickness\s*loss)\s*(?:of\s*)?\d+/i.test(transcript) || /\d+[-\u2013\u2014]?\d*\s*(?:percent|%)\s*(?:down|loss|gone|reduced)/i.test(transcript) || /(?:wall\s*loss|metal\s*loss|thinning)[^.]{0,30}\d+\s*(?:percent|%)/i.test(transcript) || /\d+\s*(?:percent|%)[^.]{0,30}(?:wall\s*loss|metal\s*loss|thinning)/i.test(transcript) || /\d+\.?\d*\s*(?:inch|in\.?|mm)\s*(?:versus|vs\.?|compared\s*to|from|against)\s*\d+\.?\d*/i.test(transcript));
  var wallLossMeasuredByNDE = wallLossReported && (hasWord(lt, "ultrasonic") || hasWord(lt, "ut ") || hasWord(lt, "ut grid") || hasWord(lt, "thickness reading") || hasWord(lt, "thickness survey") || hasWord(lt, "paut") || hasWord(lt, "scan") || hasWord(lt, "confirmed") || hasWord(lt, "measured") || hasWord(lt, "inspection found") || hasWord(lt, "shows") || (hasWord(lt, "found") && hasWord(lt, "wall loss")) || (hasWord(lt, "ut") && /\d+\.?\d*/.test(transcript)));
  var crackingSuspectedOnly = (hasWordNotNegated(lt, "crack") || hasWordNotNegated(lt, "cracking")) && (hasWord(lt, "suspected") || hasWord(lt, "possible") || hasWord(lt, "potential") || hasWord(lt, "concern") || hasWord(lt, "may be") || hasWord(lt, "might be") || hasWord(lt, "or something") || hasWord(lt, "hard to tell") || hasWord(lt, "not sure") || hasWord(lt, "not clean") || hasWord(lt, "junk geometry")) && !hasWord(lt, "crack confirmed") && !hasWord(lt, "cracking confirmed") && !(!!fl.crack_confirmed);
  var s = physics.stress; var t = physics.thermal; var c = physics.chemical; var e = physics.energy;

  var preCheckMap: any = {
    "Cyclic loading": s.cyclic_loading,
    "Stress concentration": s.stress_concentration_present,
    "Thermal cycling": t.thermal_cycling,
    "Vibration": e.vibration,
    "Corrosive environment": c.corrosive_environment,
    "Localized corrosive agent (Cl-/CO2)": c.chlorides_present || c.co2_present,
    "Tensile stress": s.tensile_stress,
    "Chlorides": c.chlorides_present,
    "Susceptible material (austenitic/duplex)": c.material_susceptibility && c.material_susceptibility.indexOf("chloride_SCC") !== -1,
    "Caustic environment": c.caustic_present,
    "H2S present": c.h2s_present,
    "H2S present (hydrogen source)": c.h2s_present,
    "CO2 present": c.co2_present,
    "Water phase": c.corrosive_environment,
    "Temperature in creep range": t.creep_range,
    "Sustained tensile stress": s.tensile_stress,
    "Low temperature": t.cryogenic,
    "Pre-existing flaw": !!fl.crack_confirmed || !!fl.visible_cracking || !!fl.dent_or_gouge_present,
    "High flow velocity or erosive conditions": e.flow_erosion_risk,
    "Compressive overload or impact energy": s.compressive_stress || e.impact_event,
    "Fire or elevated temperature exposure": t.fire_exposure,
    "Temperature in CUI range (0-350F)": t.operating_temp_f !== null && t.operating_temp_f >= 0 && t.operating_temp_f <= 350,
    "Insulated equipment": false,
    "Hydrogen environment": c.hydrogen_present,
    "Elevated temperature (>400F)": t.operating_temp_f !== null && t.operating_temp_f > 400
  };

  for (var i = 0; i < MECH_DEFS.length; i++) {
    var md = MECH_DEFS[i];
    if (!md.pre(s, t, c, e, fl)) {
      var missingPres: string[] = [];
      var metPres: string[] = [];
      for (var pi = 0; pi < md.preLabels.length; pi++) {
        var label = md.preLabels[pi];
        if (preCheckMap[label]) { metPres.push(label); }
        else { missingPres.push(label); }
      }
      if (missingPres.length === 0 && metPres.length === 0) missingPres = md.preLabels.slice();
      rejected.push({ id: md.id, name: md.name,
        rejection_reason: "PHYSICALLY IMPOSSIBLE: Missing required precondition(s): " + missingPres.join("; "),
        missing_precondition: missingPres.join("; "),
        met_preconditions: metPres });
      continue;
    }
    var evFor: string[] = []; var evAg: string[] = []; var obs = false; var score = 0.4;
    for (var ei = 0; ei < md.eKeys.length; ei++) {
      if (fl[md.eKeys[ei]]) { evFor.push(md.eKeys[ei].replace(/_/g, " ")); score += 0.2; obs = true; }
    }
    var words = md.name.toLowerCase().split(/[\s\/()]+/);
    for (var wi = 0; wi < words.length; wi++) { if (words[wi].length > 3 && hasWordNotNegated(lt, words[wi])) { score += 0.05; break; } }

    if (md.id === "fatigue_mechanical" || md.id === "fatigue_thermal" || md.id === "fatigue_vibration") {
      if (s.cyclic_loading) score += 0.10;
      if (s.stress_concentration_present) score += 0.08;
      if (s.cyclic_loading && s.stress_concentration_present) score += 0.07;
      // DEPLOY121: IMPLIED-ONLY FATIGUE PENALTY
      // When fatigue prerequisites are ONLY from piping defaults (auto-cyclic + implied welds)
      // and transcript has zero explicit fatigue indicators, the +0.25 bonus is unearned.
      // Penalize so corrosion/erosion evidence can outrank implied fatigue.
      var cyclicIsImpliedOnly = s.cyclic_source === "operational_pressure_cycling_implied";
      var stressConcIsImpliedOnly = true;
      for (var sci = 0; sci < s.stress_concentration_locations.length; sci++) {
        if (s.stress_concentration_locations[sci].indexOf("implied") === -1) { stressConcIsImpliedOnly = false; break; }
      }
      var hasExplicitFatigueEvidence = hasWord(lt, "fatigue") || hasWord(lt, "cyclic") || hasWord(lt, "vibrat") || hasWord(lt, "startup") || hasWord(lt, "shutdown") || hasWord(lt, "thermal cycl") || (!!fl.crack_confirmed) || hasWord(lt, "crack confirmed") || hasWord(lt, "cracking confirmed");
      if (cyclicIsImpliedOnly && stressConcIsImpliedOnly && !hasExplicitFatigueEvidence) {
        score -= 0.20;
      }
    }
    if (md.id === "general_corrosion" || md.id === "co2_corrosion" || md.id === "cui" || md.id === "erosion") {
      if (s.cyclic_loading && s.stress_concentration_present) {
        score -= 0.10;
      }
      if (!obs && !hasWord(lt, "corrosion") && !hasWord(lt, "thinning") && !hasWord(lt, "thinned") && !hasWord(lt, "wall loss") && !hasWord(lt, "metal loss") && !hasWord(lt, "eating") && !hasWord(lt, "washed out") && !hasWord(lt, "scale") && !hasWord(lt, "pitted") && !hasWord(lt, "corroded")) {
        score -= 0.05;
      }
    }
    if (md.id === "pitting") {
      if (hasWord(lt, "coating breakdown") || hasWord(lt, "coating damage") || hasWord(lt, "paint breakdown")) score += 0.05;
      if (hasWord(lt, "rust") || hasWord(lt, "stain")) score += 0.05;
    }

    // ============================================================================
    // DEPLOY115: EVIDENCE HIERARCHY — OBSERVED vs SUSPECTED
    // Measured NDE findings outrank reported suspicions.
    // Wall loss found by UT = OBSERVED. "Cracking suspected" = UNCONFIRMED CONCERN.
    // ============================================================================

    // BOOST: Corrosion/thinning mechanisms when wall loss is MEASURED
    var isCorrosionMech = md.id === "general_corrosion" || md.id === "pitting" || md.id === "co2_corrosion" || md.id === "cui" || md.id === "erosion";
    if (isCorrosionMech && wallLossReported) {
      score += 0.15;
      obs = true;
      evFor.push("wall loss reported in transcript");
      if (wallLossQuantified) {
        score += 0.10;
        evFor.push("wall loss quantified with percentage");
      }
      if (wallLossMeasuredByNDE) {
        score += 0.05;
        evFor.push("wall loss measured by NDE method");
      }
      // REMOVE the cyclic penalty when wall loss is the observed reality —
      // implied cyclic loading on piping should not suppress the observed finding
      if (s.cyclic_loading && s.stress_concentration_present) {
        score += 0.10; // restore the -0.10 penalty applied above
      }
    }

    // REDUCE: Crack/fatigue mechanisms when cracking is only SUSPECTED, not confirmed
    var isCrackMech = md.id.indexOf("fatigue") !== -1 || md.id.indexOf("scc") !== -1 || md.id.indexOf("ssc") !== -1 || md.id.indexOf("hic") !== -1;
    if (isCrackMech && crackingSuspectedOnly) {
      // "Cracking suspected" is weaker than "crack confirmed by NDE".
      // But how much to penalize depends on the mechanism type:
      //   - Fatigue: "suspected cracking" is weak evidence — fatigue needs crack morphology confirmation
      //   - Environmental cracking (SCC/SSC/HIC): "suspected" in a matching environment is meaningful
      var isEnvCracking = md.id.indexOf("scc") !== -1 || md.id.indexOf("ssc") !== -1 || md.id.indexOf("hic") !== -1;
      if (isEnvCracking) {
        // Gentler penalty — suspected cracking in the right environment is valid concern
        score -= 0.05;
        evAg.push("cracking suspected but not confirmed by crack-specific NDE method");
      } else {
        // Full penalty for fatigue — "suspected cracking" is very weak fatigue evidence
        score -= 0.15;
        evAg.push("cracking suspected but not confirmed by crack-specific NDE method — weak fatigue evidence");
      }
      // If wall loss IS measured, crack mechanism should not outrank the observed finding
      if (wallLossMeasuredByNDE || wallLossQuantified) {
        score -= 0.05;
        evAg.push("measured wall loss is stronger observed evidence than suspected cracking");
      }
    }

    // ============================================================================
    // DEPLOY117: ACTIVE NEGATION SUPPRESSION
    // If the inspector explicitly ruled out a finding type, actively reduce
    // the corresponding mechanism score. "No crack found" should suppress
    // cracking mechanisms, not just prevent boosting.
    // ============================================================================
    var crackNegated = hasWord(lt, "crack") && !hasWordNotNegated(lt, "crack");
    var corrosionNegated = (hasWord(lt, "corros") && !hasWordNotNegated(lt, "corros")) || (hasWord(lt, "rust") && !hasWordNotNegated(lt, "rust"));
    var deformNegated = (hasWord(lt, "deform") && !hasWordNotNegated(lt, "deform")) || (hasWord(lt, "dent") && !hasWordNotNegated(lt, "dent")) || (hasWord(lt, "buckl") && !hasWordNotNegated(lt, "buckl"));

    if (crackNegated && isCrackMech) {
      score -= 0.20;
      evAg.push("cracking explicitly ruled out or negated in transcript");
    }
    if (corrosionNegated && isCorrosionMech) {
      score -= 0.20;
      evAg.push("corrosion explicitly ruled out or negated in transcript");
    }
    if (deformNegated && md.id === "overload_buckling") {
      score -= 0.20;
      evAg.push("deformation explicitly ruled out or negated in transcript");
    }


    // ============================================================================
    // DEPLOY122: EVIDENCE PROVENANCE TRUST WEIGHTING
    // When provenance data is available, adjust mechanism score based on whether
    // the supporting evidence is MEASURED (high trust) vs INFERRED (low trust).
    // This is additive to existing evidence hierarchy — provenance provides
    // systematic trust grading across ALL evidence, not just wall-loss vs crack.
    // ============================================================================
    if (provenance && provenance.evidence && provenance.evidence.length > 0) {
      var mechKeywords = md.name.toLowerCase().split(/[\s\/()]+/);
      var relevantProvenance: any[] = [];
      for (var pei = 0; pei < provenance.evidence.length; pei++) {
        var pe = provenance.evidence[pei];
        var peClaimLower = (pe.claim || "").toLowerCase();
        for (var mki = 0; mki < mechKeywords.length; mki++) {
          if (mechKeywords[mki].length > 3 && peClaimLower.indexOf(mechKeywords[mki]) !== -1) {
            relevantProvenance.push(pe);
            break;
          }
        }
      }
      if (relevantProvenance.length > 0) {
        var avgProvenanceWeight = 0;
        for (var rpi = 0; rpi < relevantProvenance.length; rpi++) {
          avgProvenanceWeight += relevantProvenance[rpi].provenance_weight || 0.25;
        }
        avgProvenanceWeight = avgProvenanceWeight / relevantProvenance.length;
        var provenanceAdjust = (avgProvenanceWeight - 0.6) * 0.25;
        score += provenanceAdjust;
        if (provenanceAdjust > 0.01) {
          evFor.push("provenance: supporting evidence is " + relevantProvenance[0].provenance + " (trust weight " + roundN(avgProvenanceWeight, 2) + ")");
        } else if (provenanceAdjust < -0.01) {
          evAg.push("provenance: supporting evidence is " + relevantProvenance[0].provenance + " (trust weight " + roundN(avgProvenanceWeight, 2) + ") — lower confidence");
        }
      }
    }

    if (score > 1) score = 1;
    if (score < 0) score = 0;
    var state = score >= 0.75 ? "confirmed" : score >= 0.55 ? "probable" : score >= 0.35 ? "possible" : "unverified";
    validated.push({ id: md.id, name: md.name, physics_basis: md.preLabels.join(" + "),
      preconditions_met: md.preLabels, reality_state: state, reality_score: roundN(score, 2),
      evidence_for: evFor, evidence_against: evAg, observation_basis: obs, severity: md.sev });
  }
  validated.sort(function(a, b) { if (b.reality_score !== a.reality_score) return b.reality_score - a.reality_score; if (a.observation_basis !== b.observation_basis) return a.observation_basis ? -1 : 1; return 0; });

  // ============================================================================
  // MECHANISM UNCERTAINTY PRESERVATION — DEPLOY106 PATCH 1
  // ============================================================================
  if (physics.chemical.h2s_present) {
    var hydrogenUnresolved = false;
    for (var hci = 0; hci < validated.length; hci++) {
      var hcm = validated[hci];
      if ((hcm.id === "ssc_sulfide" || hcm.id === "hic") && hcm.reality_state !== "confirmed") {
        hydrogenUnresolved = true;
        break;
      }
    }
    if (hydrogenUnresolved) {
      for (var hcf = 0; hcf < validated.length; hcf++) {
        if (validated[hcf].id === "fatigue_mechanical" && validated[hcf].reality_state === "confirmed") {
          validated[hcf].reality_state = "probable";
          if (validated[hcf].reality_score > 0.74) { validated[hcf].reality_score = 0.74; }
          validated[hcf].evidence_against.push(
            "H2S present with unresolved SSC/HIC — mechanism set not collapsed to single dominant until hydrogen susceptibility assessment complete"
          );
        }
      }
      validated.sort(function(a, b) { if (b.reality_score !== a.reality_score) return b.reality_score - a.reality_score; if (a.observation_basis !== b.observation_basis) return a.observation_basis ? -1 : 1; return 0; });
    }
  }

  // ============================================================================
  // DEPLOY109 FIX 3: CREEP TIME-AT-TEMPERATURE QUALIFICATION
  // ============================================================================
  if (physics.thermal.fire_exposure) {
    for (var cti = 0; cti < validated.length; cti++) {
      if (validated[cti].id === "creep") {
        if (physics.thermal.fire_duration_min !== null && physics.thermal.fire_duration_min < 60) {
          validated[cti].evidence_against.push(
            "Short fire duration (" + physics.thermal.fire_duration_min + " min) — may cause strength reduction or microstructural change, but insufficient time-at-temperature for true creep strain accumulation. Classify as fire damage, not creep, unless temperature + duration data confirms otherwise."
          );
          if (validated[cti].reality_score > 0.55) validated[cti].reality_score = 0.55;
          if (validated[cti].reality_state === "confirmed" || validated[cti].reality_state === "probable") validated[cti].reality_state = "possible";
        } else if (physics.thermal.fire_duration_min === null) {
          validated[cti].evidence_against.push(
            "Fire exposure detected but duration unknown — cannot distinguish (a) recoverable property reduction, (b) phase transformation, or (c) true creep accumulation without time-at-temperature data."
          );
        }
      }
    }
    validated.sort(function(a, b) { if (b.reality_score !== a.reality_score) return b.reality_score - a.reality_score; if (a.observation_basis !== b.observation_basis) return a.observation_basis ? -1 : 1; return 0; });
  }

  var primary = validated.length > 0 ? validated[0] : null;

  var avgS = 0; for (var vi = 0; vi < validated.length; vi++) avgS += validated[vi].reality_score;
  avgS = validated.length > 0 ? avgS / validated.length : 0.2;
  var dmgConf = Math.min(avgS + (validated.length > 0 ? 0.1 : 0), 1.0);
  if (dmgConf > physics.physics_confidence + 0.1) dmgConf = physics.physics_confidence + 0.1;

  var narr = "";
  if (primary) narr += "Primary: " + primary.name + " (score " + primary.reality_score + "). Physics: " + primary.physics_basis + ". ";
  narr += validated.length + " possible, " + rejected.length + " physically impossible.";

  return { validated: validated, rejected: rejected, primary: primary, damage_confidence: roundN(dmgConf, 2), physics_narrative: narr };
}

// ============================================================================
// STATE 3: CONSEQUENCE REALITY ENGINE
// ============================================================================
function resolveConsequenceReality(physics: any, damage: any, assetClass: string, transcript: string, flags: any) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var tier: string = "MEDIUM";
  var basis: string[] = [];
  var failMode = "equipment_degradation";
  var failPhysics = "";
  var humanImpact = "Low"; var envImpact = "Negligible"; var opImpact = "Operational disruption";
  var requirements: string[] = [];

  var critKw = ["decompression chamber", "hyperbaric", "dive system", "diving bell", "life support", "human occupancy", "manned", "personnel basket", "escape capsule", "breathing air", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"];
  for (var ci = 0; ci < critKw.length; ci++) {
    if (hasWord(lt, critKw[ci])) { tier = "CRITICAL"; basis.push("PHYSICS: Human occupancy (" + critKw[ci] + ")"); humanImpact = "FATAL — human occupancy during operation"; break; }
  }
  if (physics.energy.stored_energy_significant) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("PHYSICS: Stored pressure energy — release on failure");
    failMode = "pressure_boundary_failure";
  }
  if (physics.stress.load_path_criticality === "primary") {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Primary load-carrying member — collapse risk");
  }
  if (physics.chemical.h2s_present || physics.chemical.caustic_present) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Toxic substance (" + physics.chemical.environment_agents.join(", ") + ")");
    humanImpact = "Serious injury/fatality from toxic release";
    envImpact = "Environmental release";
  }
  if (physics.thermal.fire_exposure) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Fire exposure degrades material properties");
  }

  // DEPLOY109 FIX 1: CONSEQUENCE ESCALATION
  var structuralInstability = (!!fl.visible_deformation && !!fl.primary_member_involved) || !!fl.support_collapse_confirmed;
  if (structuralInstability && physics.energy.stored_energy_significant) {
    tier = "CRITICAL";
    basis.push("PHYSICS: Structural instability + stored pressure energy — structural failure induces pressure boundary failure. Cannot be evaluated independently.");
    humanImpact = "FATAL — structural collapse releases stored pressure energy";
    failMode = "structural_pressure_cascade";
  }
  if (physics.thermal.fire_exposure && physics.energy.stored_energy_significant) {
    tier = "CRITICAL";
    basis.push("PHYSICS: Fire exposure + stored pressure energy — fire degrades containment while pressure maintains load. Catastrophic release risk.");
    if (humanImpact.indexOf("FATAL") === -1) humanImpact = "FATAL — fire-weakened pressure boundary under load";
    failMode = "fire_pressure_cascade";
  }

  if (assetClass === "bridge" || assetClass === "rail_bridge") {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Public infrastructure — civilian exposure");
    humanImpact = "Public fatality risk";
  }
  if (hasWord(lt, "crude oil") || hasWord(lt, "petroleum") || hasWord(lt, "hazmat") || hasWord(lt, "flammable") || hasWord(lt, "toxic cargo") || hasWord(lt, "lng") || hasWord(lt, "lpg") || hasWord(lt, "ammonia") || hasWord(lt, "chlorine")) {
    tier = "CRITICAL";
    basis.push("CONSEQUENCE: Hazardous cargo — release creates fatality/environmental catastrophe");
    humanImpact = "FATAL — hazardous material release";
    envImpact = "Major environmental contamination";
  }
  if (hasWord(lt, "fracture-critical") || hasWord(lt, "fracture critical")) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Fracture-critical member — single-member failure = collapse");
    if (humanImpact === "Low") humanImpact = "Fatality risk from structural collapse";
  }
  if ((hasWordBoundary(lt, "train") || hasWord(lt, "railroad") || hasWord(lt, "locomotive")) && (hasWord(lt, "loaded") || hasWordBoundary(lt, "car") || hasWord(lt, "freight"))) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Loaded train — derailment risk");
    if (humanImpact === "Low") humanImpact = "Derailment fatality risk";
  }
  if (assetClass === "offshore_platform" || hasWord(lt, "offshore") || hasWord(lt, "platform") || hasWord(lt, "jacket structure")) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Offshore platform — personnel exposure, hydrocarbon systems, structural collapse risk");
    if (humanImpact === "Low") humanImpact = "Personnel fatality risk — offshore structural failure";
    envImpact = "Hydrocarbon release / environmental contamination";
  }
  if (hasWord(lt, "hurricane") || hasWord(lt, "typhoon") || hasWord(lt, "cyclone") || hasWord(lt, "category") || (hasWord(lt, "storm") && (hasWord(lt, "major") || hasWord(lt, "severe")))) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Major storm/hurricane event — structural integrity uncertain");
  }
  if ((hasWord(lt, "out of line") || hasWord(lt, "shifted") || hasWord(lt, "distort") || hasWord(lt, "buckl") || hasWord(lt, "different feel") || hasWord(lt, "alignment")) && (assetClass === "offshore_platform" || assetClass === "bridge" || assetClass === "rail_bridge")) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Visible deformation/shift indicators on structural asset — load path may be compromised");
  }
  if (hasWord(lt, "production") && (hasWord(lt, "platform") || hasWord(lt, "offshore"))) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("CONSEQUENCE: Production platform — hydrocarbon inventory");
  }
  if ((hasWord(lt, "underwater") || hasWord(lt, "subsea") || hasWord(lt, "below waterline") || hasWord(lt, "diver") || hasWord(lt, "splash zone") || hasWord(lt, "marine growth")) && (hasWord(lt, "unknown") || hasWord(lt, "hiding") || hasWord(lt, "uncertain") || hasWord(lt, "not sure"))) {
    if (tier !== "CRITICAL") tier = "HIGH";
    basis.push("CONSEQUENCE: Underwater/subsea condition uncertain — critical zones uninspected");
  }
  // ============================================================================
  // DEPLOY168 v2.5.3: HOT FLUID HUMAN IMPACT ROUTING
  // Universal thermal/flammable injury potential from physics state alone.
  // No asset-class branches, no scenario keywords. Reads operating_temp_f +
  // stored_energy_significant + primary mechanism type + transcript flammable
  // context. Degrades gracefully when temperature or fluid context absent.
  //
  // Three severity bands based on physics:
  //   - 400F+ with flammable context = flash fire / autoignition risk on release
  //     (most hydrocarbons autoignite 400-800F; release at or near autoignition
  //     creates fire risk regardless of external ignition source)
  //   - 400F+ non-flammable = severe thermal burn (second-degree in <1 sec contact)
  //   - 140-400F  = thermal scald/burn injury (OSHA thermal contact threshold ~140F)
  //
  // Only fires when the primary mechanism is a pressure-boundary thinning type
  // (corrosion/pitting/erosion/cui) so "thermal burn on release" is actually in
  // the failure mode. Doesn't fire for fatigue (different failure mode) or
  // structural members without fluid inventory.
  // ============================================================================
  var opTempF = physics.thermal.operating_temp_f;
  var hasStoredEnergy = physics.energy.stored_energy_significant;
  var primaryIsBoundaryThinning = damage.primary && (
    damage.primary.id.indexOf("corrosion") !== -1 ||
    damage.primary.id.indexOf("pitting") !== -1 ||
    damage.primary.id === "erosion" ||
    damage.primary.id === "cui" ||
    damage.primary.id === "co2_corrosion"
  );
  var flammableContext = hasWord(lt, "hydrocarbon") ||
    hasWord(lt, "crude") ||
    hasWord(lt, "naphtha") ||
    hasWord(lt, "diesel") ||
    hasWord(lt, "gasoline") ||
    hasWord(lt, "kerosene") ||
    hasWord(lt, "lpg") ||
    hasWord(lt, "propane") ||
    hasWord(lt, "butane") ||
    hasWord(lt, "ngl") ||
    hasWord(lt, "ethylene") ||
    hasWord(lt, "methane") ||
    hasWord(lt, "flammable") ||
    hasWord(lt, "combustible") ||
    hasWord(lt, "process fluid") ||
    (physics.chemical.environment_agents && physics.chemical.environment_agents.indexOf("naphthenic_acid") !== -1);

  if (opTempF !== null && opTempF >= 140 && hasStoredEnergy && primaryIsBoundaryThinning) {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";

    if (opTempF >= 400 && flammableContext) {
      basis.push("PHYSICS: Hot hydrocarbon release at " + opTempF + "F with pressure boundary thinning mechanism — thermal burn + flash fire/autoignition risk on release (fluid at or above hydrocarbon autoignition threshold)");
      if (humanImpact === "Low" || humanImpact === "Operational disruption") {
        humanImpact = "Serious injury/fatality from thermal burns + flash fire on release";
      }
      if (envImpact === "Negligible") envImpact = "Hydrocarbon release with fire risk";
      if (failMode === "equipment_degradation") failMode = "hot_hydrocarbon_release";
    } else if (opTempF >= 400) {
      basis.push("PHYSICS: High-temperature fluid release at " + opTempF + "F with pressure boundary thinning mechanism — severe thermal burn risk (fluid well above thermal injury threshold)");
      if (humanImpact === "Low" || humanImpact === "Operational disruption") {
        humanImpact = "Serious thermal burn injury from high-temperature release";
      }
      if (failMode === "equipment_degradation") failMode = "hot_fluid_release";
    } else {
      // 140-400F band
      basis.push("PHYSICS: Heated fluid release at " + opTempF + "F with pressure boundary thinning mechanism — thermal burn/scald risk (above OSHA thermal contact threshold of 140F)");
      if (humanImpact === "Low" || humanImpact === "Operational disruption") {
        humanImpact = "Thermal burn injury from heated fluid release";
      }
      if (failMode === "equipment_degradation") failMode = "heated_fluid_release";
    }
  }

  if (basis.length === 0) basis.push("Standard asset — default MEDIUM");

  var isRoutine = hasWord(lt, "routine") || hasWord(lt, "general condition") || hasWord(lt, "condition assessment") || hasWord(lt, "general inspection") || hasWord(lt, "periodic");
  var hasNoHistory = hasWord(lt, "no history") || hasWord(lt, "no damage") || hasWord(lt, "no previous") || hasWord(lt, "first inspection");
  var hasDamageEvidence = !!fl.crack_confirmed || !!fl.critical_wall_loss_confirmed || !!fl.leak_confirmed || !!fl.through_wall_leak_confirmed || !!fl.fire_property_degradation_confirmed || !!fl.support_collapse_confirmed;
  var hasAnyVisibleDamage = !!fl.visible_cracking || !!fl.visible_deformation || !!fl.dent_or_gouge_present || !!fl.leak_suspected;

  var degradationCertainty = "UNVERIFIED";
  if (hasDamageEvidence) { degradationCertainty = "CONFIRMED"; }
  else if (hasAnyVisibleDamage) { degradationCertainty = "SUSPECTED"; }
  else if (damage.primary && damage.primary.observation_basis) { degradationCertainty = "SUSPECTED"; }
  else if (damage.primary && damage.primary.reality_score >= 0.6) { degradationCertainty = "PROBABLE"; }
  else { degradationCertainty = "UNVERIFIED"; }

  if (isRoutine && degradationCertainty === "UNVERIFIED" && !hasDamageEvidence) {
    if (failMode === "equipment_degradation" || failMode === "pressure_boundary_failure") {
      failMode = "inspection_required";
    }
    if (humanImpact.indexOf("FATAL") !== -1) {
      humanImpact = "FATAL potential (life-safety asset) — current degradation NOT confirmed";
    }
    opImpact = "Routine inspection — no immediate operational impact established";
  }

  var isStructuralAssetType = assetClass === "bridge" || assetClass === "rail_bridge" || assetClass === "bridge_steel" || assetClass === "bridge_concrete" || assetClass === "offshore_platform";

  if (damage.primary) {
    var pm = damage.primary.id;
    // ============================================================================
    // DEPLOY115: DOMAIN-AWARE FAILURE PHYSICS NARRATIVES
    // Structural assets (bridges, offshore) use structural failure language.
    // Pressure systems (piping, vessels) use pressure failure language.
    // A bridge does not have hoop stress or pinhole leaks.
    // ============================================================================

    if (pm.indexOf("fatigue") !== -1) {
      if (isStructuralAssetType) {
        failPhysics = "Fatigue crack propagation at stress concentrations under cyclic loading (traffic, wind, operational). Crack grows incrementally per cycle until remaining section cannot sustain applied loads. Failure mode: member fracture, connection failure, or load path disruption.";
      } else {
        failPhysics = "Fatigue crack propagation per Paris Law. Cyclic stress drives incremental growth at stress concentrations. Critical crack size determined by fracture toughness vs applied stress. Failure mode: leak-before-break (ductile) or catastrophic burst (insufficient toughness).";
      }
    } else if (pm.indexOf("corrosion") !== -1 || pm.indexOf("pitting") !== -1 || pm === "co2_corrosion" || pm === "cui" || pm === "erosion") {
      if (isStructuralAssetType) {
        failPhysics = "Progressive section loss reduces load-carrying capacity. When remaining section falls below minimum for applied loads, failure occurs as local buckling, member instability, or connection failure. Section loss at critical locations (flange, web, connection) is more consequential than uniform loss.";
      } else {
        failPhysics = "Progressive wall thinning reduces load-bearing section. When remaining wall falls below minimum for hoop stress, failure occurs as plastic collapse or pinhole leak.";
      }
    } else if (pm.indexOf("scc") !== -1 || pm.indexOf("ssc") !== -1) {
      failPhysics = "Environmentally-assisted crack propagation under sustained tensile stress. Growth rate depends on stress intensity, environment, and material susceptibility. Failure can be sudden.";
    } else if (pm === "overload_buckling") {
      failPhysics = "Compressive overload exceeds stability limit or impact exceeds deformation capacity. Failure: buckling, permanent deformation, or fracture.";
    } else if (pm === "fire_damage") {
      failPhysics = "Elevated temperature degrades yield, tensile, and toughness. Post-fire properties may not recover. Phase changes possible above critical temps.";
    }
  }
  if (!failPhysics) failPhysics = "Damage progression reduces integrity below safe operating threshold.";

  if (physics.stress.cyclic_loading && physics.stress.stress_concentration_present && physics.energy.stored_energy_significant && !isStructuralAssetType) {
    // ============================================================================
    // DEPLOY115: EVIDENCE-ANCHORED PHYSICS OVERRIDE
    // Previously this override replaced ANY wall-thinning narrative with fatigue/Paris Law
    // whenever piping had implied cyclic+stress_conc+stored_energy (which is ALL piping).
    // Now: only override when primary mechanism is NOT a corrosion/thinning type.
    // If the primary observed evidence is wall loss, the narrative stays wall-loss-first.
    // ============================================================================
    var pmIsCorrosionType = damage.primary && (damage.primary.id.indexOf("corrosion") !== -1 || damage.primary.id.indexOf("pitting") !== -1 || damage.primary.id === "co2_corrosion" || damage.primary.id === "cui" || damage.primary.id === "erosion");
    if (!pmIsCorrosionType && (failPhysics.indexOf("wall thinning") !== -1 || failPhysics.indexOf("Damage progression") !== -1)) {
      failPhysics = "Cyclic pressure loading drives fatigue crack initiation at stress concentrations (weld toes, nozzles, geometric transitions). Crack propagates per Paris Law until critical size is reached. Failure mode: pressure boundary breach via crack-through (leak-before-break if ductile, catastrophic burst if insufficient toughness). Corrosion may accelerate initiation but crack propagation is the dominant failure path.";
      failMode = "crack_propagation_pressure_breach";
    }
  }

  if (tier === "CRITICAL") {
    requirements = ["Multi-method NDE (surface + volumetric)", "Zero uncertainty tolerance", "Full engineering review mandatory", "Human adjudication before return to service", "All evidence traceable"];
  } else if (tier === "HIGH") {
    requirements = ["Primary + supplemental method", "Engineering review recommended", "Code validation mandatory", "Evidence traceability for critical findings"];
  } else if (tier === "MEDIUM") {
    requirements = ["Primary method with adequate coverage", "Code reference recommended"];
  } else {
    requirements = ["Visual + primary method sufficient"];
  }

  var consConf = 0.7;
  if (basis.length > 1) consConf += 0.1;
  if (damage.primary && damage.primary.reality_score > 0.6) consConf += 0.1;
  if (consConf > 1) consConf = 1;

  var thresholdScore = 15;
  var thresholdReasons: string[] = [];
  if (physics.field_interaction && physics.field_interaction.interaction_score > 50) {
    thresholdScore += 18;
    thresholdReasons.push("Multiple damage forces are interacting and amplifying each other at this location.");
  }
  if (damage.primary && damage.primary.observation_basis) {
    thresholdScore += 15;
    thresholdReasons.push("Damage mechanism (" + damage.primary.name + ") is evidenced by direct observation — this is not theoretical.");
  }
  if (damage.primary && (damage.primary.id.indexOf("fatigue") !== -1 || damage.primary.id.indexOf("scc") !== -1 || damage.primary.id.indexOf("ssc") !== -1)) {
    thresholdScore += 12;
    thresholdReasons.push("Active mechanism (" + damage.primary.name + ") has threshold behavior — stable until critical size, then rapid failure.");
  }
  if (tier === "CRITICAL") { thresholdScore += 15; thresholdReasons.push("CRITICAL consequence means threshold crossing has catastrophic impact."); }
  else if (tier === "HIGH") { thresholdScore += 8; }
  if (physics.time.service_years && physics.time.service_years > 15) { thresholdScore += 8; thresholdReasons.push("Extended service life (" + physics.time.service_years + " years) increases accumulated damage."); }
  if (physics.time.time_since_inspection_years && physics.time.time_since_inspection_years > 3) { thresholdScore += 5; thresholdReasons.push("Gap since last inspection (" + physics.time.time_since_inspection_years + " years) means current state is less certain."); }
  if (thresholdScore > 100) thresholdScore = 100;

  if (degradationCertainty === "UNVERIFIED" && thresholdScore >= 55) {
    thresholdScore = 48;
    thresholdReasons.push("Threshold capped: no confirmed or suspected damage evidence supports APPROACHING_THRESHOLD state.");
  }
  if (degradationCertainty === "UNVERIFIED" && !hasDamageEvidence && !hasAnyVisibleDamage) {
    if (thresholdScore >= 40) {
      thresholdReasons.push("Note: damage state is based on physics potential, not confirmed observations. Inspection needed to verify actual condition.");
    }
  }

  var damageState = "STABLE";
  var damageTrajectory = "";
  var monitoringUrgency = "Routine";
  if (thresholdScore >= 75) {
    damageState = "TRANSITION_RISK";
    damageTrajectory = "Asset may be at or near a critical damage threshold. Damage progression could accelerate suddenly. Immediate characterization and engineering review required.";
    monitoringUrgency = "Immediate";
  } else if (thresholdScore >= 55) {
    damageState = "APPROACHING_THRESHOLD";
    damageTrajectory = "Damage indicators suggest the asset is moving toward a critical state. Accelerated inspection and monitoring recommended before the next operating cycle.";
    monitoringUrgency = "Within 7 days";
  } else if (thresholdScore >= 35) {
    damageState = "DEGRADING";
    damageTrajectory = "Active damage mechanism present with gradual progression. Standard monitoring intervals should be maintained or tightened.";
    monitoringUrgency = "Within 30 days";
  } else {
    damageTrajectory = "No significant threshold indicators. Damage state appears stable under current conditions.";
    monitoringUrgency = "Routine interval";
  }

  return {
    consequence_tier: tier, failure_mode: failMode, failure_physics: failPhysics,
    consequence_basis: basis, human_impact: humanImpact, environmental_impact: envImpact,
    operational_impact: opImpact, enforcement_requirements: requirements,
    degradation_certainty: degradationCertainty, is_routine_inspection: isRoutine,
    damage_state: damageState, damage_trajectory: damageTrajectory,
    threshold_score: thresholdScore, threshold_reasons: thresholdReasons,
    monitoring_urgency: monitoringUrgency,
    consequence_confidence: roundN(consConf, 2)
  };
}

// ============================================================================
// PHYSICS COMPUTATIONS
// ============================================================================
function runPhysicsComputations(physics: any, numVals: any, assetClass: string, consequence: any) {
  var nv = numVals || {};
  var wallT = nv.wall_thickness_mm || null;
  var flawD = nv.flaw_depth_mm || nv.crack_depth_mm || null;
  var pressMpa = nv.operating_pressure_mpa || (nv.operating_pressure_psi ? nv.operating_pressure_psi * 0.00689476 : null);
  var radiusMm = nv.inside_radius_mm || (nv.inside_diameter_mm ? nv.inside_diameter_mm / 2 : null) || (nv.outside_diameter_mm && wallT ? (nv.outside_diameter_mm - 2 * wallT) / 2 : null);
  var cyclesPerDay = nv.cycles_per_day || null;
  var corrRate = nv.corrosion_rate_mm_per_year || null;
  var tMin = nv.minimum_thickness_mm || null;
  var currentT = nv.current_thickness_mm || wallT;

  var hoopMpa: number | null = null;
  if (pressMpa && radiusMm && wallT && wallT > 0) hoopMpa = pressMpa * (radiusMm / wallT);

  var parisC = nv.paris_c || 3e-13;
  var parisM = nv.paris_m || 3.1;
  var kic = nv.fracture_toughness || 120;
  var yieldMpa = nv.yield_strength_mpa || 250;
  var Y = nv.crack_shape_factor || 1.12;

  var fatigue: FatigueResult = { enabled: false, delta_k: null, growth_per_cycle_m: null, days_to_critical: null, status: "insufficient_input", narrative: "Fatigue computation requires flaw depth and stress data." };
  if (flawD && hoopMpa) {
    var aM = flawD / 1000;
    var deltaSigma = hoopMpa * 0.8;
    var deltaK = Y * deltaSigma * Math.sqrt(Math.PI * aM);
    if (deltaK < 5) {
      fatigue = { enabled: true, delta_k: roundN(deltaK, 2), growth_per_cycle_m: null, days_to_critical: null, status: "below_threshold", narrative: "Stress intensity range below practical propagation threshold." };
    } else {
      var envFactor = 1.0;
      if (physics.chemical.sour_service) envFactor *= 1.35;
      if (physics.chemical.chlorides_present) envFactor *= 1.2;
      if (physics.thermal.thermal_cycling) envFactor *= 1.15;
      var daPerCycle = parisC * Math.pow(deltaK, parisM) * envFactor;
      var daysToC: number | null = null;
      var aCritM = Math.pow(kic / (Y * (hoopMpa || 1)), 2) / Math.PI;
      var aCritMm = Math.min(aCritM * 1000, (wallT || 25) * 0.8);
      if (aCritMm > flawD && daPerCycle > 0) {
        var deltaAm = (aCritMm - flawD) / 1000;
        var cyclesToCrit = deltaAm / daPerCycle;
        if (cyclesPerDay && cyclesPerDay > 0) daysToC = roundN(cyclesToCrit / cyclesPerDay, 1);
      }
      fatigue = { enabled: true, delta_k: roundN(deltaK, 2), growth_per_cycle_m: daPerCycle, days_to_critical: daysToC,
        status: "active", narrative: daysToC !== null ? "Fatigue growth active. Estimated " + daysToC + " days to critical depth at current cycling." : "Fatigue growth active. Time-to-critical requires cycle rate data." };
    }
  }

  var critFlaw: CriticalFlawResult = { enabled: false, critical_depth_mm: null, stress_ratio: null, status: "insufficient_input", narrative: "Critical flaw computation requires stress and toughness data." };
  if (hoopMpa && kic && wallT) {
    var acM = Math.pow(kic / (Y * hoopMpa), 2) / Math.PI;
    var acMm = Math.min(acM * 1000, wallT * 0.8);
    var stressRatio = flawD ? roundN(flawD / acMm, 3) : null;
    critFlaw = { enabled: true, critical_depth_mm: roundN(acMm, 2), stress_ratio: stressRatio,
      status: "bounded", narrative: "Critical flaw depth estimated at " + roundN(acMm, 2) + "mm." + (stressRatio !== null ? " Current flaw is at " + roundN(stressRatio * 100, 1) + "% of critical." : "") };
  }

  var wallLoss: WallLossResult = { enabled: false, remaining_life_years: null, severity_ratio: null, status: "insufficient_input", narrative: "Wall loss computation requires thickness, minimum, and corrosion rate." };
  if (currentT && tMin && corrRate && corrRate > 0) {
    var yearsToTmin = (currentT - tMin) / corrRate;
    var sevRatio = 1 - ((currentT - tMin) / Math.max(currentT, 0.001));
    wallLoss = { enabled: true, remaining_life_years: roundN(yearsToTmin, 2), severity_ratio: roundN(sevRatio, 3),
      status: yearsToTmin <= 0 ? "critical" : "active",
      narrative: yearsToTmin <= 0 ? "Current thickness at or below minimum. Immediate action required." : "Estimated " + roundN(yearsToTmin, 2) + " years remaining to minimum thickness." };
  }

  var leakBurst: LeakBurstResult = { enabled: false, tendency: "INSUFFICIENT_INPUT", through_wall_risk: null, fracture_risk: null, narrative: "Leak-vs-burst requires flaw depth, wall thickness, and toughness." };
  if (flawD && wallT && hoopMpa && kic) {
    var twRisk = clamp(flawD / wallT, 0, 1);
    var pressSevRatio = clamp(hoopMpa / yieldMpa, 0, 1);
    var toughPenalty = kic < 60 ? 0.25 : kic < 100 ? 0.12 : 0.04;
    var fracRisk = clamp(0.45 * twRisk + 0.35 * pressSevRatio + toughPenalty, 0, 1);
    var tend = "LEAK_BEFORE_BREAK";
    if (pressSevRatio > 0.95) tend = "PLASTIC_COLLAPSE";
    else if (fracRisk > 0.75) tend = "BURST_FAVORED";
    else if (fracRisk > 0.6) tend = "UNSTABLE_FRACTURE";
    leakBurst = { enabled: true, tendency: tend, through_wall_risk: roundN(twRisk, 3), fracture_risk: roundN(fracRisk, 3),
      narrative: tend === "BURST_FAVORED" ? "Inputs favor catastrophic burst over benign leak. Escalation and volumetric characterization strongly indicated." :
        tend === "PLASTIC_COLLAPSE" ? "Stress approaches material capacity — plastic collapse risk." :
        tend === "UNSTABLE_FRACTURE" ? "Elevated fracture instability risk. Treat as escalation-level." :
        "Leak-before-break tendency favored, but does not reduce inspection rigor." };
  }

  return { fatigue: fatigue, critical_flaw: critFlaw, wall_loss: wallLoss, leak_vs_burst: leakBurst };
}


// ============================================================================
// STATE 4: AUTHORITY REALITY ENGINE
// ============================================================================
var AUTHORITY_MAP = [
  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho", "double lock", "saturation div", "recompression", "treatment chamber", "man-rated"],
    ac: ["pressure_vessel"], pri: "ASME PVHO-1",
    sec: ["ASME FFS-1 / API 579 (crack fitness-for-service)", "ASME Section VIII (construction basis)", "API 510 (inspection)", "ASME Section V (NDE procedures)"],
    cond: [{ code: "ADCI Standards", cond: "diving ops" }, { code: "IMCA D 024", cond: "international diving" }, { code: "Owner/operator qualification + manufacturer repair requirements", cond: "repair or modification" }],
    dw: "DESIGN: PRESSURIZED SYSTEM — current state may not represent design intent" },
  { kw: ["boiler", "steam drum", "superheater"], ac: ["pressure_vessel"],
    pri: "ASME Section I", sec: ["NB-23", "API 510"], cond: [], dw: null },
  { kw: ["pressure vessel", "separator", "column", "reactor vessel", "heat exchanger", "accumulator"],
    ac: ["pressure_vessel", "heat_exchanger"], pri: "API 510 + ASME Section VIII",
    sec: ["ASME Section V", "API 579-1"], cond: [{ code: "ASME PCC-2", cond: "repair" }], dw: null },
  { kw: ["piping", "pipe rack", "process piping", "header"],
    ac: ["piping"], pri: "API 570 + ASME B31.3", sec: ["ASME Section V", "API 579-1"],
    cond: [{ code: "ASME B31.1", cond: "power piping" }], dw: null },
  { kw: ["storage tank", "atmospheric tank"], ac: ["storage_tank", "tank"],
    pri: "API 653", sec: ["API 650", "API 579-1"], cond: [], dw: null },
  { kw: ["pipeline", "export corridor", "trunkline", "flowline", "riser"],
    ac: ["pipeline"], pri: "ASME B31.4/B31.8 + 49 CFR 192/195", sec: ["API 1160", "ASME B31G"],
    cond: [{ code: "DNV-ST-F101", cond: "submarine pipeline" }], dw: null },
  { kw: ["bridge", "overpass", "girder", "pier", "abutment", "railroad bridge", "rail bridge", "truss bridge", "through-truss"],
    ac: ["bridge", "rail_bridge"], pri: "AASHTO MBE + AWS D1.5", sec: ["AASHTO LRFD", "FHWA NBIS"], cond: [], dw: null },
  { kw: ["offshore", "platform", "jacket", "subsea", "fpso", "topside"],
    ac: ["offshore_platform"], pri: "API RP 2A", sec: ["API 579-1", "NACE SP0176"],
    cond: [{ code: "DNV-OS-C101", cond: "classification" }, { code: "BSEE", cond: "US federal waters" }], dw: null },
  { kw: ["rail", "railcar", "track", "thermite weld"],
    ac: ["rail"], pri: "AREMA Manual", sec: ["AAR Field Manual", "49 CFR 213"], cond: [], dw: null }
];

function resolveAuthorityReality(assetClass: string, transcript: string, consequence: any, physics: any) {
  var lt = transcript.toLowerCase();
  var matched: any = null;

  // AUTHORITY MATCHING — v2.3 FIX
  // Step 1: Find entries where BOTH asset class AND keywords match (most specific)
  // Step 2: If no keyword+class match, use the most generic class match (last in array)
  // This prevents PVHO-1 from matching generic pressure vessels
  var keywordClassMatch: any = null;
  var genericClassMatch: any = null;

  for (var ai = 0; ai < AUTHORITY_MAP.length; ai++) {
    var entry = AUTHORITY_MAP[ai];
    var classMatches = false;
    for (var asi = 0; asi < entry.ac.length; asi++) {
      if (assetClass === entry.ac[asi]) { classMatches = true; break; }
    }
    if (classMatches) {
      // Check if any keywords also match
      var kwMatches = false;
      for (var ki = 0; ki < entry.kw.length; ki++) {
        if (hasWord(lt, entry.kw[ki])) { kwMatches = true; break; }
      }
      if (kwMatches && !keywordClassMatch) {
        keywordClassMatch = entry;
      }
      // Always update generic — last class match wins (most generic entries are later)
      genericClassMatch = entry;
    }
  }

  // Prefer keyword+class match, fall back to generic class match
  matched = keywordClassMatch || genericClassMatch;

  // If no class match at all, try pure keyword match
  if (!matched) {
    for (var ri = 0; ri < AUTHORITY_MAP.length; ri++) {
      var r = AUTHORITY_MAP[ri];
      for (var ki2 = 0; ki2 < r.kw.length; ki2++) { if (hasWord(lt, r.kw[ki2])) { matched = r; break; } }
      if (matched) break;
    }
  }
  if (!matched) {
    return { primary_authority: "UNRESOLVED", secondary_authorities: [], conditional_authorities: [],
      physics_code_alignment: "No authority matched — engineering review required",
      code_gaps: ["No authority rule matched"], design_state_warning: null, authority_confidence: 0.3 };
  }
  var gaps: string[] = [];
  var alignment = "CONSISTENT — " + matched.pri + " provides framework for " + assetClass;

  var hasCrackIndication = hasWordNotNegated(lt, "crack") || hasWordNotNegated(lt, "indication") || hasWordNotNegated(lt, "flaw") || hasWordNotNegated(lt, "linear");
  if (consequence.consequence_tier === "CRITICAL" && matched.pri.indexOf("PVHO") !== -1) {
    if (hasCrackIndication) {
      alignment = "DUAL AUTHORITY REQUIRED: PVHO-1 governs occupancy/pressure boundary requirements. ASME FFS-1 / API 579 governs crack fitness-for-service evaluation. Both required for in-service crack disposition — PVHO-1 alone does not provide a crack acceptance basis.";
    } else {
      alignment = "CONSISTENT — PVHO-1 requires multi-method NDE for pressure boundary welds, aligning with physics requirement for CRITICAL consequence";
    }
  }

  if ((physics.stress.cyclic_loading || physics.chemical.corrosive_environment) && consequence.consequence_tier !== "LOW") {
    var hasFFS = false;
    for (var si = 0; si < matched.sec.length; si++) {
      if (matched.sec[si].indexOf("579") !== -1 || matched.sec[si].indexOf("FFS") !== -1) { hasFFS = true; }
    }
    if (!hasFFS) {
      gaps.push("Fitness-for-service assessment (ASME FFS-1 / API 579) recommended but not in authority chain");
    }
  }
  if (matched.pri.indexOf("PVHO") !== -1 && hasCrackIndication) {
    gaps.push(
      "Authority layering required: PVHO-1 (occupancy/construction standard) + ASME FFS-1 (crack evaluation basis) + NDE procedure basis + owner/operator requirements. Single-code resolution is insufficient for in-service crack disposition on a PVHO."
    );
  }

  var conf = 0.85 - gaps.length * 0.1;
  if (conf < 0.3) conf = 0.3;
  return { primary_authority: matched.pri, secondary_authorities: matched.sec,
    conditional_authorities: matched.cond, physics_code_alignment: alignment,
    code_gaps: gaps, design_state_warning: matched.dw, authority_confidence: roundN(conf, 2) };
}

// ============================================================================
// STATE 5: PHYSICS SUFFICIENCY ENGINE
// ============================================================================
var METHOD_BASELINES: any = {
  UT:   { surfSens: 35, subSens: 88, planar: 82, volumetric: 65, sizing: 70, singleSide: 85, coatTol: 35, roughTol: 45, magnetic: false, couplant: true,  prin: "Acoustic impedance mismatch (wave mechanics)", det: "Internal flaws, wall thickness, crack depth", cant: "Coarse-grain scatter, near-surface dead zone" },
  PAUT: { surfSens: 40, subSens: 92, planar: 90, volumetric: 72, sizing: 82, singleSide: 88, coatTol: 30, roughTol: 45, magnetic: false, couplant: true,  prin: "Multi-element acoustic beam steering", det: "Complex geometry flaws, crack sizing, volumetric scanning", cant: "Requires setup discipline, coupling stability" },
  TOFD: { surfSens: 20, subSens: 95, planar: 93, volumetric: 38, sizing: 90, singleSide: 30, coatTol: 25, roughTol: 40, magnetic: false, couplant: true,  prin: "Diffracted wave timing", det: "Crack height/depth sizing with high accuracy", cant: "Surface/near-surface dead zone, thin sections" },
  MT:   { surfSens: 94, subSens: 55, planar: 88, volumetric: 10, sizing: 20, singleSide: 90, coatTol: 35, roughTol: 60, magnetic: true,  couplant: false, prin: "Magnetic flux leakage (Maxwell equations)", det: "Surface + near-surface in ferromagnetic materials", cant: "Subsurface >6mm, non-ferromagnetic, no depth sizing" },
  PT:   { surfSens: 96, subSens: 0,  planar: 85, volumetric: 0,  sizing: 18, singleSide: 94, coatTol: 5,  roughTol: 35, magnetic: false, couplant: false, prin: "Capillary action + fluorescence/contrast", det: "Surface-breaking discontinuities only", cant: "Subsurface, porous surfaces, coated surfaces, no sizing" },
  ET:   { surfSens: 86, subSens: 52, planar: 75, volumetric: 12, sizing: 42, singleSide: 95, coatTol: 62, roughTol: 40, magnetic: false, couplant: false, prin: "Electromagnetic induction (eddy currents)", det: "Surface/near-surface cracks, conductivity changes, coating thickness", cant: "Deep subsurface, ferromagnetic interference, lift-off sensitivity" },
  RT:   { surfSens: 30, subSens: 75, planar: 35, volumetric: 90, sizing: 45, singleSide: 15, coatTol: 50, roughTol: 70, magnetic: false, couplant: false, prin: "Differential radiation absorption (Beer-Lambert law)", det: "Volumetric flaws (porosity, inclusions, voids)", cant: "Tight planar cracks parallel to beam, requires backside access" }
};
var ALL_METHODS = ["UT", "PAUT", "TOFD", "MT", "PT", "ET", "RT"];

function scoreMethodPhysics(method: string, damage: any, physics: any, consequence: any, transcript: string, flags: any) {
  var bl = METHOD_BASELINES[method];
  if (!bl) return null;
  var fl = flags || {};
  var lt = transcript.toLowerCase();
  var pm = damage.primary;
  var pmId = pm ? pm.id : "";
  var reasonsFor: string[] = [];
  var reasonsAgainst: string[] = [];
  var blindSpots: string[] = [];
  var complementary: string[] = [];

  var detectScore = 50;
  var isCrackType = pmId.indexOf("fatigue") !== -1 || pmId.indexOf("crack") !== -1 || pmId.indexOf("scc") !== -1 || pmId.indexOf("ssc") !== -1 || pmId.indexOf("hic") !== -1;
  var isCorrosionType = pmId.indexOf("corrosion") !== -1 || pmId.indexOf("pitting") !== -1 || pmId.indexOf("erosion") !== -1 || pmId.indexOf("cui") !== -1 || pmId.indexOf("wall_loss") !== -1;
  var isDeformation = pmId.indexOf("overload") !== -1 || pmId.indexOf("buckl") !== -1;
  var isFire = pmId.indexOf("fire") !== -1;

  if (isCrackType) {
    detectScore = (bl.planar * 0.6 + bl.subSens * 0.4);
    reasonsFor.push("Scored against planar discontinuity detection capability");
    if (bl.subSens < 30) { reasonsAgainst.push("Method cannot detect subsurface crack propagation"); blindSpots.push("Subsurface crack growth invisible to this method"); }
    if (bl.sizing < 40) { reasonsAgainst.push("Method cannot size crack depth — only length"); blindSpots.push("Crack depth unknown — remaining life calculation impossible"); }
  } else if (isCorrosionType) {
    detectScore = (bl.subSens * 0.5 + bl.volumetric * 0.3 + bl.surfSens * 0.2);
    reasonsFor.push("Scored against wall loss / corrosion mapping capability");
    if (bl.volumetric < 20 && bl.subSens < 30) { reasonsAgainst.push("Method cannot quantify wall thickness loss"); blindSpots.push("Remaining wall thickness unknown"); }
  } else if (isDeformation) {
    detectScore = bl.surfSens * 0.8 + 10;
    reasonsFor.push("Deformation is primarily surface-observable");
  } else if (isFire) {
    detectScore = bl.surfSens * 0.4 + bl.subSens * 0.3 + 15;
    reasonsFor.push("Fire damage assessment requires surface + property evaluation");
  } else {
    detectScore = (bl.surfSens + bl.subSens) / 2;
  }

  var sizingScore = bl.sizing;
  if (isCrackType && method === "TOFD") { sizingScore += 8; reasonsFor.push("TOFD excels at crack depth sizing via diffraction timing"); }
  if (isCrackType && method === "PAUT") { sizingScore += 6; reasonsFor.push("PAUT provides crack sizing via beam steering"); }
  if (isCrackType && (method === "MT" || method === "PT")) { sizingScore -= 15; reasonsAgainst.push("Surface methods provide crack length only — depth requires volumetric"); }
  if (isCorrosionType && (method === "UT" || method === "PAUT")) { sizingScore += 10; reasonsFor.push("UT/PAUT measures remaining wall thickness directly"); }

  var matScore = 75;
  if (method === "MT" && !hasWord(lt, "carbon steel") && !hasWord(lt, "ferritic") && !hasWord(lt, "low alloy")) {
    if (hasWord(lt, "stainless") || hasWord(lt, "austenitic") || hasWord(lt, "duplex") || hasWord(lt, "aluminum") || hasWord(lt, "titanium") || hasWord(lt, "nickel")) {
      matScore = 0; reasonsAgainst.push("MT PHYSICS GATE: Material is non-ferromagnetic — magnetic flux leakage cannot occur"); blindSpots.push("Method completely invalid for this material");
    } else {
      matScore = 80; reasonsFor.push("Material assumed ferromagnetic (carbon steel default)");
    }
  }
  if (method === "ET" && hasWord(lt, "carbon steel")) { matScore -= 10; reasonsAgainst.push("Carbon steel ferromagnetic response can interfere with ET"); }
  if ((method === "UT" || method === "PAUT" || method === "TOFD") && (hasWord(lt, "cast") || hasWord(lt, "casting"))) {
    matScore -= 25; reasonsAgainst.push("Cast material grain structure may attenuate/scatter ultrasonic energy");
  }
  if (method === "PT") { matScore = 88; reasonsFor.push("PT is material-agnostic if surface is open and clean"); }

  var geoScore = 75;
  if (method === "TOFD" && hasWord(lt, "fillet")) { geoScore -= 30; reasonsAgainst.push("TOFD geometry problematic for fillet welds"); }
  if ((method === "UT" || method === "PAUT") && hasWord(lt, "butt") || hasWord(lt, "circumferential")) { geoScore += 8; reasonsFor.push("Butt/circumferential weld geometry suits ultrasonic scanning"); }
  if (method === "TOFD" && hasWord(lt, "nozzle")) { geoScore -= 20; reasonsAgainst.push("Nozzle geometry restricts TOFD probe arrangement"); }
  if ((method === "MT" || method === "PT") && hasWord(lt, "complex")) { geoScore -= 8; }

  var orientScore = 70;
  if (isCrackType) {
    if (method === "UT" || method === "PAUT") {
      if (hasWord(lt, "circumferential")) { orientScore = 85; reasonsFor.push("UT/PAUT beam can be oriented perpendicular to circumferential cracks"); }
      else { orientScore = 75; }
    }
    if (method === "TOFD") { orientScore = 82; reasonsFor.push("TOFD detects diffracted energy regardless of reflector orientation"); }
    if (method === "MT" || method === "PT") { orientScore = 80; reasonsFor.push("Surface methods detect surface-breaking cracks regardless of orientation"); }
  }
  if (isCorrosionType && method === "TOFD") { orientScore = 40; reasonsAgainst.push("TOFD is not a corrosion mapping method"); }

  var surfScore = 78;
  if (hasWord(lt, "coated") || hasWord(lt, "painted") || hasWord(lt, "coating")) {
    if (method === "PT") { surfScore = 0; reasonsAgainst.push("PT requires bare surface — coating blocks capillary access"); blindSpots.push("Coating prevents penetrant application"); }
    if (method === "MT") { surfScore -= 25; reasonsAgainst.push("Coating reduces MT sensitivity — flux leakage attenuated"); }
    if (method === "ET") { surfScore -= 10; }
  }
  if (hasWord(lt, "rough") || hasWord(lt, "corroded surface") || hasWord(lt, "scale")) {
    if (method === "PT") { surfScore -= 35; reasonsAgainst.push("Rough/contaminated surface reduces penetrant reliability"); }
    if (method === "UT" || method === "PAUT" || method === "TOFD") { surfScore -= 15; reasonsAgainst.push("Poor surface degrades ultrasonic coupling"); }
  }
  if (fl.underwater_access_limited) {
    if (method === "PT") { surfScore = 0; reasonsAgainst.push("PT not feasible underwater"); blindSpots.push("Underwater environment prevents penetrant testing"); }
    if (method === "MT") { surfScore -= 15; }
    if (method === "UT" || method === "PAUT") { surfScore -= 8; reasonsFor.push("UT feasible underwater with proper procedure"); }
  }

  var accessScore = 75;
  if (method === "TOFD") { accessScore -= 20; reasonsAgainst.push("TOFD requires dual-side or wrap-around access for probe pair"); }
  if (method === "RT") { accessScore -= 25; reasonsAgainst.push("RT requires backside access for film/detector placement"); }
  if (method === "PAUT") { accessScore += 5; reasonsFor.push("PAUT beam steering compensates for limited access"); }
  if (method === "MT" || method === "PT" || method === "ET") { accessScore += 10; reasonsFor.push("Single-side surface access sufficient"); }

  var execScore = 76;
  if ((method === "UT" || method === "PAUT" || method === "TOFD") && fl.underwater_access_limited) {
    execScore -= 10; reasonsAgainst.push("Underwater execution requires specialized procedure and signal validation");
  }
  if (method === "PAUT") { execScore -= 5; reasonsAgainst.push("PAUT requires qualified setup — poor focal law strategy creates false confidence"); }

  var overall = (detectScore * 0.25 + sizingScore * 0.15 + matScore * 0.15 + geoScore * 0.10 + orientScore * 0.10 + surfScore * 0.10 + accessScore * 0.05 + execScore * 0.10);
  if (matScore === 0) overall = 0;
  if (surfScore === 0 && (method === "PT")) overall = 0;
  overall = clamp(overall, 0, 100);

  if ((method === "MT" || method === "PT") && isCrackType) { complementary.push("UT"); complementary.push("PAUT"); }
  if (method === "UT" && isCrackType) { complementary.push("TOFD"); complementary.push("MT"); }
  if (method === "PAUT" && isCrackType) { complementary.push("TOFD"); }
  if ((method === "MT" || method === "PT") && isCorrosionType) { complementary.push("UT"); }

  if (method === "PT") { blindSpots.push("Cannot detect subsurface discontinuities"); blindSpots.push("Cannot size depth"); }
  if (method === "MT") { blindSpots.push("Limited to ferromagnetic materials"); blindSpots.push("Depth penetration limited to ~6mm"); blindSpots.push("Cannot provide crack depth measurement"); }
  if (method === "UT") { blindSpots.push("Near-surface dead zone may miss shallow flaws"); blindSpots.push("Beam orientation mismatch can miss unfavorable reflectors"); }
  if (method === "PAUT") { blindSpots.push("Requires strong setup discipline"); blindSpots.push("Very rough surfaces reduce reliability"); }
  if (method === "TOFD") { blindSpots.push("Surface/near-surface dead zone"); blindSpots.push("Not effective for corrosion mapping"); }
  if (method === "RT") { blindSpots.push("Tight planar cracks parallel to beam are invisible"); blindSpots.push("Requires backside access"); }
  if (method === "ET") { blindSpots.push("Depth penetration limited"); blindSpots.push("Lift-off and geometry variation distort signals"); }

  return {
    method: method, physics_principle: bl.prin, detects: bl.det, cannot_detect: bl.cant,
    scores: { detectability: roundN(detectScore, 1), sizing: roundN(sizingScore, 1), material: roundN(matScore, 1),
      geometry: roundN(geoScore, 1), orientation: roundN(orientScore, 1), surface: roundN(surfScore, 1),
      access: roundN(accessScore, 1), execution: roundN(execScore, 1), overall: roundN(overall, 1) },
    verdict: overall >= 80 ? "SUFFICIENT" : overall >= 65 ? "SUFFICIENT_WITH_LIMITATIONS" : overall >= 50 ? "CONDITIONALLY_SUFFICIENT" : "INSUFFICIENT",
    reasons_for: reasonsFor, reasons_against: reasonsAgainst,
    blind_spots: blindSpots, complementary_methods: complementary,
    is_surface_only: bl.subSens < 30, is_volumetric: bl.subSens >= 60, can_size_depth: bl.sizing >= 60
  };
}

function resolveInspectionReality(damage: any, consequence: any, physics: any, transcript: string, flags: any) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var proposed: string[] = [];
  var nameMap: any = { "visual": "VT", "magnetic particle": "MT", "penetrant": "PT", "ultrasonic": "UT", "radiograph": "RT", "phased array": "PAUT", "eddy current": "ET", "x-ray": "RT", "tofd": "TOFD" };
  var keys = Object.keys(nameMap);
  for (var ki = 0; ki < keys.length; ki++) { if (hasWord(lt, keys[ki]) && proposed.indexOf(nameMap[keys[ki]]) === -1) proposed.push(nameMap[keys[ki]]); }
  for (var ai2 = 0; ai2 < ALL_METHODS.length; ai2++) { if (transcript.indexOf(ALL_METHODS[ai2]) !== -1 && proposed.indexOf(ALL_METHODS[ai2]) === -1) proposed.push(ALL_METHODS[ai2]); }

  var allScores: any[] = [];
  for (var mi = 0; mi < ALL_METHODS.length; mi++) {
    var score = scoreMethodPhysics(ALL_METHODS[mi], damage, physics, consequence, transcript, flags);
    if (score) allScores.push(score);
  }
  allScores.sort(function(a: any, b: any) { return b.scores.overall - a.scores.overall; });

  var assessments: MethodWeight[] = [];
  for (var pi = 0; pi < proposed.length; pi++) {
    var ms: any = null;
    for (var si = 0; si < allScores.length; si++) { if (allScores[si].method === proposed[pi]) { ms = allScores[si]; break; } }
    if (!ms) continue;
    assessments.push({ method: ms.method, physics_principle: ms.physics_principle, detects: ms.detects,
      cannot_detect: ms.cannot_detect, reliability: roundN(ms.scores.overall / 100, 2),
      coverage: roundN(ms.scores.detectability / 100, 2), limitations: ms.reasons_against });
  }

  var required: Array<{ method: string; physics_basis: string }> = [];
  var missing: string[] = [];

  var hasSurf = false; var hasVol = false; var hasDepthSizing = false;
  for (var asi = 0; asi < assessments.length; asi++) {
    var ms2: any = null;
    for (var si2 = 0; si2 < allScores.length; si2++) { if (allScores[si2].method === assessments[asi].method) { ms2 = allScores[si2]; break; } }
    if (ms2) { if (!ms2.is_volumetric && ms2.is_surface_only) hasSurf = true; if (ms2.is_volumetric) hasVol = true; if (ms2.can_size_depth) hasDepthSizing = true; }
  }

  var bestMethod = allScores.length > 0 ? allScores[0] : null;
  var bestProposed: any = null;
  for (var bpi = 0; bpi < allScores.length; bpi++) { if (proposed.indexOf(allScores[bpi].method) !== -1) { bestProposed = allScores[bpi]; break; } }

  if (consequence.consequence_tier === "CRITICAL") {
    required.push({ method: "Surface (MT/PT)", physics_basis: "Magnetic flux leakage or capillary action detects surface-breaking cracks at stress concentrations" });
    required.push({ method: "Volumetric (UT/PAUT)", physics_basis: "Acoustic impedance mismatch detects subsurface flaws invisible to surface methods" });
    required.push({ method: "Depth sizing (PAUT/TOFD)", physics_basis: "Crack depth measurement required for fracture mechanics remaining life calculation" });
    required.push({ method: "Thickness (UT)", physics_basis: "Through-wall transit time measures remaining wall for pressure integrity" });
    if (!hasSurf) missing.push("Surface NDE — physics: cannot characterize surface crack morphology without surface-sensitive method");
    if (!hasVol) missing.push("Volumetric NDE — physics: surface methods cannot detect subsurface crack propagation (acoustic/electromagnetic depth limitation)");
    if (!hasDepthSizing) missing.push("Depth sizing — physics: Paris Law crack growth calculation requires measured depth, surface methods provide length only");
  } else if (consequence.consequence_tier === "HIGH") {
    required.push({ method: "Primary NDE", physics_basis: "Method must be physically capable of detecting dominant damage mechanism" });
    if (!hasSurf && !hasVol) missing.push("At least one NDE method with detection capability for " + (damage.primary ? damage.primary.name : "expected damage"));
    if (physics.energy.stored_energy_significant && !hasVol) missing.push("Volumetric method required — pressure boundary integrity assessment needs subsurface characterization");
  } else if (consequence.consequence_tier === "MEDIUM") {
    required.push({ method: "Primary NDE", physics_basis: "Method appropriate for expected discontinuity type" });
    if (proposed.length === 0) missing.push("At least one inspection method");
  }

  if (damage.primary && damage.primary.id.indexOf("fatigue") !== -1 && !hasVol && consequence.consequence_tier !== "LOW") {
    if (missing.indexOf("Volumetric NDE — physics: surface methods cannot detect subsurface crack propagation (acoustic/electromagnetic depth limitation)") === -1) {
      missing.push("Crack depth sizing — physics: fatigue crack growth rate (Paris Law) requires measured depth. Surface methods give length only.");
    }
  }

  if (bestProposed && bestProposed.scores.overall < 50 && consequence.consequence_tier !== "LOW") {
    missing.push("Proposed method (" + bestProposed.method + ") scored " + bestProposed.scores.overall + "/100 — physics sufficiency is weak for this scenario. Best method: " + (bestMethod ? bestMethod.method + " (" + bestMethod.scores.overall + "/100)" : "unknown"));
  }

  // DEPLOY109 FIX 2: INSPECTION DOMAIN EXPANSION
  if (physics.thermal.fire_exposure && !fl.fire_property_degradation_confirmed && consequence.consequence_tier !== "LOW") {
    required.push({ method: "Hardness survey (post-fire)", physics_basis: "Fire degrades yield strength and toughness — original material properties cannot be assumed. Brinell/Vickers hardness mapping identifies strength-reduced zones before FFS assessment." });
    required.push({ method: "Metallographic replication (post-fire)", physics_basis: "Microstructural changes (grain coarsening, phase transformation, sensitization) from fire exposure cannot be detected by NDE. Replication or sampling required for damage classification." });
    missing.push("Materials testing required — fire exposure: hardness survey + microstructure replication needed BEFORE FFS assessment. Pre-fire material properties cannot be assumed for pressure boundary disposition.");
    missing.push("Time-at-temperature documentation required — fire duration and peak temperature needed to classify damage as: (a) recoverable property reduction, (b) phase transformation, or (c) true creep accumulation. Cannot distinguish without data.");
  }
  var structuralDeformation = (fl.visible_deformation && fl.primary_member_involved) || fl.support_collapse_confirmed || (hasWord(lt, "displace") && (hasWord(lt, "rack") || hasWord(lt, "frame") || hasWord(lt, "structure"))) || hasWord(lt, "lateral displacement") || (hasWord(lt, "anchor bolt") && hasWord(lt, "uplift")) || hasWord(lt, "bolt elongation") || hasWord(lt, "baseplate") && hasWord(lt, "uplift");
  if (structuralDeformation && physics.energy.stored_energy_significant) {
    required.push({ method: "Structural dimensional survey", physics_basis: "Structural displacement changes nozzle loads at the pressure boundary. Lateral displacement of 1+ inches generates nozzle moments beyond original design allowables in most configurations." });
    required.push({ method: "Bolt elongation + anchor bolt inspection", physics_basis: "Column baseplate uplift and bolt elongation indicate overload. Bolts may have yielded — prestress cannot be assumed. Settlement or further movement possible under operating load." });
    missing.push("Structural dimensional survey required — displacement magnitude must be quantified to calculate changed nozzle loads at pressure boundary (ASME B31.3 / WRC 452 nozzle load allowable check).");
    missing.push("Anchor bolt + baseplate inspection required — uplift gap indicates possible bolt yield. Structural stability must be confirmed before pressurization.");
  }
  if (hasWord(lt, "spring can") && (hasWord(lt, "bottom") || hasWord(lt, "bottomed"))) {
    missing.push("Spring support re-evaluation required — bottomed spring cans indicate thermal expansion overstress or support failure. Pipe loads at nozzles and structural connections must be recalculated before restart.");
  }

  var verdict = "SUFFICIENT";
  if (missing.length > 0 && consequence.consequence_tier === "CRITICAL") verdict = "BLOCKED";
  else if (missing.length > 0) verdict = "INSUFFICIENT";

  var recommendedPackage: string[] = [];
  var needsRecommendation = false;
  if (proposed.length === 0) needsRecommendation = true;
  if (missing.length > 0 && (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH")) needsRecommendation = true;
  if (needsRecommendation && bestMethod && bestMethod.scores.overall >= 50) {
    if (proposed.indexOf("VT") === -1) recommendedPackage.push("VT");
    if (!hasSurf) {
      if (!hasWord(lt, "stainless") && !hasWord(lt, "austenitic") && !hasWord(lt, "aluminum") && !hasWord(lt, "titanium")) {
        if (proposed.indexOf("MT") === -1) recommendedPackage.push("MT");
      } else {
        if (proposed.indexOf("PT") === -1) recommendedPackage.push("PT");
      }
    }
    if (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH" || (damage.primary && damage.primary.id.indexOf("fatigue") !== -1)) {
      if (!hasVol) {
        if (bestMethod.method === "PAUT" || bestMethod.method === "UT") {
          if (proposed.indexOf(bestMethod.method) === -1) recommendedPackage.push(bestMethod.method);
        } else {
          if (proposed.indexOf("UT") === -1) recommendedPackage.push("UT");
        }
      }
    }
    if (bestMethod.scores.overall >= 65 && recommendedPackage.indexOf(bestMethod.method) === -1 && proposed.indexOf(bestMethod.method) === -1) {
      recommendedPackage.push(bestMethod.method);
    }
    if (damage.validated && damage.validated.length > 0) {
      for (var dvi = 0; dvi < damage.validated.length; dvi++) {
        if (damage.validated[dvi].id.indexOf("corrosion") !== -1 || damage.validated[dvi].id === "pitting") {
          if (proposed.indexOf("UT") === -1 && recommendedPackage.indexOf("UT") === -1) recommendedPackage.push("UT");
          break;
        }
      }
    }
    if (physics.thermal.fire_exposure && recommendedPackage.indexOf("Hardness+Replication") === -1) recommendedPackage.push("Hardness+Replication");
  }

  var constraintScore = 0;
  var constraintWarnings: string[] = [];
  var truthQuality = "HIGH";
  if (hasWord(lt, "coated") || hasWord(lt, "coating") || hasWord(lt, "painted") || hasWord(lt, "insulation") || hasWord(lt, "jacketing") || hasWord(lt, "fireproof")) {
    constraintScore += 15;
    constraintWarnings.push("Coating/insulation may reduce sensitivity or block surface methods entirely. Results may understate actual condition.");
  }
  if (hasWord(lt, "rough") || hasWord(lt, "corroded surface") || hasWord(lt, "scale") || hasWord(lt, "rust") || hasWord(lt, "oxidat") || hasWord(lt, "discolor")) {
    constraintScore += 12;
    constraintWarnings.push("Rough or oxidized surface degrades coupling quality and indication clarity. Findings may be less reliable.");
  }
  if (hasWord(lt, "underwater") || hasWord(lt, "subsea") || (fl && fl.underwater_access_limited)) {
    constraintScore += 18;
    constraintWarnings.push("Underwater execution increases complexity. Signal quality and scan stability may be reduced.");
  }
  if (hasWord(lt, "rope access") || hasWord(lt, "scaffolding") || hasWord(lt, "confined") || hasWord(lt, "restricted access") || hasWord(lt, "limited access") || hasWord(lt, "limited downtime")) {
    constraintScore += 14;
    constraintWarnings.push("Limited access affects scan stability and coverage completeness. Inspector may not reach all areas.");
  }
  if (hasWord(lt, "online") || hasWord(lt, "in service") || hasWord(lt, "running")) {
    constraintScore += 10;
    constraintWarnings.push("Equipment in service during inspection. Vibration, temperature, or flow may affect results.");
  }
  if (hasWord(lt, "hot") || hasWord(lt, "elevated temperature") || (physics.thermal.operating_temp_f && physics.thermal.operating_temp_f > 200)) {
    constraintScore += 12;
    constraintWarnings.push("Elevated temperature may require special procedures and correction factors. Standard calibration may not apply.");
  }
  if (physics.thermal.fire_exposure) {
    constraintScore += 15;
    constraintWarnings.push("Fire event alters surface condition, scale formation, and material property variability — NDE results require extra validation against pre-fire baseline.");
  }
  if (constraintScore > 100) constraintScore = 100;

  if (constraintScore >= 50) {
    truthQuality = "UNRELIABLE";
    constraintWarnings.push("WARNING: Execution conditions significantly degrade result reliability. More data under these conditions may increase false confidence rather than truth. Consider improving conditions before trusting results.");
  } else if (constraintScore >= 30) {
    truthQuality = "DEGRADED";
    constraintWarnings.push("Execution conditions may reduce result quality. Interpret findings conservatively.");
  } else if (constraintScore >= 15) {
    truthQuality = "MODERATE";
  }

  var inspConf = 0.8;
  if (missing.length > 0) inspConf -= missing.length * 0.06;
  if (verdict === "BLOCKED") inspConf = Math.min(inspConf, 0.35);
  if (proposed.length === 0 && recommendedPackage.length > 0) inspConf = 0.35;
  else if (proposed.length === 0) inspConf = 0.2;
  if (bestProposed && bestProposed.scores.overall < 50) inspConf -= 0.15;
  if (constraintScore >= 30) inspConf -= 0.10;
  if (constraintScore >= 50) inspConf -= 0.10;
  if (truthQuality === "UNRELIABLE" && verdict === "SUFFICIENT") verdict = "SUFFICIENT_WITH_CONSTRAINTS";
  inspConf = clamp(inspConf, 0.1, 1.0);

  var physReason = "";
  if (verdict === "BLOCKED") {
    physReason = "CRITICAL consequence requires complete damage characterization. Physics gaps: " + missing.join("; ") + ". These are physics limitations — not code preferences or procedural suggestions.";
    if (recommendedPackage.length > 0) {
      physReason += " RECOMMENDED INSPECTION PATH: " + recommendedPackage.join(" + ") + ". Best scoring method: " + (bestMethod ? bestMethod.method + " (" + bestMethod.scores.overall + "/100)" : "unknown") + ". Disposition is blocked until required coverage is achieved — methods are NOT blocked.";
    }
  } else if (verdict === "INSUFFICIENT") {
    physReason = "Method coverage has physics gaps: " + missing.join("; ");
    if (recommendedPackage.length > 0) {
      physReason += " Recommended additions: " + recommendedPackage.join(" + ") + ".";
    }
  } else {
    physReason = "Proposed methods provide adequate physics coverage for " + consequence.consequence_tier + " consequence tier.";
    if (bestProposed) physReason += " Best proposed: " + bestProposed.method + " scored " + bestProposed.scores.overall + "/100.";
  }

  return { proposed_methods: proposed, recommended_package: recommendedPackage, method_assessments: assessments,
    all_method_scores: allScores, best_method: bestMethod,
    sufficiency_verdict: verdict, physics_reason: physReason,
    required_methods: required, missing_coverage: missing,
    constraint_analysis: { constraint_score: constraintScore, truth_quality: truthQuality, warnings: constraintWarnings },
    inspection_confidence: roundN(inspConf, 2) };
}

// ============================================================================
// REALITY CONFIDENCE ENGINE
// ============================================================================
function computeRealityConfidence(pC: number, dC: number, cC: number, aC: number, iC: number, penalty: number) {
  var overall = (pC * 0.24) + (dC * 0.22) + (cC * 0.18) + (aC * 0.18) + (iC * 0.18) - penalty;
  overall = clamp(overall, 0, 1);
  overall = roundN(overall, 2);
  var band = overall >= 0.87 ? "TRUSTED" : overall >= 0.72 ? "HIGH" : overall >= 0.55 ? "GUARDED" : overall >= 0.35 ? "LOW" : "VERY_LOW";
  var lock = false; var esc = false; var state = "trusted";
  var limits: string[] = [];
  if (aC < 0.60) { lock = true; limits.push("Authority confidence < 0.60"); }
  if (iC < 0.55) { lock = true; limits.push("Inspection confidence < 0.55"); }
  if (pC < 0.50) { lock = true; limits.push("Physics confidence < 0.50"); }
  if (overall < 0.58) { lock = true; limits.push("Overall confidence < 0.58"); }
  if (lock) { state = "blocked"; esc = true; }
  else if (overall < 0.72) { state = "escalated"; esc = true; limits.push("Overall < 0.72 escalation threshold"); }
  else if (band === "GUARDED") state = "guarded_use";
  return { physics_confidence: pC, damage_confidence: dC, consequence_confidence: cC,
    authority_confidence: aC, inspection_confidence: iC, overall: overall, band: band,
    certainty_state: state, decision_lock: lock, escalation_required: esc, limiting_factors: limits };
}

// ============================================================================
// CONTRADICTION DETECTOR
// ============================================================================
function detectContradictions(physics: any, damage: any, consequence: any, authority: any, inspection: any, transcript?: string, provenance?: any) {
  var flags: string[] = []; var penalty = 0;
  var lt = (transcript || "").toLowerCase();

  // ============================================================================
  // DEPLOY115: EXPANDED CONTRADICTION ENGINE
  // Detects physics/damage/inspection conflicts that demand resolution.
  // An elite system surfaces uncertainty — it doesn't hide it.
  // ============================================================================

  // --- PHYSICS-MECHANISM CONTRADICTIONS ---
  for (var vi = 0; vi < damage.validated.length; vi++) {
    var m = damage.validated[vi];
    if (m.id.indexOf("fatigue") !== -1 && !physics.stress.cyclic_loading) { flags.push("CONTRADICTION: Fatigue validated but no cyclic loading"); penalty += 0.15; }
    if (m.id.indexOf("corrosion") !== -1 && !physics.chemical.corrosive_environment) { flags.push("CONTRADICTION: Corrosion validated but no corrosive environment"); penalty += 0.12; }
    if (m.id.indexOf("creep") !== -1 && !physics.thermal.creep_range) { flags.push("CONTRADICTION: Creep validated but not in creep range"); penalty += 0.15; }
  }

  // --- COMPETING MECHANISM CONFLICTS ---
  var hasThinning = false; var hasCracking = false; var hasSCC = false;
  var thinningScore = 0; var crackingScore = 0;
  for (var ci = 0; ci < damage.validated.length; ci++) {
    var dm = damage.validated[ci];
    if (dm.id.indexOf("corrosion") !== -1 || dm.id.indexOf("pitting") !== -1 || dm.id === "erosion" || dm.id === "cui" || dm.id === "co2_corrosion") {
      hasThinning = true; if (dm.reality_score > thinningScore) thinningScore = dm.reality_score;
    }
    if (dm.id.indexOf("fatigue") !== -1) {
      hasCracking = true; if (dm.reality_score > crackingScore) crackingScore = dm.reality_score;
    }
    if (dm.id.indexOf("scc") !== -1 || dm.id.indexOf("ssc") !== -1 || dm.id.indexOf("hic") !== -1) {
      hasSCC = true; hasCracking = true; if (dm.reality_score > crackingScore) crackingScore = dm.reality_score;
    }
  }
  if (hasThinning && hasCracking && thinningScore >= 0.35 && crackingScore >= 0.35) {
    flags.push("CONFLICT: Both thinning (" + roundN(thinningScore, 2) + ") and cracking (" + roundN(crackingScore, 2) + ") mechanisms are plausible. Different damage modes require different inspection approaches. Resolution needed before single-mechanism disposition.");
    penalty += 0.08;
  }

  // --- ENVIRONMENT IMPLIES MECHANISM BUT EVIDENCE DOESN'T CONFIRM ---
  if (physics.chemical.h2s_present && !hasSCC) {
    flags.push("CONFLICT: H2S environment detected but no environmental cracking (SSC/HIC/SCC) validated. Absence of evidence is not evidence of absence — crack-specific NDE required to rule out.");
    penalty += 0.06;
  }
  if (physics.chemical.caustic_present && !hasSCC) {
    var hasCausticSCC = false;
    for (var csi = 0; csi < damage.validated.length; csi++) { if (damage.validated[csi].id === "scc_caustic") hasCausticSCC = true; }
    if (!hasCausticSCC) {
      flags.push("CONFLICT: Caustic/amine environment detected but Caustic SCC not validated. Service conditions support environmental cracking concern.");
      penalty += 0.05;
    }
  }

  // --- METHOD-MECHANISM GAPS ---
  if (hasCracking || hasSCC) {
    var hasCrackMethod = false;
    if (inspection.proposed_methods) {
      for (var pm = 0; pm < inspection.proposed_methods.length; pm++) {
        var mName = inspection.proposed_methods[pm].method || inspection.proposed_methods[pm];
        if (mName === "MT" || mName === "PT" || mName === "PAUT" || mName === "TOFD" || mName === "ACFM" || mName === "ET") hasCrackMethod = true;
      }
    }
    if (!hasCrackMethod) {
      flags.push("CONFLICT: Cracking mechanism plausible but no crack-specific NDE method (MT/PT/PAUT/TOFD) in inspection plan. Cannot confirm or rule out cracking without appropriate method.");
      penalty += 0.10;
    }
  }

  // --- AMBIGUOUS NDE QUALITY SIGNALS (from transcript) ---
  var ambiguitySignals: string[] = [];
  if (lt.indexOf("jumpy") !== -1) ambiguitySignals.push("jumpy UT signal");
  if (lt.indexOf("messy") !== -1) ambiguitySignals.push("messy coupling/signal");
  if (lt.indexOf("hard to tell") !== -1) ambiguitySignals.push("indeterminate indication");
  if (lt.indexOf("not sure") !== -1) ambiguitySignals.push("inspector uncertainty");
  if (lt.indexOf("not super clean") !== -1 || lt.indexOf("not clean") !== -1) ambiguitySignals.push("unclear NDE result");
  if (lt.indexOf("faint") !== -1) ambiguitySignals.push("faint/marginal indication");
  if (lt.indexOf("might be") !== -1 || lt.indexOf("could be") !== -1 || lt.indexOf("or something") !== -1) ambiguitySignals.push("uncertain mechanism identification");
  if (lt.indexOf("junk geometry") !== -1 || lt.indexOf("geometry artifact") !== -1) ambiguitySignals.push("possible geometry artifact");
  if (lt.indexOf("doesn't look right") !== -1 || lt.indexOf("doesn't look right") !== -1) ambiguitySignals.push("visual anomaly uncharacterized");
  if (ambiguitySignals.length >= 2) {
    flags.push("CONFLICT: Multiple ambiguous NDE signals detected (" + ambiguitySignals.join(", ") + "). Investigation quality may be insufficient for definitive disposition. Targeted re-examination recommended.");
    penalty += 0.07;
  } else if (ambiguitySignals.length === 1) {
    flags.push("WARNING: Ambiguous NDE signal: " + ambiguitySignals[0] + ". Confirmation or supplemental method recommended.");
    penalty += 0.03;
  }

  // --- ASSET CLASSIFICATION + CONSEQUENCE CONFLICTS ---
  if (consequence.consequence_tier === "CRITICAL" && inspection.sufficiency_verdict !== "BLOCKED" && inspection.proposed_methods.length < 2) {
    flags.push("WARNING: CRITICAL consequence with <2 methods"); penalty += 0.05;
  }
  if (authority.code_gaps.length > 0 && (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH")) {
    flags.push("WARNING: Code gaps on " + consequence.consequence_tier + " asset"); penalty += 0.08;
  }

  // --- INSPECTION INTERVAL ADEQUACY ---
  if (physics.time.time_since_inspection_years && physics.time.time_since_inspection_years >= 5) {
    if (hasThinning && thinningScore >= 0.5) {
      flags.push("WARNING: " + physics.time.time_since_inspection_years + " years since last inspection with active thinning mechanism. Growth rate and interval adequacy should be evaluated — damage may have accelerated since prior clean inspection.");
      penalty += 0.04;
    }
  }

  // --- HIGH DAMAGE + LOW METHOD CONFIDENCE ---
  if (damage.damage_confidence >= 0.6 && inspection.inspection_confidence < 0.6) {
    flags.push("CONFLICT: Damage confidence (" + roundN(damage.damage_confidence, 2) + ") exceeds inspection confidence (" + roundN(inspection.inspection_confidence, 2) + "). Methods may not be adequate to characterize the identified damage mechanisms.");
    penalty += 0.06;
  }

  // --- MULTIPLE UNVERIFIED MECHANISMS ON HIGH CONSEQUENCE ---
  var unverifiedCount = 0;
  for (var uvi = 0; uvi < damage.validated.length; uvi++) {
    if (damage.validated[uvi].reality_state === "unverified" || damage.validated[uvi].reality_state === "possible") unverifiedCount++;
  }
  if (unverifiedCount >= 3 && (consequence.consequence_tier === "HIGH" || consequence.consequence_tier === "CRITICAL")) {
    flags.push("WARNING: " + unverifiedCount + " unverified/possible mechanisms on " + consequence.consequence_tier + " asset. Mechanism set not sufficiently resolved for confident disposition.");
    penalty += 0.05;
  }


  // DEPLOY122: PROVENANCE TRUST PENALTY
  // If the overall evidence base is weak (mostly inferred/unverified),
  // add a confidence penalty.
  if (provenance && provenance.provenance_summary) {
    var trustBand = provenance.provenance_summary.trust_band;
    if (trustBand === "VERY_LOW") {
      flags.push("WARNING: Evidence base is primarily unverified/inferred (trust band: VERY_LOW). Disposition should not rely on current evidence quality.");
      penalty += 0.10;
    } else if (trustBand === "LOW") {
      flags.push("WARNING: Evidence trust band is LOW — most claims are reported or inferred, not measured. Additional measured data recommended.");
      penalty += 0.05;
    }
  }

  if (penalty > 0.4) penalty = 0.4;
  return { flags: flags, penalty: roundN(penalty, 2) };
}

// ============================================================================
// STATE 6: DECISION REALITY ENGINE
// ============================================================================
function resolveDecisionReality(physics: any, damage: any, consequence: any, authority: any, inspection: any, confidence: any, contradictions: any, flags: any, computations: any) {
  var fl = flags || {};
  var gates: PrecedenceGate[] = [];
  var hardLocks: HardLock[] = [];
  var trace: string[] = [];
  var blocked = false; var escalated = false; var blockGate = "";

  trace.push("PHYSICS: " + physics.physics_summary);
  if (damage.primary) trace.push("DAMAGE: Primary = " + damage.primary.name + " (" + damage.primary.reality_state + ", score " + damage.primary.reality_score + ")");
  trace.push("CONSEQUENCE: " + consequence.consequence_tier + " — " + consequence.failure_mode);
  trace.push("AUTHORITY: " + authority.primary_authority);
  trace.push("INSPECTION: " + inspection.sufficiency_verdict + " — " + inspection.proposed_methods.join(", "));
  trace.push("CONFIDENCE: " + confidence.overall + " (" + confidence.band + ")");

  gates.push({ gate: "physics_reality", result: "PASS", reason: "Physics characterized (" + physics.physics_confidence + " confidence)", required_action: null });

  if (consequence.consequence_tier === "CRITICAL" && (confidence.decision_lock || inspection.sufficiency_verdict === "BLOCKED")) {
    gates.push({ gate: "life_safety", result: "BLOCKED", reason: "CRITICAL life-safety asset with insufficient evidence/methods", required_action: "Complete ALL critical-tier requirements" });
    blocked = true; blockGate = "life_safety";
    trace.push("GATE BLOCKED: Life safety — " + consequence.human_impact);
  } else if (consequence.consequence_tier === "CRITICAL" && inspection.constraint_analysis && (inspection.constraint_analysis.truth_quality === "UNRELIABLE" || inspection.constraint_analysis.truth_quality === "DEGRADED")) {
    gates.push({ gate: "life_safety", result: "BLOCKED", reason: "CRITICAL life-safety asset with " + inspection.constraint_analysis.truth_quality + " truth quality (" + inspection.constraint_analysis.constraint_score + "/100). Results may not represent actual condition.", required_action: "Improve inspection conditions or collect additional evidence before disposition" });
    blocked = true; blockGate = "life_safety";
    trace.push("GATE BLOCKED: Life safety — truth quality " + inspection.constraint_analysis.truth_quality);
  } else if (consequence.consequence_tier === "CRITICAL" && consequence.degradation_certainty !== "CONFIRMED" && consequence.degradation_certainty !== "PROBABLE") {
    gates.push({ gate: "life_safety", result: "BLOCKED", reason: "CRITICAL life-safety asset with " + (consequence.degradation_certainty || "UNVERIFIED") + " degradation state. Subsurface condition not verified. Inspection required before disposition.", required_action: "Complete inspection to verify actual condition before return to service" });
    blocked = true; blockGate = "life_safety";
    trace.push("GATE BLOCKED: Life safety — degradation " + consequence.degradation_certainty);
  } else {
    gates.push({ gate: "life_safety", result: consequence.consequence_tier === "CRITICAL" ? "INFO" : "PASS",
      reason: consequence.consequence_tier === "CRITICAL" ? "CRITICAL asset — elevated scrutiny" : "Not CRITICAL life-safety", required_action: null });
  }

  var hasUnverified = false;
  for (var uvi = 0; uvi < damage.validated.length; uvi++) { if (damage.validated[uvi].reality_state === "unverified" || damage.validated[uvi].reality_state === "possible") hasUnverified = true; }
  if (hasUnverified && (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH")) {
    gates.push({ gate: "consequence_severity", result: "ESCALATED", reason: "Unverified mechanisms on " + consequence.consequence_tier + " asset", required_action: "Verify all mechanism claims" });
    escalated = true;
  } else {
    gates.push({ gate: "consequence_severity", result: "PASS", reason: "Severity consistent with evidence", required_action: null });
  }

  if (confidence.decision_lock) {
    gates.push({ gate: "evidence_sufficiency", result: "BLOCKED", reason: "Confidence below threshold: " + confidence.limiting_factors.join("; "),
      required_action: "Collect evidence for " + consequence.consequence_tier + " tier" });
    if (!blocked) { blocked = true; blockGate = "evidence_sufficiency"; }
  } else {
    // ============================================================================
    // DEPLOY117: MECHANISM-AWARE EVIDENCE SUFFICIENCY
    // Evidence may be sufficient for the primary mechanism but insufficient
    // for competing mechanisms. "Evidence sufficient" only applies to what
    // has been confirmed — suspected mechanisms need their own assessment.
    // ============================================================================
    var evidenceNotes: string[] = [];
    var evidenceResult = "PASS";
    if (damage.primary && damage.primary.observation_basis) {
      evidenceNotes.push("Evidence sufficient for " + damage.primary.name + " (observed)");
    } else if (damage.primary) {
      evidenceNotes.push("Evidence limited for " + damage.primary.name + " (inferred, not directly observed)");
      evidenceResult = "WARNING";
    }
    // Check for competing mechanisms without observation basis
    var unobservedCompetitors: string[] = [];
    for (var esi = 0; esi < damage.validated.length; esi++) {
      var esm = damage.validated[esi];
      if (esm !== damage.primary && esm.reality_score >= 0.35 && !esm.observation_basis) {
        unobservedCompetitors.push(esm.name);
      }
    }
    if (unobservedCompetitors.length > 0) {
      evidenceNotes.push("Insufficient evidence for: " + unobservedCompetitors.join(", ") + " — supplemental examination needed");
      if (evidenceResult === "PASS") evidenceResult = "WARNING";
    }
    var evidenceReason = evidenceNotes.length > 0 ? evidenceNotes.join(". ") : "Evidence sufficient";
    var evidenceAction = evidenceResult === "WARNING" ? "Confirm or rule out unobserved competing mechanisms" : null;
    gates.push({ gate: "evidence_sufficiency", result: evidenceResult, reason: evidenceReason, required_action: evidenceAction });
  }

  if (inspection.sufficiency_verdict === "BLOCKED") {
    gates.push({ gate: "method_sufficiency", result: "BLOCKED", reason: "Methods physically insufficient: " + inspection.missing_coverage.join("; "),
      required_action: "Add required methods — physics limitations, not preferences" });
    if (!blocked) { blocked = true; blockGate = "method_sufficiency"; }
  } else if (inspection.sufficiency_verdict === "INSUFFICIENT") {
    gates.push({ gate: "method_sufficiency", result: "WARNING", reason: "Gaps: " + inspection.missing_coverage.join("; "), required_action: "Consider supplemental methods" });
  } else {
    gates.push({ gate: "method_sufficiency", result: "PASS", reason: "Adequate coverage", required_action: null });
  }

  if (authority.code_gaps.length > 2) {
    gates.push({ gate: "authority_validation", result: "BLOCKED", reason: "Multiple authority gaps", required_action: "Resolve governing authority" });
    if (!blocked) { blocked = true; blockGate = "authority_validation"; }
  } else if (authority.code_gaps.length > 0) {
    gates.push({ gate: "authority_validation", result: "WARNING", reason: authority.code_gaps.join("; "), required_action: "Verify authority" });
  } else {
    gates.push({ gate: "authority_validation", result: "PASS", reason: "Authority validated", required_action: null });
  }

  if (contradictions.flags.length > 0) {
    var hasCont = false;
    for (var cfi = 0; cfi < contradictions.flags.length; cfi++) { if (contradictions.flags[cfi].indexOf("CONTRADICTION") !== -1) hasCont = true; }
    gates.push({ gate: "contradiction", result: hasCont ? "ESCALATED" : "WARNING",
      reason: contradictions.flags.join("; "), required_action: hasCont ? "Resolve contradictions" : null });
    if (hasCont) escalated = true;
    for (var ct = 0; ct < contradictions.flags.length; ct++) trace.push("SELF-AUDIT: " + contradictions.flags[ct]);
  } else {
    gates.push({ gate: "contradiction", result: "PASS", reason: "No contradictions", required_action: null });
  }

  var compEsc: string[] = [];
  if (computations.fatigue.enabled && computations.fatigue.days_to_critical !== null && computations.fatigue.days_to_critical < 90) {
    compEsc.push("Fatigue: " + computations.fatigue.days_to_critical + " days to critical");
  }
  if (computations.critical_flaw.enabled && computations.critical_flaw.stress_ratio !== null && computations.critical_flaw.stress_ratio > 0.7) {
    compEsc.push("Flaw at " + roundN(computations.critical_flaw.stress_ratio * 100, 0) + "% of critical depth");
  }
  if (computations.leak_vs_burst.enabled && (computations.leak_vs_burst.tendency === "BURST_FAVORED" || computations.leak_vs_burst.tendency === "UNSTABLE_FRACTURE" || computations.leak_vs_burst.tendency === "PLASTIC_COLLAPSE")) {
    compEsc.push("Failure tendency: " + computations.leak_vs_burst.tendency);
  }
  if (computations.wall_loss.enabled && computations.wall_loss.remaining_life_years !== null && computations.wall_loss.remaining_life_years < 1) {
    compEsc.push("Wall loss: " + computations.wall_loss.remaining_life_years + " years remaining");
  }
  if (compEsc.length > 0) {
    gates.push({ gate: "physics_computation", result: "ESCALATED", reason: "Computation escalation: " + compEsc.join("; "),
      required_action: "Engineering review with computation data" });
    escalated = true;
    for (var cei = 0; cei < compEsc.length; cei++) trace.push("COMPUTATION: " + compEsc[cei]);
  } else {
    gates.push({ gate: "physics_computation", result: "PASS", reason: "No computation escalation", required_action: null });
  }

  if (blocked) {
    gates.push({ gate: "disposition_eligibility", result: "BLOCKED", reason: "Blocked at: " + blockGate, required_action: "Resolve blocking gates" });
  } else if (escalated) {
    gates.push({ gate: "disposition_eligibility", result: "ESCALATED", reason: "Escalation required", required_action: "Engineering/Level III review" });
  } else {
    gates.push({ gate: "disposition_eligibility", result: "PASS", reason: "All gates passed", required_action: null });
  }

  if (fl.through_wall_leak_confirmed && fl.pressure_boundary_involved) {
    hardLocks.push({ code: "HL_THROUGH_WALL_LEAK", reason: "Through-wall leak on pressure boundary", disposition: "NO GO",
      physics_basis: "Active breach — containment lost" }); trace.push("HARD LOCK: Through-wall leak — NO GO");
  }
  if (fl.crack_confirmed && fl.primary_member_involved) {
    hardLocks.push({ code: "HL_PRIMARY_CRACK", reason: "Confirmed crack in primary member", disposition: "NO GO",
      physics_basis: "Crack in primary load path — fracture risk" }); trace.push("HARD LOCK: Primary crack — NO GO");
  }
  if (fl.support_collapse_confirmed) {
    hardLocks.push({ code: "HL_SUPPORT_COLLAPSE", reason: "Support collapse confirmed", disposition: "NO GO",
      physics_basis: "Load path interrupted" }); trace.push("HARD LOCK: Support collapse — NO GO");
  }
  if (fl.fire_exposure && !fl.fire_property_degradation_confirmed && consequence.consequence_tier !== "LOW") {
    hardLocks.push({ code: "HL_FIRE_NO_VALIDATION", reason: "Fire-exposed, properties not validated", disposition: "REPAIR BEFORE RESTART",
      physics_basis: "Fire degrades material — unknown until tested" });
  }
  if (fl.visible_deformation && fl.primary_member_involved) {
    hardLocks.push({ code: "HL_MAJOR_DEFORMATION", reason: "Major deformation in primary structural member", disposition: "REPAIR BEFORE RESTART",
      physics_basis: "Permanent deformation changes load distribution — structural geometry no longer matches design basis" });
    trace.push("HARD LOCK: Major deformation — REPAIR BEFORE RESTART");
  }
  if (fl.critical_wall_loss_confirmed) {
    hardLocks.push({ code: "HL_CRITICAL_WALL_LOSS", reason: "Wall below code minimum", disposition: "REPAIR BEFORE RESTART",
      physics_basis: "Insufficient wall for hoop stress" });
  }

  var disposition = ""; var disposBasis = "";
  if (hardLocks.length > 0) {
    var hasNoGo = false;
    for (var hli = 0; hli < hardLocks.length; hli++) { if (hardLocks[hli].disposition === "NO GO") hasNoGo = true; }
    disposition = hasNoGo ? "no_go" : "repair_before_restart";
    disposBasis = "Hard lock(s): " + hardLocks.map(function(h) { return h.code; }).join(", ");
    trace.push("DISPOSITION: " + disposition + " — " + disposBasis);
  } else if (blocked) {
    disposition = "hold_for_review";
    disposBasis = "Blocked by " + blockGate + ". " + inspection.physics_reason;
    trace.push("DISPOSITION: hold_for_review — " + disposBasis);
  } else if (escalated) {
    disposition = "engineering_review_required";
    disposBasis = "Precedence chain escalated — engineering review required";
    trace.push("DISPOSITION: engineering_review_required");
  } else if (consequence.consequence_tier === "HIGH" || consequence.consequence_tier === "CRITICAL") {
    if (inspection.constraint_analysis && (inspection.constraint_analysis.truth_quality === "UNRELIABLE" || inspection.constraint_analysis.truth_quality === "DEGRADED")) {
      disposition = "hold_for_review";
      disposBasis = consequence.consequence_tier + " consequence with " + inspection.constraint_analysis.truth_quality + " truth quality. Additional characterization required.";
      trace.push("DISPOSITION: hold_for_review — truth quality " + inspection.constraint_analysis.truth_quality);
    } else if (consequence.degradation_certainty === "UNVERIFIED" || consequence.degradation_certainty === "SUSPECTED") {
      disposition = "hold_for_review";
      disposBasis = consequence.consequence_tier + " consequence with " + (consequence.degradation_certainty || "UNVERIFIED") + " degradation state. Condition must be verified before return to service.";
      trace.push("DISPOSITION: hold_for_review — degradation " + consequence.degradation_certainty);
    } else {
      disposition = "conditional_go";
      disposBasis = "All gates passed but " + consequence.consequence_tier + " consequence requires monitoring";
      trace.push("DISPOSITION: conditional_go with monitoring");
    }
  } else {
    disposition = "go";
    disposBasis = "All gates passed, evidence sufficient, methods adequate";
    trace.push("DISPOSITION: go");
  }

  var recovery: RecoveryItem[] = [];
  var pri = 1;
  for (var gi = 0; gi < gates.length; gi++) {
    var g = gates[gi];
    if (g.result === "BLOCKED" || g.result === "ESCALATED") {
      recovery.push({ priority: pri++, action: g.required_action || "Resolve " + g.gate,
        physics_reason: g.reason,
        who: g.gate === "life_safety" ? "Operations + Engineering" : g.gate === "method_sufficiency" ? "NDE Level II/III" : g.gate === "authority_validation" ? "Engineer" : "Qualified reviewer" });
    }
  }
  for (var mci2 = 0; mci2 < inspection.missing_coverage.length; mci2++) {
    var mcItem = inspection.missing_coverage[mci2];
    var mcWho = "NDE Level II/III";
    if (mcItem.indexOf("hardness") !== -1 || mcItem.indexOf("materials") !== -1 || mcItem.indexOf("replication") !== -1 || mcItem.indexOf("Materials testing") !== -1) mcWho = "Materials Engineer / Metallurgist";
    else if (mcItem.indexOf("survey") !== -1 || mcItem.indexOf("bolt") !== -1 || mcItem.indexOf("structural") !== -1 || mcItem.indexOf("Structural") !== -1) mcWho = "Structural Engineer";
    recovery.push({ priority: pri++, action: "Add: " + mcItem, physics_reason: "Detection physics gap", who: mcWho });
  }

  var strategy: StrategyPhase[] = [];
  var p1Time = disposition === "no_go" || consequence.consequence_tier === "CRITICAL" ? "Within 1 hour" : consequence.consequence_tier === "HIGH" ? "Within 4 hours" : "Within 24 hours";
  var p1Acts = ["Isolate affected area", "Verify personnel safety"];
  if (consequence.consequence_tier === "CRITICAL") p1Acts.push("Confirm no personnel exposure");
  if (physics.energy.stored_energy_significant) p1Acts.push("Verify isolation from pressure source");
  if (physics.thermal.fire_exposure) p1Acts.push("Document fire extent, temperature estimates, duration, and affected equipment list");
  p1Acts.push("Document as-found conditions");
  strategy.push({ phase: 1, name: "Immediate Safety", objective: "Ensure safety, isolate, document",
    actions: p1Acts, gate: "Safe to proceed with characterization?", time_frame: p1Time });

  var p2Acts = ["Perform primary NDE for " + (damage.primary ? damage.primary.name : "dominant mechanism")];
  for (var mc3 = 0; mc3 < inspection.missing_coverage.length; mc3++) p2Acts.push("ADD: " + inspection.missing_coverage[mc3]);
  p2Acts.push("Quantify indication size, depth, location");
  if (physics.energy.stored_energy_significant) p2Acts.push("Wall thickness survey");
  if (authority.code_gaps.length > 0) p2Acts.push("Confirm governing code: " + authority.primary_authority);
  strategy.push({ phase: 2, name: "Characterization & NDE", objective: "Quantify damage, verify mechanism, collect data",
    actions: p2Acts, gate: "Sufficient data for engineering assessment?", time_frame: consequence.consequence_tier === "CRITICAL" ? "Within 24 hours" : "Within 72 hours" });

  var p3Acts = ["Fitness-for-service per " + authority.primary_authority];
  if (computations.fatigue.enabled) p3Acts.push("Fatigue life assessment (Paris Law growth data available)");
  if (computations.critical_flaw.enabled) p3Acts.push("Critical flaw evaluation (threshold data available)");
  if (computations.wall_loss.enabled) p3Acts.push("Remaining life assessment (corrosion rate data available)");
  if (physics.thermal.fire_exposure) p3Acts.push("Post-fire FFS assessment per API 579 Part 11");
  p3Acts.push("Develop repair plan if required");
  strategy.push({ phase: 3, name: "Engineering Analysis", objective: "FFS, remaining life, repair planning",
    actions: p3Acts, gate: "Fit for continued service?", time_frame: "Per engineering schedule" });

  var p4Acts: string[] = [];
  if (disposition === "no_go" || disposition === "repair_before_restart") { p4Acts.push("Execute approved repair"); p4Acts.push("Repair verification NDE"); p4Acts.push("Engineering sign-off"); }
  p4Acts.push("Complete documentation and report");
  p4Acts.push("Update integrity database");
  p4Acts.push("Establish re-inspection date");
  strategy.push({ phase: 4, name: "Resolution & Return to Service", objective: "Repair, verify, document, close",
    actions: p4Acts, gate: "Return to service authorized?", time_frame: "Per operations schedule" });

  return { disposition: disposition, disposition_basis: disposBasis, gates: gates,
    guided_recovery: recovery, phased_strategy: strategy, hard_locks: hardLocks, decision_trace: trace };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
var handler: Handler = async function(event: HandlerEvent) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  var startMs = Date.now();
  try {
    var body = JSON.parse(event.body || "{}");
    var parsed = body.parsed || {};
    var asset = body.asset || {};
    var confirmedFlags = body.confirmed_flags || null;
    var evidenceProvenance = body.evidence_provenance || null;
    var transcript = body.transcript || parsed.raw_text || "";
    var assetClass = asset.asset_class || "unknown";
    var events = parsed.events || [];
    var numVals = parsed.numeric_values || {};
    var lt_handler = transcript.toLowerCase();

    // ASSET ALIAS CORRECTION
    var assetCorrected = false;
    var assetCorrectionReason = "";
    var isHyperbaricLocked = false;
    if (hasWord(lt_handler, "decompression chamber") || hasWord(lt_handler, "recompression chamber") || hasWord(lt_handler, "double lock") || hasWord(lt_handler, "hyperbaric chamber") || hasWord(lt_handler, "hyperbaric") || hasWord(lt_handler, "diving bell") || hasWord(lt_handler, "dive system") || hasWord(lt_handler, "pvho") || hasWord(lt_handler, "man-rated") || hasWord(lt_handler, "personnel chamber") || hasWord(lt_handler, "saturation div") || hasWord(lt_handler, "sat system") || hasWord(lt_handler, "living chamber") || hasWord(lt_handler, "transfer under pressure") || hasWord(lt_handler, "personnel transfer capsule")) {
      if (assetClass !== "pressure_vessel") {
        assetClass = "pressure_vessel";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes hyperbaric/diving pressure chamber. Overriding upstream classification (" + (asset.asset_class || "unknown") + ") to pressure_vessel.";
      }
      isHyperbaricLocked = true;
    }

    // ============================================================================
    // DEPLOY115: STRUCTURAL DOMAIN LOCK
    // Prevents piping/vessel/tank overrides when the asset is structural.
    // A bridge is NEVER treated as piping. A structural girder is NEVER a vessel.
    // Structural lock fires when upstream classification is structural AND
    // transcript contains structural signals confirming the domain.
    // DEPLOY162 v2.5.1: short-keyword signals now use hasWordBoundary to prevent
    // substring false positives (train in restraint, car in carbon, etc.)
    // ============================================================================
    var isStructuralLocked = false;
    var isStructuralAsset = assetClass === "bridge" || assetClass === "rail_bridge" || assetClass === "bridge_steel" || assetClass === "bridge_concrete" || assetClass === "offshore_platform";
    if (!isHyperbaricLocked && isStructuralAsset) {
      var structuralSignals = hasWord(lt_handler, "girder") || hasWordBoundary(lt_handler, "bridge") || hasWordBoundary(lt_handler, "span") || hasWordBoundary(lt_handler, "deck") || hasWord(lt_handler, "truss") || hasWord(lt_handler, "abutment") || hasWordBoundary(lt_handler, "pier") || hasWordBoundary(lt_handler, "train") || hasWordBoundary(lt_handler, "coal") || hasWord(lt_handler, "railroad") || hasWord(lt_handler, "railway") || hasWord(lt_handler, "traffic") || hasWord(lt_handler, "gusset") || hasWordBoundary(lt_handler, "brace") || hasWord(lt_handler, "stringer") || hasWord(lt_handler, "floor beam") || hasWordBoundary(lt_handler, "web") || hasWord(lt_handler, "lower chord") || hasWord(lt_handler, "upper chord") || hasWord(lt_handler, "diaphragm") || hasWord(lt_handler, "bearing pad") || hasWord(lt_handler, "jacket leg") || hasWord(lt_handler, "platform") || hasWordBoundary(lt_handler, "riser") || hasWord(lt_handler, "caisson") || hasWord(lt_handler, "boat landing") || hasWord(lt_handler, "splash zone");
      if (structuralSignals) {
        isStructuralLocked = true;
      }
    }
    // Also lock structural if transcript has overwhelming structural evidence even if
    // upstream classification was wrong (e.g. "unknown" but clearly a bridge)
    if (!isHyperbaricLocked && !isStructuralLocked && assetClass === "unknown") {
      var bridgeSignalCount = 0;
      if (hasWord(lt_handler, "girder")) bridgeSignalCount++;
      if (hasWord(lt_handler, "bridge")) bridgeSignalCount++;
      if (hasWord(lt_handler, "span")) bridgeSignalCount++;
      if (hasWord(lt_handler, "train") || hasWord(lt_handler, "railroad") || hasWord(lt_handler, "railway")) bridgeSignalCount++;
      if (hasWord(lt_handler, "gusset")) bridgeSignalCount++;
      if (hasWord(lt_handler, "truss")) bridgeSignalCount++;
      if (hasWord(lt_handler, "abutment")) bridgeSignalCount++;
      if (bridgeSignalCount >= 2) {
        assetClass = "bridge";
        assetCorrected = true;
        assetCorrectionReason = "Structural domain lock: " + bridgeSignalCount + " bridge signals detected. Overriding to bridge.";
        isStructuralLocked = true;
      }
    }
    // DEPLOY120: OFFSHORE PLATFORM DETECTION FROM UNKNOWN
    // Similar to bridge detection — count offshore signals and lock if >= 2
    // DEPLOY162 v2.5.1: short-keyword signals (riser/jacket/rov) now use hasWordBoundary
    if (!isHyperbaricLocked && !isStructuralLocked && assetClass === "unknown") {
      var offshoreSignalCount = 0;
      if (hasWord(lt_handler, "offshore")) offshoreSignalCount++;
      if (hasWord(lt_handler, "platform")) offshoreSignalCount++;
      if (hasWord(lt_handler, "deepwater")) offshoreSignalCount++;
      if (hasWord(lt_handler, "subsea")) offshoreSignalCount++;
      if (hasWordBoundary(lt_handler, "riser")) offshoreSignalCount++;
      if (hasWord(lt_handler, "caisson")) offshoreSignalCount++;
      if (hasWordBoundary(lt_handler, "jacket")) offshoreSignalCount++;
      if (hasWord(lt_handler, "splash zone")) offshoreSignalCount++;
      if (hasWordBoundary(lt_handler, "rov")) offshoreSignalCount++;
      if (hasWord(lt_handler, "boat landing")) offshoreSignalCount++;
      if (hasWord(lt_handler, "water depth")) offshoreSignalCount++;
      if (hasWord(lt_handler, "production platform")) offshoreSignalCount++;
      if (offshoreSignalCount >= 2) {
        assetClass = "offshore_platform";
        assetCorrected = true;
        assetCorrectionReason = "Offshore domain lock: " + offshoreSignalCount + " offshore signals detected. Overriding to offshore_platform.";
        isStructuralLocked = true;
      }
    }

    if (!isHyperbaricLocked && !isStructuralLocked && (hasWord(lt_handler, "hydrocracker") || hasWord(lt_handler, "hydrotreater") || hasWord(lt_handler, "reactor vessel") || hasWord(lt_handler, "delayed coker"))) {
      if (assetClass !== "pressure_vessel") {
        assetClass = "pressure_vessel";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes process reactor/hydrocracker. Overriding to pressure_vessel.";
      }
    }
    if (!isHyperbaricLocked && !isStructuralLocked && (hasWord(lt_handler, "boiler") || hasWord(lt_handler, "steam drum") || hasWord(lt_handler, "economizer"))) {
      if (assetClass !== "pressure_vessel" && assetClass !== "boiler") {
        assetClass = "pressure_vessel";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes boiler/steam equipment. Overriding to pressure_vessel.";
      }
    }
    // DEPLOY120: SEPARATOR/DRUM → PRESSURE VESSEL
    if (!isHyperbaricLocked && !isStructuralLocked && (hasWord(lt_handler, "separator") || hasWord(lt_handler, "knockout drum") || hasWord(lt_handler, "flash drum") || hasWord(lt_handler, "surge drum") || hasWord(lt_handler, "accumulator") || (hasWord(lt_handler, "vessel") && !hasWord(lt_handler, "pipe") && !hasWord(lt_handler, "piping") && !hasWord(lt_handler, "line")))) {
      if (assetClass !== "pressure_vessel") {
        assetClass = "pressure_vessel";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes separator/drum/vessel equipment. Overriding to pressure_vessel.";
      }
    }
    if (!isHyperbaricLocked && !isStructuralLocked && (hasWord(lt_handler, "pipe") || hasWord(lt_handler, "piping") || hasWord(lt_handler, "pipeline")) && assetClass !== "piping" && assetClass !== "pipeline") {
      if (assetClass === "unknown" || assetClass === "bridge_concrete" || assetClass === "bridge") {
        assetClass = "piping";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes piping. Overriding upstream classification.";
      }
    }
    // FIELD LANGUAGE PIPING OVERRIDE — v2.3
    // Field inspectors say "line" not "piping". "amine line", "steam line", "process line"
    // If transcript says "[process] line" + no vessel/tank/drum keywords → piping
    // DEPLOY115: Structural lock prevents this from firing on bridges/structures
    // DEPLOY115: "tee" check uses " tee" with leading space to prevent "steel" false positive
    if (!isHyperbaricLocked && !isStructuralLocked && assetClass !== "piping" && assetClass !== "pipeline") {
      var hasLineWord = hasWord(lt_handler, "line") || hasWord(lt_handler, "pipe") || hasWord(lt_handler, "header") || hasWord(lt_handler, "elbow") || hasWord(lt_handler, "tubing");
      var hasProcessContext = hasWord(lt_handler, "amine") || hasWord(lt_handler, "steam") || hasWord(lt_handler, "process") || hasWord(lt_handler, "sour") || hasWord(lt_handler, "flare") || hasWord(lt_handler, "condensate") || hasWord(lt_handler, "caustic") || hasWord(lt_handler, "hydrogen") || hasWord(lt_handler, "header") || hasWord(lt_handler, "elbow") || (lt_handler.indexOf(" tee ") !== -1 || lt_handler.indexOf(" tee,") !== -1 || lt_handler.indexOf(" tee.") !== -1 || lt_handler.indexOf("pipe tee") !== -1) || hasWord(lt_handler, "reducer") || hasWord(lt_handler, "dead leg") || hasWord(lt_handler, "hydro") || hasWord(lt_handler, "intrados") || hasWord(lt_handler, "downstream") || hasWord(lt_handler, "upstream") || hasWord(lt_handler, "propane") || hasWord(lt_handler, "lpg") || hasWord(lt_handler, "ngl") || hasWord(lt_handler, "butane") || hasWord(lt_handler, "ethylene") || hasWord(lt_handler, "carbon steel") || hasWord(lt_handler, "psi") || hasWord(lt_handler, "inch") || hasWord(lt_handler, "weld") || hasWord(lt_handler, "insulation") || hasWord(lt_handler, "support") || hasWord(lt_handler, "flow");
      var hasVesselEvidence = hasWord(lt_handler, "vessel") || hasWord(lt_handler, "drum") || hasWord(lt_handler, "tank") || hasWord(lt_handler, "shell side") || hasWord(lt_handler, "tube side") || hasWord(lt_handler, "head") && hasWord(lt_handler, "shell") || hasWord(lt_handler, "nozzle") && !hasWord(lt_handler, "pipe nozzle");
      if (hasLineWord && hasProcessContext && !hasVesselEvidence) {
        assetClass = "piping";
        assetCorrected = true;
        assetCorrectionReason = "Field language indicates piping (process line/pipe + no vessel evidence). Overriding upstream classification (" + (asset.asset_class || "unknown") + ") to piping.";
      }
    }
    if (!isHyperbaricLocked && !isStructuralLocked && (hasWord(lt_handler, "storage tank") || hasWord(lt_handler, "aboveground storage") || hasWord(lt_handler, "aboveground tank")) && assetClass !== "tank") {
      assetClass = "tank";
      assetCorrected = true;
      assetCorrectionReason = "Transcript describes storage tank.";
    }
    // DEPLOY115: Piping lock — if piping was established by field language evidence above,
    // reactor/exchanger mentions (which the piping connects TO) should not override.
    // "Hot hydro line coming off the reactor" = the LINE is the asset, not the reactor.
    if (!isHyperbaricLocked && !isStructuralLocked && assetClass !== "piping" && assetClass !== "pipeline" && (hasWord(lt_handler, "pressure vessel") || hasWord(lt_handler, "reactor") || hasWord(lt_handler, "heat exchanger") || hasWord(lt_handler, "autoclave")) && assetClass !== "pressure_vessel") {
      assetClass = "pressure_vessel";
      assetCorrected = true;
      assetCorrectionReason = "Transcript describes pressure equipment. Overriding to pressure_vessel.";
    }

    var physics = resolvePhysicalReality(transcript, events, numVals, confirmedFlags, assetClass);
    var damage = resolveDamageReality(physics, confirmedFlags, transcript, evidenceProvenance);
    var consequence = resolveConsequenceReality(physics, damage, assetClass, transcript, confirmedFlags);
    var authority = resolveAuthorityReality(assetClass, transcript, consequence, physics);
    var inspection = resolveInspectionReality(damage, consequence, physics, transcript, confirmedFlags);
    var computations = runPhysicsComputations(physics, numVals, assetClass, consequence);
    var contradictions = detectContradictions(physics, damage, consequence, authority, inspection, transcript, evidenceProvenance);

    // ============================================================================
    // DEPLOY117 + v2.5.2 DEPLOY167: TIERED CONFIDENCE PENALTY FOR ASSET CORRECTION
    // DEPLOY117 applied a flat 0.05 penalty + WARNING to every correction.
    // DEPLOY167 distinguishes clean recovery from genuine ambiguity by assessing
    // the strength of supporting evidence for the corrected class. Strong
    // multi-signal corrections are clean recoveries and carry NO penalty --
    // the system successfully inferred the correct class despite upstream error.
    // Legacy behavior (0.05 + WARNING) preserved for WEAK (0-1 signal) corrections.
    // ============================================================================
    var totalPenalty = contradictions.penalty;
    var correctionAssessment: any = null;
    if (assetCorrected) {
      correctionAssessment = assessAssetCorrectionStrength(lt_handler, assetClass, asset.asset_class || "unknown");
      if (correctionAssessment.strength === "STRONG") {
        contradictions.flags.push("NOTE: Asset classification corrected from " + (asset.asset_class || "unknown") + " to " + assetClass + " (clean recovery, " + correctionAssessment.signal_count + " strong supporting signals: " + correctionAssessment.signals.slice(0, 4).join(", ") + ").");
      } else if (correctionAssessment.strength === "MODERATE") {
        totalPenalty += 0.02;
        contradictions.flags.push("NOTE: Asset classification corrected from " + (asset.asset_class || "unknown") + " to " + assetClass + " (moderate supporting evidence: " + correctionAssessment.signals.join(", ") + ").");
      } else {
        totalPenalty += 0.05;
        contradictions.flags.push("WARNING: Asset classification corrected from " + (asset.asset_class || "unknown") + " to " + assetClass + ". Input ambiguity detected.");
      }
    }

    var confidence = computeRealityConfidence(
      physics.physics_confidence, damage.damage_confidence, consequence.consequence_confidence,
      authority.authority_confidence, inspection.inspection_confidence, totalPenalty);
    var decision = resolveDecisionReality(physics, damage, consequence, authority, inspection, confidence, contradictions, confirmedFlags, computations);

    // ============================================================================
    // DEPLOY117: COUNTERFACTUAL CHALLENGE
    // Before final output, ask: what would need to be true for the leading
    // mechanism to be wrong? What one measurement resolves it fastest?
    // ============================================================================
    var counterfactual: any = null;
    if (damage.primary) {
      var cfAlt = "";
      var cfTest = "";
      var cfWhatIfWrong = "";
      var pmId = damage.primary.id;

      // Find strongest competing mechanism
      if (damage.validated.length >= 2) {
        cfAlt = damage.validated[1].name + " (" + damage.validated[1].reality_state + ", score " + damage.validated[1].reality_score + ")";
      }

      if (pmId.indexOf("corrosion") !== -1 || pmId.indexOf("pitting") !== -1 || pmId === "erosion" || pmId === "cui") {
        cfWhatIfWrong = "If the thinning is actually localized crack-like morphology rather than general wall loss, the failure mode changes from plastic collapse to sudden fracture.";
        cfTest = "Targeted UT/PAUT with crack-detection setup at thinnest area + MT/PT at stress concentrations to confirm or rule out cracking.";
      } else if (pmId.indexOf("fatigue") !== -1) {
        cfWhatIfWrong = "If the indication is actually corrosion pitting or geometric artifact rather than fatigue crack, the urgency and failure mode change significantly.";
        cfTest = "Surface preparation + PT/MT for crack confirmation. UT thickness grid to check for competing wall loss. If crack confirmed, TOFD/PAUT for depth sizing.";
      } else if (pmId.indexOf("scc") !== -1 || pmId.indexOf("ssc") !== -1 || pmId.indexOf("hic") !== -1) {
        cfTest = "Crack morphology evaluation (branching pattern = SCC, stepwise = HIC, linear = fatigue). Hardness survey at weld/HAZ. Metallographic replica if accessible.";
        cfWhatIfWrong = "If the suspected environmental crack is actually mechanical fatigue or fabrication defect, the repair and monitoring strategy differs fundamentally.";
      } else {
        cfTest = "Additional characterization with complementary NDE method to confirm or rule out primary mechanism.";
        cfWhatIfWrong = "If the primary mechanism is incorrect, downstream consequence and inspection recommendations may not address the actual risk.";
      }

      counterfactual = {
        primary_mechanism: damage.primary.name,
        what_if_wrong: cfWhatIfWrong,
        strongest_alternative: cfAlt,
        fastest_resolution_test: cfTest,
        decision_critical_question: "Is the observed damage consistent with " + damage.primary.name + ", or could a competing mechanism (" + (damage.validated.length >= 2 ? damage.validated[1].name : "unknown") + ") better explain the findings?"
      };
    }

    var elapsedMs = Date.now() - startMs;

    var confNarr = "Physics=" + physics.physics_confidence + ", Damage=" + damage.damage_confidence +
      ", Consequence=" + consequence.consequence_confidence + ", Authority=" + authority.authority_confidence +
      ", Inspection=" + inspection.inspection_confidence + ". Overall=" + confidence.overall + " (" + confidence.band + ").";
    if (confidence.limiting_factors.length > 0) confNarr += " Limiting: " + confidence.limiting_factors.join("; ") + ".";

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        decision_core: {
          engine_version: "physics-first-decision-core-v2.5.3",
          elapsed_ms: elapsedMs,
          klein_bottle_states: 6,
          asset_correction: assetCorrected ? { corrected: true, original: asset.asset_class || "unknown", corrected_to: assetClass, reason: assetCorrectionReason, assessment: correctionAssessment } : { corrected: false },
          physical_reality: {
            stress: physics.stress, thermal: physics.thermal, chemical: physics.chemical,
            energy: physics.energy, time: physics.time,
            field_interaction: physics.field_interaction,
            physics_summary: physics.physics_summary,
            physics_confidence: physics.physics_confidence,
            context_inferred: physics.context_inferred || []
          },
          damage_reality: {
            validated_mechanisms: damage.validated,
            rejected_mechanisms: damage.rejected,
            primary_mechanism: damage.primary,
            mechanism_count: {
              validated: damage.validated.length,
              rejected: damage.rejected.length,
              confirmed: damage.validated.filter(function(v: any) { return v.reality_state === "confirmed"; }).length,
              probable: damage.validated.filter(function(v: any) { return v.reality_state === "probable"; }).length,
              possible: damage.validated.filter(function(v: any) { return v.reality_state === "possible"; }).length,
              unverified: damage.validated.filter(function(v: any) { return v.reality_state === "unverified"; }).length
            },
            damage_confidence: damage.damage_confidence,
            physics_narrative: damage.physics_narrative
          },
          consequence_reality: {
            consequence_tier: consequence.consequence_tier,
            failure_mode: consequence.failure_mode,
            failure_physics: consequence.failure_physics,
            consequence_basis: consequence.consequence_basis,
            human_impact: consequence.human_impact,
            environmental_impact: consequence.environmental_impact,
            operational_impact: consequence.operational_impact,
            enforcement_requirements: consequence.enforcement_requirements,
            damage_state: consequence.damage_state,
            degradation_certainty: consequence.degradation_certainty,
            is_routine_inspection: consequence.is_routine_inspection,
            damage_trajectory: consequence.damage_trajectory,
            threshold_score: consequence.threshold_score,
            threshold_reasons: consequence.threshold_reasons,
            monitoring_urgency: consequence.monitoring_urgency,
            consequence_confidence: consequence.consequence_confidence
          },
          authority_reality: {
            primary_authority: authority.primary_authority,
            secondary_authorities: authority.secondary_authorities,
            conditional_authorities: authority.conditional_authorities,
            physics_code_alignment: authority.physics_code_alignment,
            code_gaps: authority.code_gaps,
            design_state_warning: authority.design_state_warning,
            authority_confidence: authority.authority_confidence
          },
          inspection_reality: {
            proposed_methods: inspection.proposed_methods,
            recommended_package: inspection.recommended_package,
            method_assessments: inspection.method_assessments,
            all_method_scores: inspection.all_method_scores,
            best_method: inspection.best_method ? { method: inspection.best_method.method, overall_score: inspection.best_method.scores.overall, verdict: inspection.best_method.verdict, scores: inspection.best_method.scores, reasons_for: inspection.best_method.reasons_for, reasons_against: inspection.best_method.reasons_against, blind_spots: inspection.best_method.blind_spots, complementary_methods: inspection.best_method.complementary_methods } : null,
            sufficiency_verdict: inspection.sufficiency_verdict,
            physics_reason: inspection.physics_reason,
            required_methods: inspection.required_methods,
            missing_coverage: inspection.missing_coverage,
            constraint_analysis: inspection.constraint_analysis,
            inspection_confidence: inspection.inspection_confidence
          },
          evidence_provenance: evidenceProvenance ? {
            evidence: evidenceProvenance.evidence || [],
            provenance_summary: evidenceProvenance.provenance_summary || null,
            measurement_reality: evidenceProvenance.measurement_reality || null
          } : null,
          physics_computations: computations,
          reality_confidence: {
            physics_confidence: confidence.physics_confidence,
            damage_confidence: confidence.damage_confidence,
            consequence_confidence: confidence.consequence_confidence,
            authority_confidence: confidence.authority_confidence,
            inspection_confidence: confidence.inspection_confidence,
            overall: confidence.overall,
            band: confidence.band,
            certainty_state: confidence.certainty_state,
            decision_lock: confidence.decision_lock,
            escalation_required: confidence.escalation_required,
            limiting_factors: confidence.limiting_factors,
            contradiction_flags: contradictions.flags,
            counterfactual_challenge: counterfactual,
            confidence_narrative: confNarr
          },
          decision_reality: {
            disposition: decision.disposition,
            disposition_basis: decision.disposition_basis,
            gates: decision.gates,
            guided_recovery: decision.guided_recovery,
            phased_strategy: decision.phased_strategy,
            hard_locks: decision.hard_locks,
            decision_trace: decision.decision_trace
          }
        }
      })
    };
  } catch (err: any) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "decision-core failed: " + (err.message || String(err)) }) };
  }
};
export { handler };
