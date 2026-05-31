'use strict';
// ============================================================================
// PERIPHERAL EXTRACTOR -- INDEPENDENT CORPUS GATE  (DEPLOY415b)
//
// Authored by an external reviewer WITHOUT sight of the extractor (the "second
// mind" the 18/18 self-authored gate could not provide). Each case targets a
// blind-spot CLASS that produces a CONFIDENT WRONG referral - the kind a clean-
// input aggregation gate can never reveal because the contamination enters
// upstream. This running of it found three real failures (attribution C3,
// temporal C5, actor-precision C6) that the negation fix did not reach; C3/C5
// had been MASKED by a bare-noun gap (bare "support" was never detected, so the
// attribution/temporal bugs hid behind a non-detection). Fixed at root: clause
// scoping, temporal-remediation guard, word-boundary bare-noun match, and
// co-location demotion of incidental puddles. A naive foil is run alongside and
// MUST fail the trap classes.
//
// Run: node tests/peripheral-extractor-independent.test.cjs
// ============================================================================
var P = require('../netlify/functions/peripheral-referral.cjs');

// emit = the actor classes that result in a REFER or NOTE (SUPPRESS = not emitted)
function realEmit(text) {
  var scored = P.scoreReferrals(P.extractPeripheralsFromText(text, 'HIGH')).referrals;
  return scored.filter(function (x) { return x.routing.action !== 'SUPPRESS'; })
               .map(function (x) { return x.secondary_asset.type; });
}

var CASES = [
  { id:'C1', cls:'negation (pre-cue)',     text:'no corrosion on the pipe support',                                   expect:[] },
  { id:'C2', cls:'negation (post-cue)',    text:'fixed support base inspected; corrosion ruled out after UT',         expect:[] },
  { id:'C3', cls:'attribution',            text:'the pipe is corroded but the pipe support is fine',                  expect:[] },
  { id:'C4', cls:'attribution (positive)', text:'the pipe wall is acceptable but the fixed support is badly corroded', expect:['fixed_support'] },
  { id:'C5', cls:'temporal resolution',    text:'the pipe support was corroded last year but has since been replaced', expect:[] },
  { id:'C6', cls:'actor-class precision',  text:'the guide shows active corrosion and section loss',                  expect:['guide'] },
  { id:'C7', cls:'hedge',                  text:'possible corrosion forming on the spring hanger',                    expect:['spring_hanger'] },
  { id:'C8', cls:'clean positive control', text:'severe corrosion and section loss at the fixed support base, water pooling', expect:['fixed_support'] }
];

// ---- naive keyword foil (no negation, no attribution, no temporal, coarse actors) ----
var COND = ['corrosion','corroded','section loss','pitting','wall loss','degrad'];
var NACT = [['support','fixed_support'],['guide','fixed_support'],['anchor','fixed_support'],['hanger','spring_hanger']];
function naiveEmit(text){ var t=text.toLowerCase(),hc=false,i; for(i=0;i<COND.length;i++){if(t.indexOf(COND[i])>=0)hc=true;} if(!hc)return[]; var o={}; for(i=0;i<NACT.length;i++){if(t.indexOf(NACT[i][0])>=0)o[NACT[i][1]]=true;} return Object.keys(o); }

function eq(a,b){a=a.slice().sort();b=b.slice().sort();return JSON.stringify(a)===JSON.stringify(b);}
function pad(s,n){s=String(s);while(s.length<n){s=s+' ';}return s;}

var pass=0, foilCaught=0, foilTrap=0;
for (var i=0;i<CASES.length;i++){
  var c=CASES[i], got=realEmit(c.text), ok=eq(got,c.expect);
  if(ok)pass++;
  console.log('  '+(ok?'PASS ':'FAIL ')+pad(c.id,4)+pad(c.cls,24)+'got['+got.join(',')+'] expect['+c.expect.join(',')+']');
  if(!ok)console.log('        (real extractor disagrees with the independent label)');
  // trap classes the foil should get wrong: C1,C2,C3,C5,C6
  if(['C1','C2','C3','C5','C6'].indexOf(c.id)>=0){ foilTrap++; if(!eq(naiveEmit(c.text),c.expect)) foilCaught++; }
}
console.log('\n'+pass+' / '+CASES.length+' independent-corpus cases passed');
console.log('naive foil failed '+foilCaught+' / '+foilTrap+' trap classes (foil MUST fail these)');
if (pass!==CASES.length || foilCaught!==foilTrap) { process.exitCode = 1; }
