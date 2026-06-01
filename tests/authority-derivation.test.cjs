'use strict';
// DEPLOY443 / Phase 5 gate - authority is DERIVED, never keyword-selected:
// Component -> Asset (component precedence, Phase 7 rule 3) -> Authority, plus a
// Tier-1 cited-code-vs-asset consistency veto. Includes the T13 exit condition:
// air-cooler INLET PIPING derives API 570 (not API 510) with NO asset-specific
// keyword anywhere in authorityDerivation.ts.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-auth-'));
cp.execSync('npx tsc src/lib/authorityDerivation.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var A = require(path.join(tmp, 'authorityDerivation.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

// ---- component precedence (Phase 7 rule 3) ----
var reac = 'Refinery hydrocracker reactor effluent air cooler inlet piping, 10-inch A106 Gr B carbon steel.';
var r1 = A.applyComponentPrecedence('pressure_vessel', reac);
ok(r1.overridden === true && r1.assetClass === 'process_piping', 'air-cooler inlet piping overrides vessel -> process_piping (got ' + r1.assetClass + ')');

// a genuine pipeline winner is NEVER rewritten to process_piping
var sub = 'Subsea pipeline tie-in, flowline connected to manifold spool.';
var r2 = A.applyComponentPrecedence('pipeline', sub);
ok(r2.overridden === false && r2.assetClass === 'pipeline', 'pipeline winner not rewritten (got ' + r2.assetClass + ')');

// a vessel with no piping component stays a vessel
var r3 = A.applyComponentPrecedence('pressure_vessel', 'Distillation column shell, ferritic steel, fully documented.');
ok(r3.overridden === false && r3.assetClass === 'pressure_vessel', 'vessel without piping component unchanged');

// ---- asset -> authority derivation ----
ok(A.deriveAuthority('process_piping').primary === 'API 570', 'piping -> API 570');
ok(A.deriveAuthority('pressure_vessel').primary === 'API 510', 'vessel -> API 510');
ok(A.deriveAuthority('storage_tank').primary === 'API 653', 'tank -> API 653');
ok(A.deriveAuthority('fired_heater').primary === 'API 530', 'fired heater -> API 530');
ok(A.deriveAuthority('offshore_platform').primary === 'API RP 2A', 'offshore -> API RP 2A');
ok(A.deriveAuthority('wind_turbine').primary === 'IEC 61400', 'wind -> IEC 61400');
ok(A.deriveAuthority('unknown').derived === false && A.deriveAuthority('unknown').codes.length === 0, 'unknown asset -> no derived authority (never keyword-guessed)');

// the T13 chain end-to-end: vessel-misread piping transcript -> piping -> API 570, NOT API 510
var chainAsset = A.applyComponentPrecedence('pressure_vessel', reac).assetClass;
var chainAuth = A.deriveAuthority(chainAsset);
ok(chainAuth.primary === 'API 570', 'T13 chain: REAC inlet piping -> API 570');
ok(chainAuth.codes.indexOf('API 510') < 0, 'T13 chain: API 510 excluded');

// ---- Tier-1 consistency veto ----
ok(A.checkAuthorityConsistency('process_piping', ['API 653']).vetoed === true, 'piping + API 653 (tank code) -> veto');
ok(/does not apply/.test(A.checkAuthorityConsistency('process_piping', ['API 653']).reason), 'veto carries a cited reason');
ok(A.checkAuthorityConsistency('process_piping', ['API 570', 'ASME B31.3']).vetoed === false, 'piping + API 570 -> consistent');
ok(A.checkAuthorityConsistency('pressure_vessel', ['API 510']).vetoed === false, 'vessel + API 510 -> consistent');
ok(A.checkAuthorityConsistency('heat_exchanger', ['API 510']).vetoed === false, 'exchanger + API 510 -> consistent (same family)');

// ---- the exit-gate invariant: NO asset-specific keyword in the derivation source ----
var src = fs.readFileSync(path.join(ROOT, 'src/lib/authorityDerivation.ts'), 'utf8').toLowerCase();
ok(src.indexOf('reac') < 0, 'authorityDerivation.ts contains NO REAC keyword (general rule, not a patch)');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) {
  console.log('FAIL authority-derivation: ' + fails.length + ' assertion(s) failed');
  fails.forEach(function (f) { console.log('   - ' + f); });
  process.exit(1);
}
console.log('All authority-derivation Phase-5 checks passed (' + pass + ' assertions: component precedence, asset->authority derivation, Tier-1 consistency veto, T13 chain -> API 570 with no REAC keyword).');
