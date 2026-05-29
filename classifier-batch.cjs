// Classifier batch v2 — hits live 4dndt.com decision-core with ~30 scenarios.
// Looks for asset_class in the correct response location:
//   decision_core.asset_correction.corrected_to (when corrected)
//   decisionPackage.asset.asset_class (canonical DecisionPackage)
//   decision_core.asset_class_received (refusal path)
// Also writes the first response's raw JSON to ./_probe-response.json for shape verification.
'use strict';
var https = require('https');
var fs = require('fs');

var ENDPOINT = process.env.FORGED_URL || 'https://4dndt.com/api/decision-core';

var SCENARIOS = [
  { id: 'PIPE-01', expected: 'piping', transcript: '6" Sch 40 carbon steel process piping, hydrocarbon liquid service, Gulf Coast refinery hydrotreater unit downstream of feed/effluent exchanger. Operating 285F at 425 psig. Material SA-106 Grade B. Code basis: API 570 / ASME B31.3 process piping. CML grid established. Wall loss 22% over 4" axial band. CUI suspected under insulation jacket.' },
  { id: 'PIPE-02', expected: 'piping', transcript: '8" carbon steel piping in FCC unit reactor effluent line. ASME B31.3 process piping. UT thickness readings on CML 4. SA-106-B material. Sour service per NACE MR0175.' },
  { id: 'PIPE-03', expected: 'piping', transcript: '4" Sch 80 piping in alkylation unit. API 570 inspection. Hydrofluoric acid service. Carbon steel base metal. Localized thinning at 3 o\'clock over a 6" axial extent.' },
  { id: 'PIPE-04', expected: 'piping', transcript: '12" crude unit overhead piping. ASME B31.3. Carbon steel. Stress corrosion at chloride condensation point. Inspection per API 570.' },
  { id: 'PIPE-05', expected: 'piping', transcript: '6" amine sweetening regenerator overhead piping. Sour service. Carbon steel SA-106-B. ASME B31.3.' },
  { id: 'PIPE-06', expected: 'piping', transcript: '10" sulfur recovery unit tail-gas line. ASME B31.3 process piping. Carbon steel. External insulation. CUI inspection campaign.' },
  { id: 'PIPE-07', expected: 'piping', transcript: '6" Sch 40 pipe carrying hydrocarbon liquid downstream of the feed/effluent exchanger in a refinery hydrotreater. API 570 governing.' },
  { id: 'PIPE-08', expected: 'piping', transcript: 'Process line, hydrocarbon vapor, 8 inch diameter, header upstream of compressor knockout. Carbon steel piping. ASME B31.3.' },
  { id: 'PLINE-01', expected: 'pipeline', transcript: '24" gas transmission pipeline, API 5L X65 grade, 1100 psi MAOP, ASME B31.8 gas transmission code. Coating disbondment over a 30 foot section. ILI run last year.' },
  { id: 'PLINE-02', expected: 'pipeline', transcript: '16" liquid hydrocarbon transmission pipeline, ASME B31.4. API 1160 integrity management. Sour crude service. External corrosion detected by ILI.' },
  { id: 'PLINE-03', expected: 'pipeline', transcript: '8" gathering pipeline, sweet gas, carbon steel API 5L. Buried in West Texas. CP system. External corrosion under coating disbondment.' },
  { id: 'PV-01', expected: 'pressure_vessel', transcript: 'Hydrotreater reactor vessel, 12 ft ID, 80 ft tan-tan, ASME Section VIII Div 2. 2.25Cr-1Mo material. Internal cladding 347 SS. High temperature hydrogen attack inspection per API 941.' },
  { id: 'PV-02', expected: 'pressure_vessel', transcript: 'Coker drum, ASME Section VIII Div 1. Carbon steel SA-516-70. 80 ft tall vessel. Thermal fatigue cracking at skirt-to-shell weld. API 510 governing.' },
  { id: 'PV-03', expected: 'pressure_vessel', transcript: 'Amine absorber column, ASME Section VIII Div 1, SA-516-70 shell with 410 SS clad. 6 ft ID, 60 ft tan-tan. API 510 inspection.' },
  { id: 'PV-04', expected: 'pressure_vessel', transcript: 'Knockout drum vessel, 4 ft ID, ASME Section VIII Div 1, carbon steel. Sour gas service. Internal corrosion at liquid interface.' },
  { id: 'HX-01', expected: 'heat_exchanger', transcript: 'Shell-and-tube heat exchanger, BEM design per TEMA. Shell side hydrocarbon vapor, tube side cooling water. Tube bundle U-tube. ASME Section VIII Div 1. Tube-to-tubesheet weld inspection.' },
  { id: 'HX-02', expected: 'heat_exchanger', transcript: 'Feed/effluent exchanger, vertical, BEU type. Shell side reactor effluent, tube side feed. Tube leak suspected at U-bend region.' },
  { id: 'TANK-01', expected: 'storage_tank', transcript: 'API 650 atmospheric storage tank, 150 ft diameter, crude oil service. Bottom plate edge settlement inspection per API 653.' },
  { id: 'TANK-02', expected: 'storage_tank', transcript: 'Low-pressure aboveground storage tank, API 620, anhydrous ammonia service. Shell course 1 thinning.' },
  { id: 'TANK-03', expected: 'storage_tank', transcript: '80 ft diameter aboveground storage tank, gasoline service, API 653 in-service inspection. Bottom corrosion and roof seal degradation.' },
  { id: 'BRIDGE-01', expected: 'bridge', transcript: 'Steel girder highway bridge, 4 spans, painted A572-50. Section loss at lower chord of through-truss near pier 2. AASHTO MBE governing.' },
  { id: 'BRIDGE-02', expected: 'rail_bridge', transcript: 'Steel rail bridge over highway. Through-truss span. Gusset plate corrosion at floor beam connection. Coal train traffic. AREMA governing.' },
  { id: 'BRIDGE-03', expected: 'bridge', transcript: 'Concrete deck reinforced concrete bridge, 3 spans, abutment scour observed. AASHTO LRFD.' },
  { id: 'OFF-01', expected: 'offshore_platform', transcript: 'Fixed offshore platform jacket leg, splash zone caisson, Gulf of Mexico. API RP 2A SIM. Marine growth and splash-zone corrosion. Riser clamp distortion.' },
  { id: 'OFF-PIPE-01', expected: 'piping', transcript: 'Topsides production piping on an offshore platform, 8" carbon steel, ASME B31.3, sour service. Production header upstream of separator. API 570 inspection.' },
  { id: 'BOIL-01', expected: 'boiler', transcript: 'Industrial water-tube boiler, steam drum, superheater tubes. ASME Section I governing. NBIC inspection. Tube wall thinning observed at fireside.' },
  { id: 'GEO-01', expected: 'piping', transcript: 'Gulf Coast refinery, 6" Sch 40 ASME B31.3 process piping. Carbon steel SA-106-B. Onshore unit.' },
  { id: 'GEO-02', expected: 'piping', transcript: 'North Sea topsides 6" carbon steel process piping ASME B31.3. Sour service. API 570 inspection.' },
  { id: 'EDGE-01', expected: 'piping', transcript: 'Process piping connected to feed surge drum. 6" carbon steel B31.3. The drum vessel itself is separate scope. Inspection is on the piping only.' },
  { id: 'EDGE-02', expected: 'pressure_vessel', transcript: 'Surge drum vessel, 6 ft ID, ASME Section VIII Div 1. Connected piping is separate scope. Internal corrosion at liquid level.' }
];

