// DEPLOY99 — decision-core.ts v2.0
// v2.0: Production Physics Sufficiency Engine (State 5 upgraded)
//   - 8-dimension physics scoring for every NDE method
//   - Detectability, sizing, material, geometry, orientation, surface, access, execution
//   - All 7 methods scored against actual physics scenario (not just proposed ones)
//   - Blind spots, complementary methods, physics-computed verdicts
//   - Paris Law depth sizing requirements for crack mechanisms
// v1.1: Fixed cyclic loading — decompression/pressure vessels inherently cycle
// PHYSICS-FIRST DECISION CORE — Klein Bottle Architecture
// 6 States + Reality Confidence + Contradiction Detector + Physics Computations
// Single API: POST /api/decision-core
// Replaces: chain, DDL, governance, code-auth, code-trace, event-enrich, time-progression, master-router
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
interface RejectedMechanism { id: string; name: string; rejection_reason: string; missing_precondition: string; }
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
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }

// ============================================================================
// STATE 1: PHYSICAL REALITY ENGINE
// "What physical forces are acting on this material right now?"
// ============================================================================
function resolvePhysicalReality(transcript: string, events: string[], numVals: any, flags: any, assetClass: string) {
  var lt = transcript.toLowerCase();
  var fl = flags || {};
  var nv = numVals || {};
  var conf = 0.5;

  // STRESS
  var loads: string[] = [];
  var cyclic = false; var cyclicSrc: string | null = null;
  var stressConc = false; var stressConcLocs: string[] = [];
  var tensile = false; var compress = false;
  var loadPath = "unknown"; var residual = false;

  if (hasWord(lt, "pressure") || assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline") {
    tensile = true; loads.push("internal_pressure"); loads.push("biaxial_tension");
  }
  if (hasWord(lt, "cycl") || (hasWord(lt, "pressuri") && hasWord(lt, "depressuri")) || hasWord(lt, "startup") || hasWord(lt, "shutdown")) {
    cyclic = true; cyclicSrc = "pressure_or_operational_cycling";
  }
  // Domain knowledge: decompression chambers, autoclaves, and similar vessels inherently pressure-cycle
  if (hasWord(lt, "decompression") || hasWord(lt, "recompression") || hasWord(lt, "hyperbaric") || hasWord(lt, "autoclave") || hasWord(lt, "pressure test") || hasWord(lt, "hydro test") || hasWord(lt, "hydrotest")) {
    cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+inherent_pressure_cycling" : "inherent_pressure_cycling";
  }
  // Pressure vessels inherently experience pressure cycling from operation
  if ((assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline") && !cyclic) {
    cyclic = true; cyclicSrc = "operational_pressure_cycling_implied";
  }
  // Crack at weld on pressure equipment strongly implies fatigue loading history
  if ((hasWord(lt, "crack") || hasWord(lt, "indication")) && hasWord(lt, "weld") && (assetClass === "pressure_vessel" || assetClass === "piping")) {
    if (!cyclic) { cyclic = true; cyclicSrc = "crack_at_weld_implies_cyclic_history"; }
  }
  if (hasWord(lt, "vibrat")) { cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+vibration" : "vibration"; loads.push("vibration"); }
  if (hasWord(lt, "fatigue") || hasWord(lt, "cyclic load")) { cyclic = true; if (!cyclicSrc) cyclicSrc = "fatigue_indicated"; }
  if (hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "hit") || hasWord(lt, "collision")) { loads.push("impact"); compress = true; }
  if (hasWord(lt, "wind") || hasWord(lt, "wave") || hasWord(lt, "current")) { loads.push("environmental"); cyclic = true; cyclicSrc = cyclicSrc ? cyclicSrc + "+environmental" : "environmental"; }

  if (hasWord(lt, "weld toe") || hasWord(lt, "weld root")) { stressConc = true; stressConcLocs.push("weld_toe_or_root"); }
  if (hasWord(lt, "nozzle") || hasWord(lt, "branch")) { stressConc = true; stressConcLocs.push("nozzle_junction"); }
  if (hasWord(lt, "circumferential weld") || hasWord(lt, "girth weld")) { stressConc = true; stressConcLocs.push("circumferential_weld"); }
  if (hasWord(lt, "weld") && !stressConc) { stressConc = true; stressConcLocs.push("weld_general"); residual = true; }
  if (fl.dent_or_gouge_present) { stressConc = true; stressConcLocs.push("dent_or_gouge"); }
  if (hasWord(lt, "notch") || hasWord(lt, "gouge") || hasWord(lt, "thread")) { stressConc = true; stressConcLocs.push("geometric_discontinuity"); }

  if (fl.primary_member_involved || hasWord(lt, "primary") || hasWord(lt, "jacket leg") || hasWord(lt, "main girder")) loadPath = "primary";
  else if (hasWord(lt, "brace") || hasWord(lt, "secondary") || hasWord(lt, "stiffener")) loadPath = "secondary";

  if (loads.length > 0) conf += 0.12;
  if (stressConc) conf += 0.08;

  // THERMAL
  var tempC: number | null = nv.temperature_c || null;
  var tempF: number | null = nv.temperature_f || null;
  if (!tempC && tempF) tempC = Math.round((tempF - 32) * 5 / 9);
  if (!tempF && tempC) tempF = Math.round(tempC * 9 / 5 + 32);
  var thermalCyc = hasWord(lt, "thermal cycl") || (hasWord(lt, "startup") && hasWord(lt, "shutdown"));
  var fireExp = !!fl.fire_exposure || hasWord(lt, "fire");
  var fireDur = fl.fire_duration_minutes || nv.fire_duration_minutes || null;
  var creep = (tempF !== null && tempF > 700) || (tempC !== null && tempC > 370);
  var cryo = (tempF !== null && tempF < -20) || (tempC !== null && tempC < -29);
  if (fireExp) conf += 0.05;
  if (tempC !== null) conf += 0.05;

  // CHEMICAL — with EXPLICIT NEGATIVE LOCKING
  // Rule: When user explicitly denies an environment, downstream cannot override
  var corrosive = false; var agents: string[] = [];
  // Detect explicit negatives FIRST
  var negMarine = hasWord(lt, "no marine") || hasWord(lt, "not marine") || hasWord(lt, "marine: no") || hasWord(lt, "marine environment: no") || hasWord(lt, "marine environment. no") || hasWord(lt, "non-marine") || hasWord(lt, "non marine");
  var negH2s = hasWord(lt, "no h2s") || hasWord(lt, "not sour") || hasWord(lt, "no sour") || hasWord(lt, "h2s: no");
  var negChloride = hasWord(lt, "no chloride") || hasWord(lt, "no chlor") || hasWord(lt, "chloride: no");
  var negCorrosion = hasWord(lt, "no corros") || hasWord(lt, "corrosion: no") || hasWord(lt, "not corroded");

  var h2s = !negH2s && (hasWord(lt, "h2s") || hasWord(lt, "hydrogen sulfide") || hasWord(lt, "sour"));
  var co2 = hasWord(lt, "co2") || hasWord(lt, "sweet corros");
  // CRITICAL: "marine" only triggers chlorides if NOT explicitly denied
  // "diving" or "commercial diving" is an INDUSTRY, not an environment
  var chlorides = !negMarine && !negChloride && (hasWord(lt, "chloride") || hasWord(lt, "seawater") || hasWord(lt, "splash zone"));
  // "marine" keyword only counts if not negated
  if (!negMarine && hasWord(lt, "marine") && !hasWord(lt, "marine environment. no") && !hasWord(lt, "marine environment: no") && !hasWord(lt, "no. marine") && !hasWord(lt, "no marine")) {
    // Check if "marine" appears as a positive assertion, not a denial
    // Look for patterns like "marine environment" without preceding "no" or "not"
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
  if (hasWord(lt, "soil") || hasWord(lt, "buried")) { corrosive = true; agents.push("soil"); }
  var suscept: string[] = [];
  if (h2s && tensile) suscept.push("SSC");
  if (h2s) suscept.push("HIC");
  if (chlorides && (hasWord(lt, "stainless") || hasWord(lt, "austenitic"))) suscept.push("chloride_SCC");
  if (caustic && tensile) suscept.push("caustic_SCC");
  var coatingOk: boolean | null = null;
  if (hasWord(lt, "coating fail") || hasWord(lt, "coating breakdown") || hasWord(lt, "coating damage")) coatingOk = false;
  else if (hasWord(lt, "coating intact") || hasWord(lt, "coating good")) coatingOk = true;
  if (corrosive) conf += 0.05;

  // ENERGY
  var presCyc = cyclic && (hasWord(lt, "pressure") || assetClass === "pressure_vessel" || assetClass === "piping");
  var vib = hasWord(lt, "vibrat");
  var impactEv = hasWord(lt, "impact") || hasWord(lt, "struck") || hasWord(lt, "collision") || hasWord(lt, "dropped object");
  var flowEro = hasWord(lt, "erosion") || hasWord(lt, "high velocity");
  var cav = hasWord(lt, "cavitat");
  var storedE = assetClass === "pressure_vessel" || assetClass === "piping" || assetClass === "pipeline" || hasWord(lt, "pressur");

  // TIME
  var svcYears: number | null = nv.service_years || null;
  var cyclesEst: string | null = cyclic ? (nv.cycle_count ? String(nv.cycle_count) : "cyclic_but_unknown_count") : null;
  var timeSinceInsp: number | null = nv.years_since_inspection || null;
  if (svcYears) conf += 0.05;
  if (conf > 1) conf = 1;

  // Summary
  var parts: string[] = [];
  if (loads.length) parts.push("Loading: " + loads.join(", "));
  if (cyclic) parts.push("Cyclic: " + (cyclicSrc || "yes"));
  if (stressConc) parts.push("Stress concentrations: " + stressConcLocs.join(", "));
  if (fireExp) parts.push("Fire exposure" + (fireDur ? " (" + fireDur + "min)" : ""));
  if (corrosive) parts.push("Corrosive (" + agents.join(", ") + ")");
  if (suscept.length) parts.push("Susceptible: " + suscept.join(", "));
  if (storedE) parts.push("Stored pressure energy");
  var summary = parts.length ? parts.join(". ") + "." : "Limited physical context from transcript.";

  // FIELD INTERACTION — where do forces converge and amplify?
  var hotspots: string[] = [];
  var interactionScore = 0;
  var interactionWarnings: string[] = [];

  // Corrosion + Cyclic Stress = corrosion-fatigue (much worse than either alone)
  if (corrosive && cyclic) {
    interactionScore += 25;
    hotspots.push("Corrosion + cyclic stress at same location");
    interactionWarnings.push("Corrosion creates surface pits that become stress risers, accelerating fatigue crack initiation. Combined damage rate is faster than either mechanism alone.");
  }
  // Stress concentration + Cyclic = classic fatigue hotspot
  if (stressConc && cyclic) {
    interactionScore += 20;
    for (var hi = 0; hi < stressConcLocs.length; hi++) hotspots.push("Cyclic loading at " + stressConcLocs[hi]);
    interactionWarnings.push("Cyclic stress concentrates at geometric discontinuities (" + stressConcLocs.join(", ") + "). These are the most likely crack initiation sites.");
  }
  // Corrosion + Stress Concentration = accelerated local attack
  if (corrosive && stressConc) {
    interactionScore += 15;
    hotspots.push("Corrosion attack at stress concentration");
    interactionWarnings.push("Corrosion preferentially attacks areas of high stress and geometric change. Weld toes, crevices, and transitions are most vulnerable.");
  }
  // Fire + Pressure = property degradation under load
  if (fireExp && storedE) {
    interactionScore += 20;
    hotspots.push("Fire-exposed pressure boundary");
    interactionWarnings.push("Fire may degrade material properties while pressure maintains load. Reduced strength under sustained stress creates failure risk.");
  }
  // H2S + Tensile = sulfide stress cracking hotspot
  if (h2s && tensile) {
    interactionScore += 25;
    hotspots.push("Sour environment under tensile stress");
    interactionWarnings.push("H2S charges hydrogen into material under tensile stress. This can cause sudden cracking with little warning. High-priority inspection zone.");
  }
  // Impact + Pressure = dent under pressure
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
    physics_confidence: roundN(conf, 2)
  };
}

// ============================================================================
// STATE 2: DAMAGE REALITY ENGINE
// Mechanisms derived FROM physics. Only valid if ALL preconditions exist.
// "Physically impossible" = permanent rejection.
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

function resolveDamageReality(physics: any, flags: any, transcript: string) {
  var fl = flags || {};
  var lt = transcript.toLowerCase();
  var validated: ValidatedMechanism[] = [];
  var rejected: RejectedMechanism[] = [];
  var s = physics.stress; var t = physics.thermal; var c = physics.chemical; var e = physics.energy;

  for (var i = 0; i < MECH_DEFS.length; i++) {
    var md = MECH_DEFS[i];
    if (!md.pre(s, t, c, e, fl)) {
      rejected.push({ id: md.id, name: md.name,
        rejection_reason: "PHYSICALLY IMPOSSIBLE: Missing required precondition(s): " + md.preLabels.join("; "),
        missing_precondition: md.preLabels.join("; ") });
      continue;
    }
    var evFor: string[] = []; var evAg: string[] = []; var obs = false; var score = 0.4;
    for (var ei = 0; ei < md.eKeys.length; ei++) {
      if (fl[md.eKeys[ei]]) { evFor.push(md.eKeys[ei].replace(/_/g, " ")); score += 0.2; obs = true; }
    }
    // Transcript keyword boost
    var words = md.name.toLowerCase().split(/[\s\/()]+/);
    for (var wi = 0; wi < words.length; wi++) { if (words[wi].length > 3 && hasWord(lt, words[wi])) { score += 0.05; break; } }
    if (score > 1) score = 1;
    var state = score >= 0.75 ? "confirmed" : score >= 0.55 ? "probable" : score >= 0.35 ? "possible" : "unverified";
    validated.push({ id: md.id, name: md.name, physics_basis: md.preLabels.join(" + "),
      preconditions_met: md.preLabels, reality_state: state, reality_score: roundN(score, 2),
      evidence_for: evFor, evidence_against: evAg, observation_basis: obs, severity: md.sev });
  }
  validated.sort(function(a, b) { return b.reality_score - a.reality_score; });
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
// "What does physics predict happens if this damage progresses?"
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

  // CRITICAL: human death
  var critKw = ["decompression chamber", "hyperbaric", "dive system", "diving bell", "life support", "human occupancy", "manned", "personnel basket", "escape capsule", "breathing air"];
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
  if (assetClass === "bridge") {
    if (tier === "MEDIUM" || tier === "LOW") tier = "HIGH";
    basis.push("PHYSICS: Public infrastructure — civilian exposure");
    humanImpact = "Public fatality risk";
  }
  if (basis.length === 0) basis.push("Standard asset — default MEDIUM");

  // ROUTINE INSPECTION CONSERVATISM
  // Separate ASSET CRITICALITY from CURRENT DEGRADATION EVIDENCE
  var isRoutine = hasWord(lt, "routine") || hasWord(lt, "general condition") || hasWord(lt, "condition assessment") || hasWord(lt, "general inspection") || hasWord(lt, "periodic");
  var hasNoHistory = hasWord(lt, "no history") || hasWord(lt, "no damage") || hasWord(lt, "no previous") || hasWord(lt, "first inspection");
  var hasDamageEvidence = !!fl.crack_confirmed || !!fl.critical_wall_loss_confirmed || !!fl.leak_confirmed || !!fl.through_wall_leak_confirmed || !!fl.fire_property_degradation_confirmed || !!fl.support_collapse_confirmed;
  var hasAnyVisibleDamage = !!fl.visible_cracking || !!fl.visible_deformation || !!fl.dent_or_gouge_present || !!fl.leak_suspected;

  // degradation_certainty: how certain are we that active damage exists right now?
  var degradationCertainty = "UNVERIFIED";
  if (hasDamageEvidence) { degradationCertainty = "CONFIRMED"; }
  else if (hasAnyVisibleDamage) { degradationCertainty = "SUSPECTED"; }
  else if (damage.primary && damage.primary.observation_basis) { degradationCertainty = "SUSPECTED"; }
  else if (damage.primary && damage.primary.reality_score >= 0.6) { degradationCertainty = "PROBABLE"; }
  else { degradationCertainty = "UNVERIFIED"; }

  // For routine inspections with no confirmed damage, do NOT inflate to max alarm
  if (isRoutine && degradationCertainty === "UNVERIFIED" && !hasDamageEvidence) {
    // Asset criticality stays (tier stays CRITICAL/HIGH for human occupancy etc.)
    // But failure mode should reflect inspection state, not active degradation
    if (failMode === "equipment_degradation" || failMode === "pressure_boundary_failure") {
      failMode = "inspection_required";
    }
    if (humanImpact.indexOf("FATAL") !== -1) {
      humanImpact = "FATAL potential (life-safety asset) — current degradation NOT confirmed";
    }
    opImpact = "Routine inspection — no immediate operational impact established";
  }

  // Failure physics from primary mechanism
  if (damage.primary) {
    var pm = damage.primary.id;
    if (pm.indexOf("fatigue") !== -1) {
      failPhysics = "Fatigue crack propagation per Paris Law. Cyclic stress drives incremental growth at stress concentrations. Critical crack size determined by fracture toughness vs applied stress. Failure mode: leak-before-break (ductile) or catastrophic burst (insufficient toughness).";
    } else if (pm.indexOf("corrosion") !== -1 || pm.indexOf("pitting") !== -1 || pm === "co2_corrosion" || pm === "cui" || pm === "erosion") {
      failPhysics = "Progressive wall thinning reduces load-bearing section. When remaining wall falls below minimum for hoop stress, failure occurs as plastic collapse or pinhole leak.";
    } else if (pm.indexOf("scc") !== -1 || pm.indexOf("ssc") !== -1) {
      failPhysics = "Environmentally-assisted crack propagation under sustained tensile stress. Growth rate depends on stress intensity, environment, and material susceptibility. Failure can be sudden.";
    } else if (pm === "overload_buckling") {
      failPhysics = "Compressive overload exceeds stability limit or impact exceeds deformation capacity. Failure: buckling, permanent deformation, or fracture.";
    } else if (pm === "fire_damage") {
      failPhysics = "Elevated temperature degrades yield, tensile, and toughness. Post-fire properties may not recover. Phase changes possible above critical temps.";
    }
  }
  if (!failPhysics) failPhysics = "Damage progression reduces integrity below safe operating threshold.";

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

  // DAMAGE STATE / THRESHOLD — where is this asset on the damage curve?
  var thresholdScore = 15;
  var thresholdReasons: string[] = [];
  // Field interaction amplifies threshold risk
  if (physics.field_interaction && physics.field_interaction.interaction_score > 50) {
    thresholdScore += 18;
    thresholdReasons.push("Multiple damage forces are interacting and amplifying each other at this location.");
  }
  // Confirmed damage with active mechanism
  if (damage.primary && damage.primary.observation_basis) {
    thresholdScore += 15;
    thresholdReasons.push("Damage mechanism (" + damage.primary.name + ") is evidenced by direct observation — this is not theoretical.");
  }
  // Crack-type mechanisms have threshold behavior (stable until critical, then sudden)
  if (damage.primary && (damage.primary.id.indexOf("fatigue") !== -1 || damage.primary.id.indexOf("scc") !== -1 || damage.primary.id.indexOf("ssc") !== -1)) {
    thresholdScore += 12;
    thresholdReasons.push("Active mechanism (" + damage.primary.name + ") has threshold behavior — stable until critical size, then rapid failure.");
  }
  // High consequence amplifies threshold urgency
  if (tier === "CRITICAL") { thresholdScore += 15; thresholdReasons.push("CRITICAL consequence means threshold crossing has catastrophic impact."); }
  else if (tier === "HIGH") { thresholdScore += 8; }
  // Time factors
  if (physics.time.service_years && physics.time.service_years > 15) { thresholdScore += 8; thresholdReasons.push("Extended service life (" + physics.time.service_years + " years) increases accumulated damage."); }
  if (physics.time.time_since_inspection_years && physics.time.time_since_inspection_years > 3) { thresholdScore += 5; thresholdReasons.push("Gap since last inspection (" + physics.time.time_since_inspection_years + " years) means current state is less certain."); }
  if (thresholdScore > 100) thresholdScore = 100;

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
// PHYSICS COMPUTATIONS (integrated — runs when numeric inputs available)
// Paris Law, Critical Flaw, Wall Loss, Leak-vs-Burst
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

  // Hoop stress
  var hoopMpa: number | null = null;
  if (pressMpa && radiusMm && wallT && wallT > 0) hoopMpa = pressMpa * (radiusMm / wallT);

  // Default material props (carbon steel conservative)
  var parisC = nv.paris_c || 3e-13;
  var parisM = nv.paris_m || 3.1;
  var kic = nv.fracture_toughness || 120; // MPa sqrt(m)
  var yieldMpa = nv.yield_strength_mpa || 250;
  var Y = nv.crack_shape_factor || 1.12;

  // FATIGUE (Paris Law)
  var fatigue: FatigueResult = { enabled: false, delta_k: null, growth_per_cycle_m: null, days_to_critical: null, status: "insufficient_input", narrative: "Fatigue computation requires flaw depth and stress data." };
  if (flawD && hoopMpa) {
    var aM = flawD / 1000;
    var deltaSigma = hoopMpa * 0.8; // approximate alternating
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
      // Critical depth from fracture
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

  // CRITICAL FLAW
  var critFlaw: CriticalFlawResult = { enabled: false, critical_depth_mm: null, stress_ratio: null, status: "insufficient_input", narrative: "Critical flaw computation requires stress and toughness data." };
  if (hoopMpa && kic && wallT) {
    var acM = Math.pow(kic / (Y * hoopMpa), 2) / Math.PI;
    var acMm = Math.min(acM * 1000, wallT * 0.8);
    var stressRatio = flawD ? roundN(flawD / acMm, 3) : null;
    critFlaw = { enabled: true, critical_depth_mm: roundN(acMm, 2), stress_ratio: stressRatio,
      status: "bounded", narrative: "Critical flaw depth estimated at " + roundN(acMm, 2) + "mm." + (stressRatio !== null ? " Current flaw is at " + roundN(stressRatio * 100, 1) + "% of critical." : "") };
  }

  // WALL LOSS
  var wallLoss: WallLossResult = { enabled: false, remaining_life_years: null, severity_ratio: null, status: "insufficient_input", narrative: "Wall loss computation requires thickness, minimum, and corrosion rate." };
  if (currentT && tMin && corrRate && corrRate > 0) {
    var yearsToTmin = (currentT - tMin) / corrRate;
    var sevRatio = 1 - ((currentT - tMin) / Math.max(currentT, 0.001));
    wallLoss = { enabled: true, remaining_life_years: roundN(yearsToTmin, 2), severity_ratio: roundN(sevRatio, 3),
      status: yearsToTmin <= 0 ? "critical" : "active",
      narrative: yearsToTmin <= 0 ? "Current thickness at or below minimum. Immediate action required." : "Estimated " + roundN(yearsToTmin, 2) + " years remaining to minimum thickness." };
  }

  // LEAK VS BURST
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
// Codes validate physics — physics does not validate codes.
// ============================================================================
var AUTHORITY_MAP = [
  { kw: ["decompression chamber", "hyperbaric", "dive system", "diving bell", "human occupancy", "pvho"],
    ac: ["pressure_vessel"], pri: "ASME PVHO-1", sec: ["ASME Section VIII", "API 510", "ASME Section V"],
    cond: [{ code: "ADCI Standards", cond: "diving ops" }, { code: "IMCA D 024", cond: "international diving" }],
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
  { kw: ["bridge", "overpass", "girder", "pier", "abutment"],
    ac: ["bridge"], pri: "AASHTO MBE + AWS D1.5", sec: ["AASHTO LRFD", "FHWA NBIS"], cond: [], dw: null },
  { kw: ["offshore", "platform", "jacket", "subsea", "fpso", "topside"],
    ac: ["offshore_platform"], pri: "API RP 2A", sec: ["API 579-1", "NACE SP0176"],
    cond: [{ code: "DNV-OS-C101", cond: "classification" }, { code: "BSEE", cond: "US federal waters" }], dw: null },
  { kw: ["rail", "railcar", "track", "thermite weld"],
    ac: ["rail"], pri: "AREMA Manual", sec: ["AAR Field Manual", "49 CFR 213"], cond: [], dw: null }
];

function resolveAuthorityReality(assetClass: string, transcript: string, consequence: any, physics: any) {
  var lt = transcript.toLowerCase();
  var matched: any = null;
  for (var ri = 0; ri < AUTHORITY_MAP.length; ri++) {
    var r = AUTHORITY_MAP[ri];
    for (var ki = 0; ki < r.kw.length; ki++) { if (hasWord(lt, r.kw[ki])) { matched = r; break; } }
    if (matched) break;
  }
  if (!matched) {
    for (var ai = 0; ai < AUTHORITY_MAP.length; ai++) {
      for (var asi = 0; asi < AUTHORITY_MAP[ai].ac.length; asi++) {
        if (assetClass === AUTHORITY_MAP[ai].ac[asi]) { matched = AUTHORITY_MAP[ai]; break; }
      }
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
  if (consequence.consequence_tier === "CRITICAL" && matched.pri.indexOf("PVHO") !== -1) {
    alignment = "CONSISTENT — PVHO-1 requires multi-method NDE for pressure boundary welds, aligning with physics requirement for CRITICAL consequence";
  }
  // Check FFS need
  if ((physics.stress.cyclic_loading || physics.chemical.corrosive_environment) && consequence.consequence_tier !== "LOW") {
    var hasFFS = false;
    for (var si = 0; si < matched.sec.length; si++) { if (matched.sec[si].indexOf("579") !== -1) hasFFS = true; }
    if (!hasFFS) gaps.push("Fitness-for-service (API 579) recommended but not in chain");
  }
  var conf = 0.85 - gaps.length * 0.1;
  if (conf < 0.3) conf = 0.3;
  return { primary_authority: matched.pri, secondary_authorities: matched.sec,
    conditional_authorities: matched.cond, physics_code_alignment: alignment,
    code_gaps: gaps, design_state_warning: matched.dw, authority_confidence: roundN(conf, 2) };
}

// ============================================================================
// STATE 5: PHYSICS SUFFICIENCY ENGINE (Production)
// Every method is a physics experiment. Scores across 8 dimensions.
// Physics decides what works — not tradition, not checklists.
// ============================================================================

// Method physics baselines — intrinsic sensing capabilities per method
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

  // 1. DETECTABILITY — can this method's physics detect the expected damage?
  var detectScore = 50;
  var isCrackType = pmId.indexOf("fatigue") !== -1 || pmId.indexOf("crack") !== -1 || pmId.indexOf("scc") !== -1 || pmId.indexOf("ssc") !== -1 || pmId.indexOf("hic") !== -1;
  var isCorrosionType = pmId.indexOf("corrosion") !== -1 || pmId.indexOf("pitting") !== -1 || pmId.indexOf("erosion") !== -1 || pmId.indexOf("cui") !== -1 || pmId.indexOf("wall_loss") !== -1;
  var isDeformation = pmId.indexOf("overload") !== -1 || pmId.indexOf("buckl") !== -1;
  var isFire = pmId.indexOf("fire") !== -1;

  if (isCrackType) {
    // Cracks are planar — need methods that detect planar reflectors
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

  // 2. SIZING — can this method provide engineering-grade measurements?
  var sizingScore = bl.sizing;
  if (isCrackType && method === "TOFD") { sizingScore += 8; reasonsFor.push("TOFD excels at crack depth sizing via diffraction timing"); }
  if (isCrackType && method === "PAUT") { sizingScore += 6; reasonsFor.push("PAUT provides crack sizing via beam steering"); }
  if (isCrackType && (method === "MT" || method === "PT")) { sizingScore -= 15; reasonsAgainst.push("Surface methods provide crack length only — depth requires volumetric"); }
  if (isCorrosionType && (method === "UT" || method === "PAUT")) { sizingScore += 10; reasonsFor.push("UT/PAUT measures remaining wall thickness directly"); }

  // 3. MATERIAL COMPATIBILITY — does the material support this method's physics?
  var matScore = 75;
  if (method === "MT" && !hasWord(lt, "carbon steel") && !hasWord(lt, "ferritic") && !hasWord(lt, "low alloy")) {
    // Check if material might be non-ferromagnetic
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

  // 4. GEOMETRY COMPATIBILITY
  var geoScore = 75;
  if (method === "TOFD" && hasWord(lt, "fillet")) { geoScore -= 30; reasonsAgainst.push("TOFD geometry problematic for fillet welds"); }
  if ((method === "UT" || method === "PAUT") && hasWord(lt, "butt") || hasWord(lt, "circumferential")) { geoScore += 8; reasonsFor.push("Butt/circumferential weld geometry suits ultrasonic scanning"); }
  if (method === "TOFD" && hasWord(lt, "nozzle")) { geoScore -= 20; reasonsAgainst.push("Nozzle geometry restricts TOFD probe arrangement"); }
  if ((method === "MT" || method === "PT") && hasWord(lt, "complex")) { geoScore -= 8; }

  // 5. ORIENTATION SENSITIVITY — can the method detect flaws in the expected orientation?
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

  // 6. SURFACE COMPATIBILITY
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

  // 7. ACCESS COMPATIBILITY
  var accessScore = 75;
  if (method === "TOFD") { accessScore -= 20; reasonsAgainst.push("TOFD requires dual-side or wrap-around access for probe pair"); }
  if (method === "RT") { accessScore -= 25; reasonsAgainst.push("RT requires backside access for film/detector placement"); }
  if (method === "PAUT") { accessScore += 5; reasonsFor.push("PAUT beam steering compensates for limited access"); }
  if (method === "MT" || method === "PT" || method === "ET") { accessScore += 10; reasonsFor.push("Single-side surface access sufficient"); }

  // 8. EXECUTION ROBUSTNESS
  var execScore = 76;
  if ((method === "UT" || method === "PAUT" || method === "TOFD") && fl.underwater_access_limited) {
    execScore -= 10; reasonsAgainst.push("Underwater execution requires specialized procedure and signal validation");
  }
  if (method === "PAUT") { execScore -= 5; reasonsAgainst.push("PAUT requires qualified setup — poor focal law strategy creates false confidence"); }

  // OVERALL COMPOSITE SCORE
  var overall = (detectScore * 0.25 + sizingScore * 0.15 + matScore * 0.15 + geoScore * 0.10 + orientScore * 0.10 + surfScore * 0.10 + accessScore * 0.05 + execScore * 0.10);
  if (matScore === 0) overall = 0; // Hard physics gate — material incompatible
  if (surfScore === 0 && (method === "PT")) overall = 0; // Hard physics gate — surface blocks method
  overall = clamp(overall, 0, 100);

  // Complementary methods
  if ((method === "MT" || method === "PT") && isCrackType) { complementary.push("UT"); complementary.push("PAUT"); }
  if (method === "UT" && isCrackType) { complementary.push("TOFD"); complementary.push("MT"); }
  if (method === "PAUT" && isCrackType) { complementary.push("TOFD"); }
  if ((method === "MT" || method === "PT") && isCorrosionType) { complementary.push("UT"); }

  // Method-specific blind spots
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
  // Extract proposed methods from transcript
  var proposed: string[] = [];
  var nameMap: any = { "visual": "VT", "magnetic particle": "MT", "penetrant": "PT", "ultrasonic": "UT", "radiograph": "RT", "phased array": "PAUT", "eddy current": "ET", "x-ray": "RT", "tofd": "TOFD" };
  var keys = Object.keys(nameMap);
  for (var ki = 0; ki < keys.length; ki++) { if (hasWord(lt, keys[ki]) && proposed.indexOf(nameMap[keys[ki]]) === -1) proposed.push(nameMap[keys[ki]]); }
  for (var ai2 = 0; ai2 < ALL_METHODS.length; ai2++) { if (transcript.indexOf(ALL_METHODS[ai2]) !== -1 && proposed.indexOf(ALL_METHODS[ai2]) === -1) proposed.push(ALL_METHODS[ai2]); }

  // Score ALL methods against physics — not just proposed ones
  var allScores: any[] = [];
  for (var mi = 0; mi < ALL_METHODS.length; mi++) {
    var score = scoreMethodPhysics(ALL_METHODS[mi], damage, physics, consequence, transcript, flags);
    if (score) allScores.push(score);
  }
  allScores.sort(function(a: any, b: any) { return b.scores.overall - a.scores.overall; });

  // Build assessments for proposed methods with full physics scoring
  var assessments: MethodWeight[] = [];
  for (var pi = 0; pi < proposed.length; pi++) {
    var ms: any = null;
    for (var si = 0; si < allScores.length; si++) { if (allScores[si].method === proposed[pi]) { ms = allScores[si]; break; } }
    if (!ms) continue;
    assessments.push({ method: ms.method, physics_principle: ms.physics_principle, detects: ms.detects,
      cannot_detect: ms.cannot_detect, reliability: roundN(ms.scores.overall / 100, 2),
      coverage: roundN(ms.scores.detectability / 100, 2), limitations: ms.reasons_against });
  }

  // Physics-computed requirements
  var required: Array<{ method: string; physics_basis: string }> = [];
  var missing: string[] = [];

  // Check what physics NEEDS based on damage + consequence
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

  // Physics gap: crack damage without volumetric coverage
  if (damage.primary && damage.primary.id.indexOf("fatigue") !== -1 && !hasVol && consequence.consequence_tier !== "LOW") {
    if (missing.indexOf("Volumetric NDE — physics: surface methods cannot detect subsurface crack propagation (acoustic/electromagnetic depth limitation)") === -1) {
      missing.push("Crack depth sizing — physics: fatigue crack growth rate (Paris Law) requires measured depth. Surface methods give length only.");
    }
  }

  // Physics gap: proposed method scored poorly
  if (bestProposed && bestProposed.scores.overall < 50 && consequence.consequence_tier !== "LOW") {
    missing.push("Proposed method (" + bestProposed.method + ") scored " + bestProposed.scores.overall + "/100 — physics sufficiency is weak for this scenario. Best method: " + (bestMethod ? bestMethod.method + " (" + bestMethod.scores.overall + "/100)" : "unknown"));
  }

  var verdict = "SUFFICIENT";
  if (missing.length > 0 && consequence.consequence_tier === "CRITICAL") verdict = "BLOCKED";
  else if (missing.length > 0) verdict = "INSUFFICIENT";

  // FIX: Generate recommended method package when no methods proposed but best method is viable
  var recommendedPackage: string[] = [];
  if (proposed.length === 0 && bestMethod && bestMethod.scores.overall >= 50) {
    // Build recommended inspection path from physics scoring
    recommendedPackage.push("VT"); // Always start with visual
    // Add surface method for ferromagnetic steel
    if (!hasWord(lt, "stainless") && !hasWord(lt, "austenitic") && !hasWord(lt, "aluminum") && !hasWord(lt, "titanium")) {
      recommendedPackage.push("MT");
    } else {
      recommendedPackage.push("PT");
    }
    // Add volumetric if CRITICAL/HIGH or if damage mechanism requires it
    if (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH" || (damage.primary && damage.primary.id.indexOf("fatigue") !== -1)) {
      if (bestMethod.method === "PAUT" || bestMethod.method === "UT") recommendedPackage.push(bestMethod.method);
      else recommendedPackage.push("UT");
    }
    // Add best method if not already included
    if (recommendedPackage.indexOf(bestMethod.method) === -1 && bestMethod.scores.overall >= 65) {
      recommendedPackage.push(bestMethod.method);
    }
  }

  // CONSTRAINT TRUTH DISTORTION — do execution conditions allow reliable results?
  var constraintScore = 0;
  var constraintWarnings: string[] = [];
  var truthQuality = "HIGH";
  if (hasWord(lt, "coated") || hasWord(lt, "coating") || hasWord(lt, "painted")) {
    constraintScore += 15;
    constraintWarnings.push("Coating/paint may reduce sensitivity or block surface methods entirely. Results may understate actual condition.");
  }
  if (hasWord(lt, "rough") || hasWord(lt, "corroded surface") || hasWord(lt, "scale") || hasWord(lt, "rust")) {
    constraintScore += 12;
    constraintWarnings.push("Rough or corroded surface degrades coupling quality and indication clarity. Findings may be less reliable.");
  }
  if (hasWord(lt, "underwater") || hasWord(lt, "subsea") || (flags && flags.underwater_access_limited)) {
    constraintScore += 18;
    constraintWarnings.push("Underwater execution increases complexity. Signal quality and scan stability may be reduced.");
  }
  if (hasWord(lt, "rope access") || hasWord(lt, "scaffolding") || hasWord(lt, "confined")) {
    constraintScore += 14;
    constraintWarnings.push("Limited access affects scan stability and coverage completeness. Inspector may not reach all areas.");
  }
  if (hasWord(lt, "online") || hasWord(lt, "in service") || hasWord(lt, "running")) {
    constraintScore += 10;
    constraintWarnings.push("Equipment in service during inspection. Vibration, temperature, or flow may affect results.");
  }
  if (hasWord(lt, "limited access") || hasWord(lt, "partial access") || hasWord(lt, "restricted")) {
    constraintScore += 16;
    constraintWarnings.push("Access restriction means some areas cannot be inspected. Uninspected zones remain unknown — not clean.");
  }
  if (hasWord(lt, "hot") || hasWord(lt, "elevated temperature") || (physics.thermal.operating_temp_f && physics.thermal.operating_temp_f > 200)) {
    constraintScore += 12;
    constraintWarnings.push("Elevated temperature may require special procedures and correction factors. Standard calibration may not apply.");
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

  // Constraint distortion adjusts confidence
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

  var inspConf = 0.8;
  if (missing.length > 0) inspConf -= missing.length * 0.12;
  if (verdict === "BLOCKED") inspConf = Math.min(inspConf, 0.35);
  if (proposed.length === 0 && recommendedPackage.length > 0) inspConf = 0.35; // Has recommendation, just not proposed yet
  else if (proposed.length === 0) inspConf = 0.2;
  if (bestProposed && bestProposed.scores.overall < 50) inspConf -= 0.15;
  inspConf = clamp(inspConf, 0.1, 1.0);

  return { proposed_methods: proposed, recommended_package: recommendedPackage, method_assessments: assessments,
    all_method_scores: allScores, best_method: bestMethod,
    sufficiency_verdict: verdict, physics_reason: physReason,
    required_methods: required, missing_coverage: missing,
    constraint_analysis: { constraint_score: constraintScore, truth_quality: truthQuality, warnings: constraintWarnings },
    inspection_confidence: roundN(inspConf, 2) };
}

// ============================================================================
// REALITY CONFIDENCE ENGINE (Cross-cutting)
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
function detectContradictions(physics: any, damage: any, consequence: any, authority: any, inspection: any) {
  var flags: string[] = []; var penalty = 0;
  for (var vi = 0; vi < damage.validated.length; vi++) {
    var m = damage.validated[vi];
    if (m.id.indexOf("fatigue") !== -1 && !physics.stress.cyclic_loading) { flags.push("CONTRADICTION: Fatigue validated but no cyclic loading"); penalty += 0.15; }
    if (m.id.indexOf("corrosion") !== -1 && !physics.chemical.corrosive_environment) { flags.push("CONTRADICTION: Corrosion validated but no corrosive environment"); penalty += 0.12; }
    if (m.id.indexOf("creep") !== -1 && !physics.thermal.creep_range) { flags.push("CONTRADICTION: Creep validated but not in creep range"); penalty += 0.15; }
  }
  if (consequence.consequence_tier === "CRITICAL" && inspection.sufficiency_verdict !== "BLOCKED" && inspection.proposed_methods.length < 2) {
    flags.push("WARNING: CRITICAL consequence with <2 methods"); penalty += 0.05;
  }
  if (authority.code_gaps.length > 0 && (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH")) {
    flags.push("WARNING: Code gaps on " + consequence.consequence_tier + " asset"); penalty += 0.08;
  }
  if (penalty > 0.4) penalty = 0.4;
  return { flags: flags, penalty: roundN(penalty, 2) };
}

// ============================================================================
// STATE 6: DECISION REALITY ENGINE
// Physics-grounded, code-validated, consequence-aware decision.
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

  // Gate 1: Physics Reality
  gates.push({ gate: "physics_reality", result: "PASS", reason: "Physics characterized (" + physics.physics_confidence + " confidence)", required_action: null });

  // Gate 2: Life Safety
  if (consequence.consequence_tier === "CRITICAL" && (confidence.decision_lock || inspection.sufficiency_verdict === "BLOCKED")) {
    gates.push({ gate: "life_safety", result: "BLOCKED", reason: "CRITICAL life-safety asset with insufficient evidence/methods", required_action: "Complete ALL critical-tier requirements" });
    blocked = true; blockGate = "life_safety";
    trace.push("GATE BLOCKED: Life safety — " + consequence.human_impact);
  } else {
    gates.push({ gate: "life_safety", result: consequence.consequence_tier === "CRITICAL" ? "WARNING" : "PASS",
      reason: consequence.consequence_tier === "CRITICAL" ? "CRITICAL asset — elevated scrutiny" : "Not CRITICAL life-safety", required_action: null });
  }

  // Gate 3: Consequence Severity
  var hasUnverified = false;
  for (var uvi = 0; uvi < damage.validated.length; uvi++) { if (damage.validated[uvi].reality_state === "unverified" || damage.validated[uvi].reality_state === "possible") hasUnverified = true; }
  if (hasUnverified && (consequence.consequence_tier === "CRITICAL" || consequence.consequence_tier === "HIGH")) {
    gates.push({ gate: "consequence_severity", result: "ESCALATED", reason: "Unverified mechanisms on " + consequence.consequence_tier + " asset", required_action: "Verify all mechanism claims" });
    escalated = true;
  } else {
    gates.push({ gate: "consequence_severity", result: "PASS", reason: "Severity consistent with evidence", required_action: null });
  }

  // Gate 4: Evidence Sufficiency
  if (confidence.decision_lock) {
    gates.push({ gate: "evidence_sufficiency", result: "BLOCKED", reason: "Confidence below threshold: " + confidence.limiting_factors.join("; "),
      required_action: "Collect evidence for " + consequence.consequence_tier + " tier" });
    if (!blocked) { blocked = true; blockGate = "evidence_sufficiency"; }
  } else {
    gates.push({ gate: "evidence_sufficiency", result: "PASS", reason: "Evidence sufficient", required_action: null });
  }

  // Gate 5: Method Sufficiency
  if (inspection.sufficiency_verdict === "BLOCKED") {
    gates.push({ gate: "method_sufficiency", result: "BLOCKED", reason: "Methods physically insufficient: " + inspection.missing_coverage.join("; "),
      required_action: "Add required methods — physics limitations, not preferences" });
    if (!blocked) { blocked = true; blockGate = "method_sufficiency"; }
  } else if (inspection.sufficiency_verdict === "INSUFFICIENT") {
    gates.push({ gate: "method_sufficiency", result: "WARNING", reason: "Gaps: " + inspection.missing_coverage.join("; "), required_action: "Consider supplemental methods" });
  } else {
    gates.push({ gate: "method_sufficiency", result: "PASS", reason: "Adequate coverage", required_action: null });
  }

  // Gate 6: Authority Validation
  if (authority.code_gaps.length > 2) {
    gates.push({ gate: "authority_validation", result: "BLOCKED", reason: "Multiple authority gaps", required_action: "Resolve governing authority" });
    if (!blocked) { blocked = true; blockGate = "authority_validation"; }
  } else if (authority.code_gaps.length > 0) {
    gates.push({ gate: "authority_validation", result: "WARNING", reason: authority.code_gaps.join("; "), required_action: "Verify authority" });
  } else {
    gates.push({ gate: "authority_validation", result: "PASS", reason: "Authority validated", required_action: null });
  }

  // Gate 7: Contradiction
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

  // Gate 8: Physics Computation Escalation
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

  // Disposition eligibility
  if (blocked) {
    gates.push({ gate: "disposition_eligibility", result: "BLOCKED", reason: "Blocked at: " + blockGate, required_action: "Resolve blocking gates" });
  } else if (escalated) {
    gates.push({ gate: "disposition_eligibility", result: "ESCALATED", reason: "Escalation required", required_action: "Engineering/Level III review" });
  } else {
    gates.push({ gate: "disposition_eligibility", result: "PASS", reason: "All gates passed", required_action: null });
  }

  // Hard Locks
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
    hardLocks.push({ code: "HL_MAJOR_DEFORMATION", reason: "Major deformation in primary member", disposition: "REPAIR BEFORE RESTART",
      physics_basis: "Permanent deformation changes load distribution" });
  }
  if (fl.critical_wall_loss_confirmed) {
    hardLocks.push({ code: "HL_CRITICAL_WALL_LOSS", reason: "Wall below code minimum", disposition: "REPAIR BEFORE RESTART",
      physics_basis: "Insufficient wall for hoop stress" });
  }

  // Disposition
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
    disposition = "conditional_go";
    disposBasis = "All gates passed but " + consequence.consequence_tier + " consequence requires monitoring";
    trace.push("DISPOSITION: conditional_go with monitoring");
  } else {
    disposition = "go";
    disposBasis = "All gates passed, evidence sufficient, methods adequate";
    trace.push("DISPOSITION: go");
  }

  // Guided Recovery
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
  for (var mi = 0; mi < inspection.missing_coverage.length; mi++) {
    recovery.push({ priority: pri++, action: "Add: " + inspection.missing_coverage[mi],
      physics_reason: "Detection physics gap", who: "NDE Level II/III" });
  }

  // Phased Strategy
  var strategy: StrategyPhase[] = [];
  var p1Time = disposition === "no_go" || consequence.consequence_tier === "CRITICAL" ? "Within 1 hour" : consequence.consequence_tier === "HIGH" ? "Within 4 hours" : "Within 24 hours";
  var p1Acts = ["Isolate affected area", "Verify personnel safety"];
  if (consequence.consequence_tier === "CRITICAL") p1Acts.push("Confirm no personnel exposure");
  if (physics.energy.stored_energy_significant) p1Acts.push("Verify isolation from pressure source");
  p1Acts.push("Document as-found conditions");
  strategy.push({ phase: 1, name: "Immediate Safety", objective: "Ensure safety, isolate, document",
    actions: p1Acts, gate: "Safe to proceed with characterization?", time_frame: p1Time });

  var p2Acts = ["Perform primary NDE for " + (damage.primary ? damage.primary.name : "dominant mechanism")];
  for (var mci = 0; mci < inspection.missing_coverage.length; mci++) p2Acts.push("ADD: " + inspection.missing_coverage[mci]);
  p2Acts.push("Quantify indication size, depth, location");
  if (physics.energy.stored_energy_significant) p2Acts.push("Wall thickness survey");
  if (authority.code_gaps.length > 0) p2Acts.push("Confirm governing code: " + authority.primary_authority);
  strategy.push({ phase: 2, name: "Characterization & NDE", objective: "Quantify damage, verify mechanism, collect data",
    actions: p2Acts, gate: "Sufficient data for engineering assessment?", time_frame: consequence.consequence_tier === "CRITICAL" ? "Within 24 hours" : "Within 72 hours" });

  var p3Acts = ["Fitness-for-service per " + authority.primary_authority];
  if (computations.fatigue.enabled) p3Acts.push("Fatigue life assessment (Paris Law growth data available)");
  if (computations.critical_flaw.enabled) p3Acts.push("Critical flaw evaluation (threshold data available)");
  if (computations.wall_loss.enabled) p3Acts.push("Remaining life assessment (corrosion rate data available)");
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
// MAIN HANDLER — ORCHESTRATES ALL 6 STATES
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
    var transcript = body.transcript || parsed.raw_text || "";
    var assetClass = asset.asset_class || "unknown";
    var events = parsed.events || [];
    var numVals = parsed.numeric_values || {};
    var lt_handler = transcript.toLowerCase();

    // ASSET ALIAS CORRECTION — fix upstream misclassification
    // Rule: transcript keywords take precedence over AI parser when strong aliases exist
    var assetCorrected = false;
    var assetCorrectionReason = "";
    // Hyperbaric / diving chambers
    if (hasWord(lt_handler, "decompression chamber") || hasWord(lt_handler, "recompression chamber") || hasWord(lt_handler, "double lock") || hasWord(lt_handler, "hyperbaric chamber") || hasWord(lt_handler, "diving bell") || hasWord(lt_handler, "dive system") || hasWord(lt_handler, "pvho") || hasWord(lt_handler, "man-rated") || hasWord(lt_handler, "personnel chamber")) {
      if (assetClass !== "pressure_vessel") {
        assetClass = "pressure_vessel";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes hyperbaric/diving pressure chamber. Overriding upstream classification (" + (asset.asset_class || "unknown") + ") to pressure_vessel.";
      }
    }
    // Boilers
    if (hasWord(lt_handler, "boiler") || hasWord(lt_handler, "steam drum") || hasWord(lt_handler, "economizer")) {
      if (assetClass !== "pressure_vessel" && assetClass !== "boiler") {
        assetClass = "pressure_vessel";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes boiler/steam equipment. Overriding to pressure_vessel.";
      }
    }
    // Piping
    if ((hasWord(lt_handler, "pipe") || hasWord(lt_handler, "piping") || hasWord(lt_handler, "pipeline")) && assetClass !== "piping" && assetClass !== "pipeline") {
      if (assetClass === "unknown" || assetClass === "bridge_concrete" || assetClass === "bridge") {
        assetClass = "piping";
        assetCorrected = true;
        assetCorrectionReason = "Transcript describes piping. Overriding upstream classification.";
      }
    }
    // Storage tanks
    if ((hasWord(lt_handler, "storage tank") || hasWord(lt_handler, "ast ") || hasWord(lt_handler, "aboveground storage")) && assetClass !== "tank") {
      assetClass = "tank";
      assetCorrected = true;
      assetCorrectionReason = "Transcript describes storage tank.";
    }
    // Pressure vessel generic
    if ((hasWord(lt_handler, "pressure vessel") || hasWord(lt_handler, "reactor") || hasWord(lt_handler, "heat exchanger") || hasWord(lt_handler, "autoclave")) && assetClass !== "pressure_vessel") {
      assetClass = "pressure_vessel";
      assetCorrected = true;
      assetCorrectionReason = "Transcript describes pressure equipment. Overriding to pressure_vessel.";
    }

    // STATE 1: Physical Reality
    var physics = resolvePhysicalReality(transcript, events, numVals, confirmedFlags, assetClass);

    // STATE 2: Damage Reality
    var damage = resolveDamageReality(physics, confirmedFlags, transcript);

    // STATE 3: Consequence Reality
    var consequence = resolveConsequenceReality(physics, damage, assetClass, transcript, confirmedFlags);

    // STATE 4: Authority Reality
    var authority = resolveAuthorityReality(assetClass, transcript, consequence, physics);

    // STATE 5: Inspection Reality
    var inspection = resolveInspectionReality(damage, consequence, physics, transcript, confirmedFlags);

    // PHYSICS COMPUTATIONS
    var computations = runPhysicsComputations(physics, numVals, assetClass, consequence);

    // CONTRADICTION DETECTOR
    var contradictions = detectContradictions(physics, damage, consequence, authority, inspection);

    // REALITY CONFIDENCE
    var confidence = computeRealityConfidence(
      physics.physics_confidence, damage.damage_confidence, consequence.consequence_confidence,
      authority.authority_confidence, inspection.inspection_confidence, contradictions.penalty);

    // STATE 6: Decision Reality
    var decision = resolveDecisionReality(physics, damage, consequence, authority, inspection, confidence, contradictions, confirmedFlags, computations);

    var elapsedMs = Date.now() - startMs;

    // Build confidence narrative
    var confNarr = "Physics=" + physics.physics_confidence + ", Damage=" + damage.damage_confidence +
      ", Consequence=" + consequence.consequence_confidence + ", Authority=" + authority.authority_confidence +
      ", Inspection=" + inspection.inspection_confidence + ". Overall=" + confidence.overall + " (" + confidence.band + ").";
    if (confidence.limiting_factors.length > 0) confNarr += " Limiting: " + confidence.limiting_factors.join("; ") + ".";

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({
        decision_core: {
          engine_version: "physics-first-decision-core-v2.0",
          elapsed_ms: elapsedMs,
          klein_bottle_states: 6,
          asset_correction: assetCorrected ? { corrected: true, original: asset.asset_class || "unknown", corrected_to: assetClass, reason: assetCorrectionReason } : { corrected: false },
          // State 1
          physical_reality: {
            stress: physics.stress, thermal: physics.thermal, chemical: physics.chemical,
            energy: physics.energy, time: physics.time,
            field_interaction: physics.field_interaction,
            physics_summary: physics.physics_summary,
            physics_confidence: physics.physics_confidence
          },
          // State 2
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
          // State 3
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
          // State 4
          authority_reality: {
            primary_authority: authority.primary_authority,
            secondary_authorities: authority.secondary_authorities,
            conditional_authorities: authority.conditional_authorities,
            physics_code_alignment: authority.physics_code_alignment,
            code_gaps: authority.code_gaps,
            design_state_warning: authority.design_state_warning,
            authority_confidence: authority.authority_confidence
          },
          // State 5
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
          // Physics Computations
          physics_computations: computations,
          // Reality Confidence
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
            confidence_narrative: confNarr
          },
          // State 6
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
