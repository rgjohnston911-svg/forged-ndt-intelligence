'use strict';
// DEPLOY388 - domain classification regression battery. Proves the weak-signal
// guard + LNG/cryogenic keyword fixes, and locks classification across domains
// so a single overloaded keyword can never again misroute a valid industrial
// scenario into an exotic unsupported domain.
var c = require('../netlify/functions/domain-classifier.cjs');
function assert(cond, m) { if (!cond) { throw new Error('FAIL: ' + m); } }
function cls(t) { return c.classifyDomain(t); }

// ---- The Test-3 regression: LNG export terminal must NOT become rocket ----
var lng = "LNG Export Terminal, Gulf Coast. During a routine drone-assisted visual inspection, an NDT " +
  "technician identifies coating failure and external corrosion on a 36-inch cryogenic LNG transfer line " +
  "support assembly. Support bracket original thickness 0.750 in, measured 0.412 in. Operating at -260F.";
var r3 = cls(lng);
assert(r3.domain !== 'aerospace_ground_test', 'LNG must not route to aerospace (got ' + r3.domain + ')');
assert(r3.rawTopDomain !== 'aerospace_ground_test', 'LNG raw top must not be aerospace either (got ' + r3.rawTopDomain + ')');
assert(r3.supported === true, 'LNG must land in a SUPPORTED domain (got ' + r3.domain + ', supported=' + r3.supported + ')');
assert(r3.domain === 'pressure_equipment', 'LNG -> pressure_equipment (got ' + r3.domain + ')');

// ---- Bare "cryogenic" alone no longer triggers any exotic domain ----
var bareCryo = "The cryogenic line developed frost and a small coating blister near the flange.";
var rb = cls(bareCryo);
assert(rb.domain !== 'aerospace_ground_test' && rb.rawTopDomain !== 'aerospace_ground_test', 'bare cryogenic does not imply rocket');

// ---- Guard: a single weak exotic keyword falls back, never commits ----
var weak = "A single turbine vibration was noted during the walkdown.";
var rw = cls(weak);
assert(rw.domain !== 'power_generation' || rw.guardApplied, 'single weak keyword should be guarded (turbine alone)');
assert(rw.rawTopDomain === 'power_generation', 'raw top was the weak exotic (turbine)');
assert(rw.guardApplied === true, 'guard applied on weak single-hit unsupported (got guardApplied=' + rw.guardApplied + ')');

// ---- Guard does NOT over-block genuine exotic scenarios (strong signal) ----
var rocket = "Rocket engine hot fire on the test stand; combustion chamber wall thinning and thrust frame " +
  "cracking observed during ground test.";
var rr = cls(rocket);
assert(rr.domain === 'aerospace_ground_test', 'genuine multi-keyword rocket test still classifies as aerospace (got ' + rr.domain + ')');
assert(rr.guardApplied === false, 'strong exotic signal is committed, not guarded');

var nuke = "Nuclear plant: reactor core containment inspection, spent fuel pool, coolant loop radiation survey.";
var rn = cls(nuke);
assert(rn.domain === 'nuclear', 'genuine multi-keyword nuclear classifies as nuclear (got ' + rn.domain + ')');

// ---- Supported-domain sanity (must classify correctly, unchanged) ----
assert(cls("24 inch subsea crude oil pipeline; anchor drag event; free span at KP 14.7.").domain === 'pipeline', 'subsea pipeline -> pipeline');
assert(cls("Offshore platform jacket leg and riser brace node inspection.").domain === 'offshore_oil_gas', 'offshore -> offshore_oil_gas');
assert(cls("Refinery delayed coker crude unit; sulfidation on overhead piping pipe rack.").domain === 'refinery', 'refinery -> refinery');
assert(cls("Highway bridge girder, pier cap and abutment bearing inspection; deck soffit scour.").domain === 'bridge_civil', 'bridge -> bridge_civil');

// ---- A truly unknown scenario -> unknown (not a confident exotic) ----
var unknown = cls("The thing near the area had some surface marks after the weekend.");
assert(unknown.domain === 'unknown', 'no-signal text -> unknown (got ' + unknown.domain + ')');

// ---- DEPLOY439 (TEST 22): petrochemical furnace must NOT route to offshore ----
// Bug: the generic word "hydrocarbon" was an offshore_oil_gas keyword, so an
// ethylene-cracker furnace scored offshore; reality-lock then overrode the correct
// pressure_vessel/fired_heater asset to "offshore_platform" (API RP 2A, structural-
// instability), contaminating every downstream engine. Fix: "hydrocarbon" removed
// from offshore keywords (it is generic to all hydrocarbon processing, not offshore-
// discriminating); furnace/fired-heater/petrochemical terms route to the SUPPORTED
// refinery/process domain instead.
var furnace = "Large coastal petrochemical complex. Ethylene cracker furnace. Determine if Furnace F-7 " +
  "should remain in operation until the next turnaround in 18 months. Tubes. Mixed feed including heavier " +
  "hydrocarbons. Coking rate increasing every year. Furnace draft sensors periodically drift. Tube metal " +
  "temperatures remain normal.";
var rf = cls(furnace);
assert(rf.domain !== 'offshore_oil_gas', 'furnace must NOT classify offshore (got ' + rf.domain + ')');
assert(rf.rawTopDomain !== 'offshore_oil_gas', 'furnace raw top must NOT be offshore (got ' + rf.rawTopDomain + ')');
assert(rf.domain === 'refinery', 'ethylene cracker furnace -> refinery/process (got ' + rf.domain + ')');
assert(rf.supported === true, 'furnace must land in a SUPPORTED domain (got supported=' + rf.supported + ')');

// ---- "hydrocarbon" alone no longer implies offshore ----
var hc = "Mixed feed including heavier hydrocarbons in the process unit.";
var rhc = cls(hc);
assert(rhc.domain !== 'offshore_oil_gas', 'bare hydrocarbon must not imply offshore (got ' + rhc.domain + ')');

// ---- Determinism ----
assert(JSON.stringify(cls(lng)) === JSON.stringify(cls(lng)), 'deterministic');

console.log('All DEPLOY388 domain-classifier checks passed (LNG -> pressure_equipment; weak exotic guarded -> unknown/supported; genuine rocket/nuclear still classify; supported domains unchanged).');
