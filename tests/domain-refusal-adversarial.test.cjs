'use strict';
// ============================================================================
// domain-refusal-adversarial.test.cjs  -  the "correct refusal" half, gated.
// FORGED 4D NDT  -  DEPLOY419
//
// INDEPENDENT adversarial set (authored fresh, NOT the tuned 100-case corpus):
// confirms the classifier REFUSES out-of-scope input instead of confabulating it
// into a supported industrial domain. The dangerous direction is a thing the
// engine cannot assess (aircraft, nuclear, a coffee machine) being classified as
// SUPPORTED and getting a confident decision. Invariants are domain-true:
//   INV1 out-of-NDT input is never SUPPORTED (-> unknown/refuse)
//   INV2 a clearly unsupported ASSET CLASS is never SUPPORTED
//   INV3 an unsupported scenario carrying a supported keyword stays unsupported
//   INV4 a genuine supported scenario (incl. voice-garbled) IS supported
// A naive argmax foil (no unambiguous-term override, no weak-signal guard) MUST
// confabulate at least one trap, proving the override earns its place.
// ============================================================================
var DC = require('../netlify/functions/domain-classifier.cjs');

// ---- naive foil: pick the top-scoring domain, trust it. No override, no guard. ----
function naiveSupported(text) {
  var scores = DC.scoreDomains(text);
  var top = scores[0] || { domain: 'unknown', score: 0 };
  if (top.score <= 0) { return false; }
  return !!DC.SUPPORTED_DOMAINS[top.domain];
}

var CASES = [
  // INV1 - out-of-NDT (want refuse)
  { t: 'the office chair hydraulic cylinder will not hold height', supported: false, cls: 'out-of-NDT' },
  { t: 'the MRI machine superconducting magnet quenched overnight', supported: false, cls: 'out-of-NDT' },
  { t: 'a residential HVAC condenser coil is corroded and leaking refrigerant', supported: false, cls: 'out-of-NDT' },
  { t: 'the playground slide ladder is rusting at the base', supported: false, cls: 'out-of-NDT' },
  // INV2 - clearly unsupported asset class (want refuse)
  { t: 'the aircraft wing spar shows a fatigue crack near the wing root', supported: false, cls: 'unsupported-class' },
  { t: 'reactor core coolant loop weld inspection at the nuclear plant', supported: false, cls: 'unsupported-class' },
  { t: 'wind turbine blade root delamination on the offshore monopile', supported: false, cls: 'unsupported-class' },
  { t: 'spacecraft propellant line rupture on the satellite in transfer orbit', supported: false, cls: 'unsupported-class' },
  // INV3 - unsupported + a SUPPORTED keyword (the trap; want stay unsupported)
  { t: 'aircraft landing gear hydraulic line hairline crack at the fitting', supported: false, cls: 'trap', trap: true },
  { t: 'nuclear containment penetration nozzle weld needs inspection', supported: false, cls: 'trap', trap: true },
  { t: 'the cargo ship ballast tank and hull plating corrosion survey', supported: false, cls: 'trap', trap: true },
  { t: 'aircraft fuselage fuel tank transfer line weld crack after a hard landing', supported: false, cls: 'trap', trap: true },
  { t: 'wind turbine tower base shell weld and nozzle near the nacelle', supported: false, cls: 'trap', trap: true },
  // INV3 (strong) - SUPPORTED keyword OUTSCORES the unsupported term; only the
  // unambiguous-term override prevents confabulation (the naive foil fails these)
  { t: 'the wind farm offshore substation monopile near the platform jacket', supported: false, cls: 'trap-override', trap: true },
  { t: 'storage tank shell nozzle on the nuclear site coolant building', supported: false, cls: 'trap-override', trap: true },
  // INV4 - genuine supported, incl. voice-garbled (want supported)
  { t: '6 inch carbon steel process line in the refinery crude unit with wall loss', supported: true, cls: 'supported' },
  { t: 'pressure vessel shell and nozzle internal inspection', supported: true, cls: 'supported' },
  { t: 'uh so the the pipe yeah in the the refinery its got some wall loss eh maybe corrosion', supported: true, cls: 'supported-voice' },
  { t: 'ok um the pressure vessel the the shell nozzle weld looks bad needs a look', supported: true, cls: 'supported-voice' }
];

function pad(s, n) { s = String(s); while (s.length < n) { s = s + ' '; } return s; }
var pass = 0, total = 0, foilConfab = 0, trapCount = 0;
for (var i = 0; i < CASES.length; i++) {
  var c = CASES[i];
  var got = DC.classifyDomain(c.t).supported;
  var ok = (got === c.supported);
  if (ok) { pass++; } total++;
  console.log('  ' + (ok ? 'PASS ' : 'FAIL ') + pad(c.cls, 18) + (got ? 'SUPPORTED' : 'refuse') + (ok ? '' : '  EXPECTED ' + (c.supported ? 'SUPPORTED' : 'refuse')) + '  | ' + c.t.slice(0, 46));
  // foil: does the naive argmax confabulate a trap into supported?
  if (c.trap) { trapCount++; if (naiveSupported(c.t) === true) { foilConfab++; } }
}
console.log('\nREFUSAL GATE: ' + pass + ' / ' + total + ' invariants held');
console.log('naive foil confabulated ' + foilConfab + ' / ' + trapCount + ' traps into SUPPORTED (foil MUST fail >= 1)');
if (pass !== total || foilConfab < 1) { process.exit(1); }
