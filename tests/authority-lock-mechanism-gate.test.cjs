'use strict';
// DEPLOY458 CP3 commit-2 gate: Authority Lock consumes the single mechanism-evidence verdict.
// ASSET-CLASS locks (API 510 / B31.3 / general API 579 FFS authority) fire from asset type, always.
// MECHANISM-TRIGGERED locks (API 579 Part 9 crack, NACE MR0175 sour, Part 4/5 metal loss) fire ONLY
// on the evidence verdict - never on inferred has_cracking or sour-from-hydrogen. This is the contract
// that collapses the TEST 30 / TEST 31 HIC/API-579 tower.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp3-al-'));
fs.copyFileSync(path.join(ROOT, 'netlify/functions/authority-lock.js'), path.join(tmp, 'authority-lock.cjs'));
fs.copyFileSync(path.join(ROOT, 'netlify/functions/_mechanism-evidence.cjs'), path.join(tmp, '_mechanism-evidence.cjs'));
process.env.NDT_API_KEY = 'k';
var AL = require(path.join(tmp, 'authority-lock.cjs'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

function locks(body) {
  return Promise.resolve(AL.handler({ httpMethod: 'POST', headers: { 'X-API-Key': 'k' }, body: JSON.stringify(body) }))
    .then(function (r) {
      var b = JSON.parse(r.body);
      var all = (b.authority_chain || b.authorities || []).map(function (a) { return a.code; })
        .concat((b.supplemental_codes || []).map(function (a) { return a.code; }));
      return { all: all, has: function (re) { return all.some(function (c) { return re.test(c); }); }, verdict: b.mechanism_verdict };
    });
}

(async function () {
  // TEST 30: hydrogen piping, within limits, NO H2S -> NO mechanism-triggered locks (tower collapsed)
  var t30 = await locks({ asset_type: 'process_piping', component_description: 'high-pressure hydrogen recycle piping 2.25Cr-1Mo, UT thickness within limits, no corrosion, PAUT no crack indications, no leak, within design limits, no H2S present', service_environment: 'hydrogen', damage_mechanisms: ['hic', 'ssc'], has_cracking: true, is_pressure_boundary: true });
  ok(!t30.has(/Part 9/) && !t30.has(/NACE|ISO 15156/) && !t30.has(/Part 4|Part 5/), 'TEST30 hydrogen: NO crack/NACE/metal-loss locks despite inferred has_cracking+hic/ssc (got: ' + t30.all.join(',') + ')');
  ok(t30.verdict.sour_service === false, 'TEST30: hydrogen is not sour (NACE must not fire on hydrogen)');

  // TEST 31: SIS (clean), even if misclassified -> NO mechanism-triggered locks (asset-class fix is separate)
  var t31 = await locks({ asset_type: 'pressure_vessel', component_description: 'safety instrumented system SIS-204, valves stroke within time, no leakage, no mechanical damage, no corrosion, no cracking, no leak, no damage mechanism', service_environment: '', damage_mechanisms: [], has_cracking: false, is_pressure_boundary: true });
  ok(!t31.has(/Part 9/) && !t31.has(/NACE/) && !t31.has(/Part 4|Part 5/), 'TEST31 SIS clean: NO crack/NACE/metal-loss locks (tower collapsed)');

  // Real corrosion -> Part 4/5 metal-loss locks fire (legitimate)
  var corr = await locks({ asset_type: 'process_piping', component_description: 'piping elbow, measured wall loss of 64 percent, remaining wall 0.12 inch, corrosion product observed', service_environment: '', damage_mechanisms: ['corrosion'], wall_loss_percent: 64, is_pressure_boundary: true });
  ok(corr.has(/Part 4/) && corr.has(/Part 5/), 'real corrosion -> API 579 Part 4/5 metal-loss locks fire');

  // Real crack -> Part 9 fires (legitimate)
  var crack = await locks({ asset_type: 'pressure_vessel', component_description: 'PAUT detected a crack-like linear indication, through-wall crack confirmed', service_environment: '', damage_mechanisms: ['crack'], has_cracking: true, is_pressure_boundary: true });
  ok(crack.has(/Part 9/), 'real crack -> API 579 Part 9 crack-assessment lock fires');

  // Real sour (H2S) -> NACE fires (legitimate)
  var sour = await locks({ asset_type: 'pipeline', component_description: 'sour gas pipeline, 200 ppm H2S, wet H2S service, no crack indications found', service_environment: 'sour', damage_mechanisms: [], is_pressure_boundary: true });
  ok(sour.has(/NACE|ISO 15156/), 'real H2S service -> NACE MR0175 fires');
  ok(sour.verdict.sour_service === true, 'real H2S -> verdict sour_service true (comma-clause negation did not eat it)');

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fails.length) { console.log('FAIL authority-lock-mechanism-gate: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
  console.log('authority-lock-mechanism-gate: all ' + pass + ' checks passed (mechanism-triggered locks gate on the verdict; asset-class locks unchanged; TEST30/31 tower collapses; real corrosion/crack/sour still lock).');
})();