function postJson(url, payload) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify(payload);
    var u = new URL(url);
    var opts = { hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    var req = https.request(opts, function (res) {
      var chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch (e) { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, function () { req.destroy(new Error('timeout')); });
    req.write(body); req.end();
  });
}

// CORRECTED extractor: walk all known locations in the v2.12.2 response shape.
function extractAssetClass(resp) {
  if (!resp || typeof resp !== 'object') return null;
  var dc = resp.decision_core || resp;
  if (dc.domain_not_supported && dc.asset_class_received) return dc.asset_class_received;
  if (dc.asset_correction && dc.asset_correction.corrected && dc.asset_correction.corrected_to) {
    return dc.asset_correction.corrected_to;
  }
  if (dc.asset_correction && dc.asset_correction.corrected === false) {
    // No correction happened — the input class was the final class. We sent no asset, so default is "unknown".
    // The cascade may still have moved it though — check the assembled DecisionPackage if present.
    if (resp.decisionPackage && resp.decisionPackage.asset && resp.decisionPackage.asset.asset_class) {
      return resp.decisionPackage.asset.asset_class;
    }
    return 'unknown';
  }
  if (resp.decisionPackage && resp.decisionPackage.asset && resp.decisionPackage.asset.asset_class) {
    return resp.decisionPackage.asset.asset_class;
  }
  return null;
}
function extractAuthority(resp) {
  var dc = (resp && resp.decision_core) || resp || {};
  var ar = dc.authority_reality || {};
  if (ar.primary_authority) {
    if (typeof ar.primary_authority === 'string') return ar.primary_authority;
    return ar.primary_authority.code || ar.primary_authority.name || JSON.stringify(ar.primary_authority).slice(0, 40);
  }
  if (ar.authority_chain && ar.authority_chain.length) {
    var first = ar.authority_chain[0];
    return (typeof first === 'string') ? first : (first.code || first.name);
  }
  return null;
}
function extractDisposition(resp) {
  var dc = (resp && resp.decision_core) || resp || {};
  var dr = dc.decision_reality || {};
  return dr.disposition || null;
}

