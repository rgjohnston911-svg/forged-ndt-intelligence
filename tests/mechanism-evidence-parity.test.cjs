'use strict';
// DEPLOY457 CP3 commit-1 gate: the server mechanism-evidence verdict (_mechanism-evidence.js,
// consumed by the satellites) must AGREE with the client evidence classifier
// (src/lib/evidenceGate.ts, consumed by reconcile's physical bid) on the golden transcripts.
// This is the single-source guard across the TS/JS boundary (build directive S2.4): one verdict,
// the server and client can never disagree. Also pins the verdict shape + the H2S != hydrogen
// distinction the NACE lock depends on.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp3-mev-'));
cp.execSync('npx tsc src/lib/evidenceGate.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var TS = require(path.join(tmp, 'evidenceGate.js'));
var JS = require(path.join(ROOT, 'netlify/functions/_mechanism-evidence.cjs'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

var FAMS = ['corrosion', 'cracking', 'structural'];
function parity(label, t) {
  for (var i = 0; i < FAMS.length; i++) {
    var fam = FAMS[i];
    var tsLevel = TS.classifyMechanismEvidence(fam, t).level;
    var jsLevel = JS.classifyFamily(fam, t).level;
    ok(tsLevel === jsLevel, label + ' [' + fam + ']: TS=' + tsLevel + ' JS=' + jsLevel + ' (must match)');
  }
}

// (1) TEST 28 - healthy H2 piping, all within limits -> no confirmed mechanism, NOT sour (hydrogen != H2S)
var t28 = 'High-pressure hydrogen recycle piping, 2.25Cr-1Mo. UT minimum thickness 0.428 inch above required, corrosion rate stable, no accelerated thinning. PAUT no crack-like indications. Visual no distortion, no leakage. Within design limits. No corrosion issue, no cracking issue, no damage mechanism identified.';
parity('TEST28', t28);
var v28 = JS.buildMechanismVerdict(t28);
ok(v28.confirmed === 'NONE', 'TEST28 verdict.confirmed === NONE (got ' + v28.confirmed + ')');
ok(v28.sour_service === false, 'TEST28 sour_service false - hydrogen-rich gas is NOT sour service (NACE must not fire)');

// (2) genuine corrosion -> confirmed corrosion (parity + verdict)
var tCorr = 'Process piping elbow, measured wall loss of 64 percent, remaining wall 0.12 inch, corrosion product observed.';
parity('REAL_CORROSION', tCorr);
ok(JS.buildMechanismVerdict(tCorr).confirmed === 'corrosion', 'real corrosion -> verdict.confirmed === corrosion');

// (3) genuine crack indication -> confirmed cracking
var tCrack = 'PAUT examination detected a crack-like linear indication; through-wall crack confirmed.';
parity('REAL_CRACK', tCrack);
ok(JS.buildMechanismVerdict(tCrack).confirmed === 'cracking', 'real crack -> verdict.confirmed === cracking');

// (4) sour service stated -> sour_service true + cracking candidate (SUSPECTED, not confirmed)
var tSour = 'Sour gas pipeline, 200 ppm H2S, wet H2S service. No crack indications found on inspection.';
parity('SOUR', tSour);
var vSour = JS.buildMechanismVerdict(tSour);
ok(vSour.sour_service === true, 'sour service -> sour_service true (NACE may lock)');
ok(vSour.confirmed === 'NONE', 'sour service with no crack indication -> confirmed NONE (screening, not confirmed)');

// (5) hydrogen WITHOUT H2S -> sour_service false (the precise NACE distinction)
var tH2 = 'Hydrogen-rich recycle gas circuit, 2.25Cr-1Mo, 720F, 2150 psi. No H2S present.';
ok(JS.buildMechanismVerdict(tH2).sour_service === false, 'hydrogen (no H2S) -> sour_service false (hydrogen != sour)');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) { console.log('FAIL mechanism-evidence-parity: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
console.log('mechanism-evidence-parity: all ' + pass + ' checks passed (server JS verdict agrees with client TS classifier; H2S != hydrogen; verdict shape pinned).');
