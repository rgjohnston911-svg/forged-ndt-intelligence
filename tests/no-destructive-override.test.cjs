'use strict';
// DEPLOY445 / Phase 7 gate - the seven no-destructive-override rules. A weak /
// default / keyword signal may never silently overwrite a confident, explicit,
// component-level finding; conflicts are always surfaced.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-ndo-'));
cp.execSync('npx tsc src/lib/noDestructiveOverride.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var O = require(path.join(tmp, 'noDestructiveOverride.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

// Rule 1: low confidence cannot override high confidence
var r1 = O.resolveOverride({ value: 'pressure_vessel', confidence: 0.9, kind: 'explicit-asset' }, { value: 'storage_tank', confidence: 0.3, kind: 'explicit-asset' });
ok(r1.winner.value === 'pressure_vessel' && r1.overridden === false, 'Rule 1: 0.3 cannot override 0.9');
ok(r1.conflict === true && r1.reasons.length > 0, 'Rule 1: conflict surfaced with reason');

// Rule 2: default cannot override explicit (even if equal/﻿higher numeric confidence)
var r2 = O.resolveOverride({ value: 'process_piping', confidence: 0.7, kind: 'explicit-asset', isDefault: false }, { value: 'pressure_vessel', confidence: 0.95, kind: 'default', isDefault: true });
ok(r2.winner.value === 'process_piping' && r2.overridden === false, 'Rule 2: default cannot override explicit');

// Rule 3: facility cannot override component
var r3 = O.resolveOverride({ value: 'process_piping', confidence: 0.6, kind: 'component' }, { value: 'pressure_vessel', confidence: 0.9, kind: 'facility' });
ok(r3.winner.value === 'process_piping' && r3.overridden === false, 'Rule 3: facility cannot override component');

// Rule 4: domain keyword cannot override explicit asset  (the TEST 22 reference example)
var r4 = O.resolveOverride({ value: 'furnace', confidence: 0.89, kind: 'explicit-asset' }, { value: 'offshore_platform', confidence: 0.31, kind: 'domain-keyword' });
ok(r4.winner.value === 'furnace' && r4.overridden === false, 'Rule 4: furnace(0.89) beats offshore_platform(0.31, domain-keyword)');
ok(r4.conflict === true && /Rule 4/.test(r4.reasons.join(' ')), 'Rule 4: conflict logged with rule cited');

// Rule 4 still blocks even when the keyword somehow has higher confidence
var r4b = O.resolveOverride({ value: 'furnace', confidence: 0.5, kind: 'explicit-asset' }, { value: 'offshore_platform', confidence: 0.99, kind: 'domain-keyword' });
ok(r4b.winner.value === 'furnace', 'Rule 4: explicit asset protected even vs a high-confidence domain keyword');

// Rule 5: jurisdiction keyword cannot override explicit asset
var r5 = O.resolveOverride({ value: 'pressure_vessel', confidence: 0.8, kind: 'explicit-asset' }, { value: 'pipeline', confidence: 0.9, kind: 'jurisdiction-keyword' });
ok(r5.winner.value === 'pressure_vessel' && /Rule 5/.test(r5.reasons.join(' ')), 'Rule 5: jurisdiction keyword cannot override explicit asset');

// A legitimate override IS allowed: stronger, better-grounded, meaningfully higher confidence
var rOK = O.resolveOverride({ value: 'pressure_vessel', confidence: 0.4, kind: 'domain-keyword' }, { value: 'storage_tank', confidence: 0.9, kind: 'explicit-asset' });
ok(rOK.winner.value === 'storage_tank' && rOK.overridden === true, 'legit override: explicit 0.9 supersedes keyword 0.4');

// Rules 6 & 7: same value -> no conflict; differing -> always surfaced
ok(O.resolveOverride({ value: 'x', confidence: 0.5, kind: 'explicit-asset' }, { value: 'x', confidence: 0.6, kind: 'explicit-asset' }).conflict === false, 'same value -> no conflict');

// reduceClaims folds a list and accumulates conflicts (never hidden)
var red = O.reduceClaims([
  { value: 'furnace', confidence: 0.89, kind: 'explicit-asset' },
  { value: 'offshore_platform', confidence: 0.31, kind: 'domain-keyword' },
  { value: 'pressure_vessel', confidence: 0.95, kind: 'default', isDefault: true }
]);
ok(red.winner.value === 'furnace', 'reduceClaims: furnace survives keyword + default challengers');
ok(red.conflicts.length === 2, 'reduceClaims: both conflicts surfaced (got ' + red.conflicts.length + ')');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) { console.log('FAIL no-destructive-override: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
console.log('All no-destructive-override Phase-7 checks passed (' + pass + ' assertions: 7 rules; TEST 22 reference example; legit override allowed; conflicts always surfaced).');
