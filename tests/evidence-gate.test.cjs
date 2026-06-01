'use strict';
// DEPLOY444 / Phase 6 gate - a mechanism is ACTIVE/CONFIRMED only with DIRECT
// evidence; indirect indicators support at most SUSPECTED; consequence / missing
// records / failures-elsewhere / a repaired or negated finding are NEVER enough.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p6-ev-'));
cp.execSync('npx tsc src/lib/evidenceGate.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var E = require(path.join(tmp, 'evidenceGate.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

// corrosion: measured wall loss -> CONFIRMED; "no significant wall loss" -> not active
ok(E.classifyMechanismEvidence('corrosion', 'measured wall loss of 64% at the elbow').level === 'CONFIRMED', 'measured wall loss -> CONFIRMED');
ok(E.classifyMechanismEvidence('corrosion', 'ultrasonic readings show no significant wall loss').level !== 'CONFIRMED', 'no significant wall loss -> not CONFIRMED');

// cracking: NDT indication -> CONFIRMED; a re-welded (repaired) crack -> not active
ok(E.classifyMechanismEvidence('cracking', 'PAUT detected a crack indication in the weld').level === 'CONFIRMED', 'NDT crack indication -> CONFIRMED');
ok(E.classifyMechanismEvidence('hic', 'a branch that cracked once and was re-welded; trace H2S').level === 'NONE', 'repaired crack + trace H2S -> HIC NONE (not active)');

// wet-H2S service alone (no crack evidence) -> SUSPECTED at most
ok(E.classifyMechanismEvidence('hic', 'wet H2S sour service line, no indications found').level === 'SUSPECTED', 'wet H2S service -> SUSPECTED');

// consequence / failures-elsewhere are never sufficient for ACTIVE
ok(E.hasInsufficientOnlySignals('a similar furnace at another company suffered a catastrophic rupture') === true, 'failures-elsewhere flagged insufficient');
ok(E.classifyMechanismEvidence('cracking', 'catastrophic consequence; a similar unit failed elsewhere').level === 'NONE', 'consequence + elsewhere -> NONE (not active)');

// structural: settlement beyond allowable -> CONFIRMED; within allowable -> not
ok(E.classifyMechanismEvidence('structural', 'differential settlement beyond the allowable limit').level === 'CONFIRMED', 'settlement beyond allowable -> CONFIRMED');
ok(E.classifyMechanismEvidence('structural', 'settlement 12 mm within the 75 mm allowable').level !== 'CONFIRMED', 'settlement within allowable -> not CONFIRMED');

// BREAKER_D re-rank: fatigue (evidenced by dynamic signals) leads HIC (unevidenced)
var bd = 'piping spool downstream of a reciprocating compressor. Throughput increased 35 percent. persistent high vibration, intermittent slugging, transient pressure excursions, an unsupported pipe span. a small-bore branch connection that cracked once and was re-welded. no significant wall loss. trace H2S.';
var g = E.gateSuspectedMechanisms(['hic', 'cracking', 'fatigue'], bd);
ok(g.leader === 'fatigue' && g.leaderLevel === 'SUSPECTED', 'BREAKER_D: fatigue leads, hic demoted (got ' + g.leader + ')');
ok(g.ordered.indexOf('hic') > g.ordered.indexOf('fatigue'), 'BREAKER_D: hic ranked below fatigue');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) { console.log('FAIL evidence-gate: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
console.log('All evidence-gate Phase-6 checks passed (' + pass + ' assertions: direct-evidence gate for corrosion/cracking/structural, repair+negation+consequence handling, BREAKER_D re-rank fatigue>hic).');
