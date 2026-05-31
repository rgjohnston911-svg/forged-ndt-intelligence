'use strict';
// report-provenance gate (DEPLOY417): does every quantitative claim + the
// disposition in the narrative trace to an engine value? With a naive foil that
// lacks fraction<->percent normalization and so false-flags a legit rounding.
var RP = require('../netlify/functions/report-provenance.cjs');
var pass = 0, total = 0;
function check(n, c) { total++; if (c) { pass++; console.log('PASS ' + n); } else { console.log('FAIL ' + n); } }

// Authoritative source the engines produced.
var SOURCE = {
  remaining_strength: { wall_loss_fraction: 0.42, remaining_life_years: 12.3, mawp_psi: 1450 },
  failure_mode_dominance: { governing_basis: 'corrosion at 0.42 wall loss fraction' },
  decision_reality: { disposition: 'no_go' }
};

// 1. a report whose numbers all trace (incl. "42%" from 0.42, "12 years" from 12.3) -> PASS
var good = 'External corrosion has consumed 42% of the wall. Remaining life is about 12 years at 1450 psi MAWP. Disposition: no-go.';
var rGood = RP.validateProvenance(good, SOURCE, SOURCE.decision_reality.disposition);
check('sourced report -> PASS', rGood.verdict === 'PASS');
check('  %<->fraction normalized (42% from 0.42)', rGood.unsourced_claims.indexOf('42%') < 0);
check('  rounded year matched (12 years from 12.3)', rGood.unsourced_claims.join(',').indexOf('12 year') < 0);

// 2. an INVENTED number the engines never produced -> FAIL, names it
var bad = 'External corrosion has consumed 67% of the wall. Disposition: no-go.';
var rBad = RP.validateProvenance(bad, SOURCE, 'no_go');
check('invented number (67%) -> FAIL', rBad.verdict === 'FAIL');
check('  names the unsourced claim', rBad.unsourced_claims.join(',').indexOf('67%') >= 0);

// 3. disposition the LLM flipped vs the engine -> FAIL
var flipped = 'Wall loss is 42%. The asset is fit for service.';
var rFlip = RP.validateProvenance(flipped, SOURCE, 'no_go');
check('disposition mismatch (fit for service vs no_go) -> FAIL', rFlip.verdict === 'FAIL' && rFlip.disposition_match === false);

// 4. bare unit-less integers are NOT claims (no false flag on "3 mechanisms")
var counts = 'The analysis validated 3 mechanisms across 2 reality states. Wall loss 42%.';
check('bare integers ignored, only 42% checked -> PASS', RP.validateProvenance(counts, SOURCE, 'no_go').verdict === 'PASS');

// ---- NAIVE FOIL: no fraction<->percent normalization. MUST false-flag the legit 42%. ----
function naiveValidate(prose, source) {
  function collect(o, acc) {
    if (o == null) return acc;
    if (typeof o === 'number') { acc[String(o)] = true; return acc; }
    if (typeof o === 'string') { (o.match(/-?\d+(?:\.\d+)?/g) || []).forEach(function (x) { acc[x] = true; }); return acc; }
    if (typeof o === 'object') { for (var k in o) collect(o[k], acc); }
    return acc;
  }
  var acc = collect(source, {});
  var claims = RP.extractClaims(prose), uns = [];
  for (var i = 0; i < claims.length; i++) { if (!acc[String(claims[i].value)]) uns.push(claims[i].raw); }
  return uns;
}
var naiveUns = naiveValidate(good, SOURCE);
check('FOIL false-flags the legit 42% (proves normalization matters)', naiveUns.join(',').indexOf('42%') >= 0);

console.log('REPORT-PROVENANCE GATE: ' + pass + ' / ' + total + ' passed');
if (pass !== total) { process.exit(1); }