async function run() {
  console.log('Endpoint: ' + ENDPOINT);
  console.log('Scenarios: ' + SCENARIOS.length);
  console.log('');
  var rows = [];
  for (var i = 0; i < SCENARIOS.length; i++) {
    var s = SCENARIOS[i];
    var r;
    try { r = await postJson(ENDPOINT, { transcript: s.transcript }); }
    catch (e) {
      rows.push({ id: s.id, expected: s.expected, actual: 'ERR:' + e.message.slice(0, 40), authority: '-', disposition: '-' });
      process.stdout.write('x'); continue;
    }
    if (i === 0) {
      // Write first response to disk for shape verification
      try { fs.writeFileSync('_probe-response.json', JSON.stringify(r.data, null, 2)); } catch (_) { }
    }
    if (r.status !== 200 || typeof r.data === 'string') {
      rows.push({ id: s.id, expected: s.expected, actual: 'HTTP' + r.status, authority: '-', disposition: String(r.data).slice(0, 40) });
      process.stdout.write('?'); continue;
    }
    var actual = extractAssetClass(r.data) || 'null';
    var authority = extractAuthority(r.data) || '-';
    var disposition = extractDisposition(r.data) || '-';
    rows.push({ id: s.id, expected: s.expected, actual: actual, authority: authority, disposition: disposition });
    process.stdout.write(actual === s.expected ? '.' : '!');
  }
  console.log('\n');
  console.log('id'.padEnd(14) + 'expected'.padEnd(18) + 'actual'.padEnd(22) + 'authority'.padEnd(36) + 'disposition');
  console.log('-'.repeat(120));
  var pass = 0, fail = 0;
  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    var ok = (row.actual === row.expected);
    if (ok) pass++; else fail++;
    var mark = ok ? '+' : '!';
    console.log(mark + ' ' + row.id.padEnd(12) + row.expected.padEnd(18) + row.actual.padEnd(22) + String(row.authority).padEnd(36).slice(0, 36) + String(row.disposition).slice(0, 24));
  }
  console.log('-'.repeat(120));
  console.log('PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + rows.length);
  console.log('\nFirst response written to ./_probe-response.json for shape verification.');
}

run().catch(function (e) { console.error('FATAL: ' + e.message); process.exit(1); });
