'use strict';
// ============================================================================
// run-gates.cjs  -  runs every acceptance gate in tests/*.test.cjs and exits
// non-zero if any fails. Wired into the Netlify build (netlify.toml) so a red
// gate BLOCKS the deploy, and into CI (.github/workflows/ci.yml). Before this,
// the gates were git-ignored and ran only on a developer's machine - a pushed
// engine regression would deploy clean. This is the deploy gate. FORGED DEPLOY419.
// ============================================================================
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var dir = path.join(__dirname, '..', 'tests');
var files = fs.readdirSync(dir).filter(function (f) { return f.slice(-9) === '.test.cjs'; }).sort();
var pass = 0, failed = [];

console.log('Running ' + files.length + ' acceptance gates...\n');
files.forEach(function (f) {
  try {
    cp.execFileSync('node', [path.join(dir, f)], { stdio: 'pipe' });
    pass++;
    console.log('  PASS  ' + f);
  } catch (e) {
    failed.push(f);
    console.log('  FAIL  ' + f);
    var out = (e.stdout ? String(e.stdout) : '') + (e.stderr ? String(e.stderr) : '');
    out.split('\n').slice(-8).forEach(function (l) { if (l.trim()) { console.log('        | ' + l); } });
  }
});

console.log('\nACCEPTANCE GATES: ' + pass + ' / ' + files.length + ' passed');
if (failed.length > 0) {
  console.log('FAILED: ' + failed.join(', '));
  process.exit(1);
}
