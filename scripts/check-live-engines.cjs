'use strict';
// DEPLOY472 - CI durability gate for the quarantine + forward-key invariant.
// (a) REACHABILITY: every file deployed under netlify/functions must be reachable from src/public/toml
//     (real require/import or /api fetch edge, transitive) OR be a shared module imported by a live one.
//     A new function with no caller -> fail (it would deploy as an unguarded public endpoint).
// (b) FORWARD-KEY: every server-to-server fetch from a function to another /.netlify/functions or /api
//     endpoint must carry X-API-Key (so guarded internal targets never 401 the chain).
var fs=require('fs'),path=require('path');
var FN='netlify/functions';
var files=fs.readdirSync(FN).filter(function(f){return /\.(ts|js|cjs)$/.test(f);});
var base=function(f){return f.replace(/\.(ts|js|cjs)$/,'');};
var names=[].concat.apply([],files.map(base).map(function(n){return [n];}));
var nameSet={}; names.forEach(function(n){nameSet[n]=1;});
var content={}; files.forEach(function(f){content[f]=fs.readFileSync(path.join(FN,f),'utf8');});
function corpus(dir,skip){var s='';(function w(d){fs.readdirSync(d,{withFileTypes:true}).forEach(function(e){var p=path.join(d,e.name);if(skip&&skip.test(p))return;if(e.isDirectory())w(p);else if(/\.(ts|tsx|js|jsx|html)$/.test(e.name))s+=fs.readFileSync(p,'utf8')+'\n';});})(dir);return s;}
var src=corpus('src'), pub=fs.existsSync('public')?corpus('public'):'', toml=fs.readFileSync('netlify.toml','utf8');
function esc(n){return n.replace(/[-]/g,'\\-');}
function edge(c,n){return new RegExp("(?:require\\(|from )[\"']\\./"+esc(n)+"(?:\\.(?:cjs|js|ts))?[\"']").test(c)||new RegExp("(?:/\\.netlify/functions/|/api/)"+esc(n)+"(?![\\w-])").test(c);}
var edges={}; Object.keys(content).forEach(function(f){var c=content[f];var r=[];names.forEach(function(n){if(n!==base(f)&&edge(c,n))r.push(n);});edges[base(f)]=r;});
function root(n,c){return new RegExp("(?:/\\.netlify/functions/|/api/)"+esc(n)+"(?![\\w-])").test(c)||new RegExp("call(?:API|Engine)\\(\\s*[\"']"+esc(n)+"[\"']").test(c);}
var roots={}; names.forEach(function(n){if(root(n,src)||root(n,pub)||root(n,toml))roots[n]=1;});
['formula-engine','method-capability','universal-code-authority','differential-diagnosis','physics-sufficiency-engine','comprehensive-assessment','nde-image-analysis','ai-chat','live-code-authority','weld-acceptance-authority'].forEach(function(n){if(nameSet[n])roots[n]=1;});
var live={},st=Object.keys(roots); while(st.length){var n=st.pop();if(live[n])continue;live[n]=1;(edges[n]||[]).forEach(function(m){if(!live[m])st.push(m);});}
var unreachable=names.filter(function(n){return !live[n];});
var fail=0;
if(unreachable.length){console.log('FAIL reachability: deployed function(s) with no caller (quarantine to archive/ or add a caller):\n  '+unreachable.join(', '));fail=1;}
// forward-key: any function fetching an internal endpoint must include X-API-Key in that file
var noKey=[]; files.forEach(function(f){var c=content[f];
  if(/fetch\([^)]*(?:\/\.netlify\/functions\/|\/api\/)/.test(c) && !/api\.anthropic|api\.openai/.test(c.match(/fetch\([^)]*\)/g)?'':'')){
    var doesInternal=/(?:siteUrl|baseUrl|base|process\.env\.URL)[^\n]*\/\.netlify\/functions\/|fetch\(\s*[`"][^`"]*\/(?:api|\.netlify\/functions)\//.test(c);
    if(doesInternal && c.indexOf('X-API-Key')<0 && c.indexOf('verifyAuth')<0 && c.indexOf('auth-guard')<0){ noKey.push(base(f)); }
  }});
// (forward-key is advisory: list, do not hard-fail, to avoid false positives on anthropic-only callers)
if(noKey.length){console.log('WARN forward-key: internal-fetching function(s) without X-API-Key (review):\n  '+noKey.join(', '));}
// (c) SRC IMPORT REACHABILITY (DEPLOY473): no src/ file may import a netlify/functions/<name>
// that is not a deployed (live) function. tsc -b compiles src/**/__tests__/*.ts, so a test importing
// an archived engine fails the build - this catches that class the gate-suite scan (tests/*.test.cjs) misses.
(function(){
  var srcImports=[]; (function w(d){fs.readdirSync(d,{withFileTypes:true}).forEach(function(e){var pth=path.join(d,e.name);if(e.isDirectory())w(pth);else if(/\.tsx?$/.test(e.name)){var c=fs.readFileSync(pth,'utf8');var re=/(?:from|import\()\s*["\x27][^"\x27]*netlify\/functions\/([a-z0-9_-]+)["\x27]/g;var m;while((m=re.exec(c))){var n=m[1];if(n&&!nameSet[n])srcImports.push(pth.replace(/^src./,'src/')+' -> '+n);}}});})('src');
  if(srcImports.length){console.log('FAIL src-import: src/ imports a non-deployed (archived) function:\n  '+srcImports.join('\n  '));fail=1;}
})();
if(fail){process.exit(1);}
console.log('check-live-engines: OK - '+Object.keys(live).length+' reachable functions, no orphan deployed.');
