'use strict';
// DEPLOY451 / RAE gate - roles are AUTHORITY DOMAINS, not people. No wants/fears/bias/score.
// Each role emits a code-anchored conclusion or OUTSIDE_AUTHORITY; cross-discipline conflicts
// are COUNTED (with two code citations), never scored.
var cp = require('child_process'); var fs = require('fs'); var os = require('os'); var path = require('path');
var ROOT = path.join(__dirname, '..');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rae-'));
cp.execSync('npx tsc src/lib/roleAuthority.ts --outDir "' + tmp + '" --module commonjs --target es2019 --skipLibCheck --esModuleInterop', { cwd: ROOT, stdio: 'pipe' });
var R = require(path.join(tmp, 'roleAuthority.js'));
var pass = 0; var fails = [];
function ok(c, m) { if (c) { pass++; } else { fails.push(m); } }

// six roles only; Financial deleted
var ids = R.deriveRoleOutputs({ transcript: 'x' }).map(function (r) { return r.role; });
ok(ids.length === 6, 'exactly six roles (got ' + ids.length + ')');
ok(ids.indexOf('FINANCIAL') < 0, 'Financial role deleted');
ok(ids.join(',') === 'CWI,NDT,COATINGS,ENGINEER,SAFETY,OPERATIONS', 'role set is the six authority domains');

// no human-factor keys leak from any role output
var sample = R.analyzeRoleAuthority({ transcript: 'compressor healthy, all within tolerance', physical: 'ACCEPTABLE' });
var keys = Object.keys(sample.roles[0]).join(',');
ok(!/what_they_want|what_they_fear|bias|contamination/i.test(keys), 'role output has no wants/fears/bias keys (got ' + keys + ')');
ok(!('score' in sample) && typeof sample.conflict_count === 'number', 'conflict is a count, not a score');

// authority boundary: no weld evidence -> CWI OUTSIDE_AUTHORITY
var cwi = R.deriveRoleOutputs({ transcript: 'pressure vessel internal inspection, no welds discussed' }).filter(function (r) { return r.role === 'CWI'; })[0];
ok(cwi.conclusion === 'OUTSIDE_AUTHORITY' && cwi.within_authority === false, 'CWI outside authority with no weld evidence');

// OPERATIONS provenance rule: inferred production pressure is NOT usable; only stated envelope
var opsInferred = R.deriveRoleOutputs({ transcript: 'production increased 18 percent, deferred maintenance up 64 percent' }).filter(function (r) { return r.role === 'OPERATIONS'; })[0];
ok(opsInferred.conclusion === 'OUTSIDE_AUTHORITY', 'OPERATIONS outside authority on inferred pressure (no stated envelope)');
var opsStated = R.deriveRoleOutputs({ transcript: 'operator logged the unit is operating outside the operating envelope during startup' }).filter(function (r) { return r.role === 'OPERATIONS'; })[0];
ok(opsStated.conclusion === 'Outside Operating Envelope' && opsStated.within_authority === true, 'OPERATIONS uses a STATED envelope constraint');

// Engineer: confirmed mechanism + hard lock -> Not Fit For Service; clean -> Fit For Service
var engStop = R.deriveRoleOutputs({ transcript: 'api 579 ffs; measured wall loss', confirmedMechanism: 'corrosion', hardLockCount: 1, physical: 'CONFIRMED_DAMAGE' }).filter(function (r) { return r.role === 'ENGINEER'; })[0];
ok(engStop.conclusion === 'Not Fit For Service' && engStop.code_cited, 'Engineer NFS on confirmed damage + hard lock, code cited');
var engOk = R.deriveRoleOutputs({ transcript: 'stress and thickness reviewed; acceptable', physical: 'ACCEPTABLE' }).filter(function (r) { return r.role === 'ENGINEER'; })[0];
ok(engOk.conclusion === 'Fit For Service', 'Engineer FFS when physical acceptable');

// Safety: hard lock / CRITICAL -> Immediate Hazard
var saf = R.deriveRoleOutputs({ transcript: 'process safety; personnel exposure', hardLockCount: 1, consequenceTier: 'CRITICAL' }).filter(function (r) { return r.role === 'SAFETY'; })[0];
ok(saf.conclusion === 'Immediate Hazard' && /OSHA|PSM/.test(saf.code_cited), 'Safety Immediate Hazard with code');

// Conflict detection: Safety STOP + Operations CONTINUE -> one counted conflict with two codes
var conflictCtx = R.analyzeRoleAuthority({ transcript: 'process safety personnel exposure; operator logged within operating envelope', confirmedMechanism: 'corrosion', hardLockCount: 1, consequenceTier: 'CRITICAL', physical: 'CONFIRMED_DAMAGE' });
ok(conflictCtx.conflict_count >= 1, 'a STOP vs CONTINUE conflict is counted (got ' + conflictCtx.conflict_count + ')');
ok(conflictCtx.conflict_list[0].code_a && conflictCtx.conflict_list[0].code_b, 'each conflict carries two code citations');
ok(conflictCtx.escalation_required === true && /hard-authority STOP governs/.test(conflictCtx.resolution), 'hard STOP governs resolution + escalation required');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails.length) { console.log('FAIL role-authority: ' + fails.length); fails.forEach(function (f) { console.log('   - ' + f); }); process.exit(1); }
console.log('All role-authority RAE checks passed (' + pass + ' assertions: six authority-domain roles, Financial deleted, no wants/fears/bias/score, Ops provenance rule, conflict COUNT with dual citations, hard-STOP resolution).');
