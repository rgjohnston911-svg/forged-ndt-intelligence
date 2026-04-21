// FORGED NDT INTELLIGENCE OS - SYSTEM STRUCTURE/PROCESS TEST v1
// Paste this into your browser console at 4dndt.netlify.app
// Tests all 8 deployed functions for function and contract alignment

var BASE = "/.netlify/functions/";
var results = [];
var totalTests = 0;
var passed = 0;
var failed = 0;

function runTest(name, endpoint, payload, validator) {
  totalTests++;
  return fetch(BASE + endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json().then(function(b) { return {status: r.status, body: b}; }); })
  .then(function(res) {
    var result = validator(res.body);
    var icon = result.pass ? "PASS" : "FAIL";
    if (result.pass) passed++; else failed++;
    results.push({test: name, status: res.status, result: icon, details: result.details});
    console.log("[" + icon + "] " + name + " -- " + result.details);
    return res.body;
  })
  .catch(function(e) {
    failed++;
    results.push({test: name, status: 0, result: "ERROR", details: String(e)});
    console.log("[ERROR] " + name + " -- " + String(e));
    return null;
  });
}

console.log("=".repeat(60));
console.log("FORGED NDT SYSTEM TEST - " + new Date().toISOString());
console.log("=".repeat(60));

// T1: DOMAIN REFUSAL
runTest("T1: Domain Refusal (nuclear)", "decision-core", {
  transcript: "PWR pressurizer surge line. Alloy 600 with Alloy 82/182 DMW. PWSCC suspected. 653F, 2235 psig. NRC 10 CFR 50 Appendix B.",
  asset: {asset_class: "nuclear_vessel"},
  parsed: {events: [], numeric_values: {}},
  confirmed_flags: {}
}, function(b) {
  var dc = b.decision_core || b;
  var dns = dc.domain_not_supported === true;
  var ver = dc.engine_version || "?";
  return {pass: dns && ver.indexOf("v2.9.1") !== -1, details: "domain_not_supported=" + dns + " version=" + ver};
})

// T2: CONSEQUENCE UNDETERMINED (DEPLOY180)
.then(function() {
  return runTest("T2: Consequence Undetermined (DEPLOY180)", "decision-core", {
    transcript: "6-inch carbon steel piping in hydroprocessing unit. General wall thinning on elbow. Operating at 450 psig. Stored pressure energy. No personnel info, no environmental classification.",
    asset: {asset_class: "piping"},
    parsed: {events: ["wall_thinning"], numeric_values: {wall_thickness_mm: 7.11, current_thickness_mm: 4.2, operating_pressure_psi: 450, outside_diameter_mm: 168.3}},
    confirmed_flags: {critical_wall_loss_confirmed: true}
  }, function(b) {
    var dc = b.decision_core || b;
    var cons = dc.consequence_reality || {};
    var tier = cons.consequence_tier || "?";
    var und = cons.consequence_undetermined;
    var impacts = cons.undetermined_impacts || [];
    return {pass: tier === "HIGH" || tier === "CRITICAL", details: "tier=" + tier + " undetermined=" + und + " impacts=" + JSON.stringify(impacts)};
  });
})

// T3: NPS WALL INFERENCE (DEPLOY181)
.then(function() {
  return runTest("T3: NPS Wall Inference (DEPLOY181)", "decision-core", {
    transcript: "8-inch schedule 40 carbon steel piping in crude unit overhead. Wall thinning at elbow. 150 psig, 400 degrees F. Light hydrocarbon service.",
    asset: {asset_class: "piping"},
    parsed: {events: ["wall_thinning"], numeric_values: {operating_pressure_psi: 150, operating_temp_f: 400}},
    confirmed_flags: {}
  }, function(b) {
    var dc = b.decision_core || b;
    var nps = (dc.physical_reality || {}).nps_inference || {};
    var dq = ((dc.physics_computations || {}).data_quality || {});
    var wallOK = nps.nominal_wall_mm === 8.18;
    var npsOK = nps.nps_inch === 8;
    return {pass: npsOK && wallOK, details: "nps=" + nps.nps_inch + " sch=" + nps.schedule + " wall=" + nps.nominal_wall_mm + "mm source=" + nps.wall_source + " dq=" + dq.wall_thickness_source};
  });
})

// T4: CATALOG MECHANISM (sulfidation)
.then(function() {
  return runTest("T4: Catalog Mechanism (sulfidation)", "decision-core", {
    transcript: "Carbon steel piping in high temperature sulfur service. 700 degrees F. Sulfur content 2 percent. Broad wall thinning at elbows. 15 years service. API 939-C rates apply.",
    asset: {asset_class: "piping"},
    parsed: {events: ["wall_thinning", "sulfur_service"], numeric_values: {operating_temp_f: 700, wall_thickness_mm: 9.5, current_thickness_mm: 6.2, corrosion_rate_mm_per_year: 0.5}},
    confirmed_flags: {}
  }, function(b) {
    var dc = b.decision_core || b;
    var dmg = dc.damage_reality || {};
    var pri = dmg.primary_mechanism || {};
    var vals = dmg.validated_mechanisms || [];
    var ids = vals.map(function(v) { return v.id; });
    var hasSulf = ids.indexOf("sulfidation") !== -1;
    return {pass: hasSulf, details: "primary=" + pri.name + " validated_ids=" + ids.slice(0,6).join(",") + " sulfidation=" + hasSulf};
  });
})

// T5: FMD CATALOG FAMILY MAP
.then(function() {
  return runTest("T5: FMD Catalog Family Map", "failure-mode-dominance", {
    damage_mechanisms: ["sulfidation", "creep", "fire_damage", "cscc", "overload_buckling"],
    transcript: "High temperature carbon steel piping in sulfur service.",
    asset_class: "piping",
    operating_pressure: 200
  }, function(b) {
    var mc = b.mechanism_count || {};
    var other = mc.other || -1;
    var ver = (b.metadata || {}).version || "?";
    return {pass: other === 0 && ver === "1.4.0", details: "corr=" + mc.corrosion + " crack=" + mc.cracking + " struct=" + mc.structural + " other=" + other + " ver=" + ver};
  });
})

// T6: DISPOSITION CONSEQUENCE UNDETERMINED GATE
.then(function() {
  return runTest("T6: Disposition Consequence Undetermined Gate", "disposition-pathway", {
    consequence_tier: "HIGH",
    consequence_undetermined: true,
    undetermined_impacts: ["human_impact", "environmental_impact"],
    reality_state: "KNOWN",
    safe_envelope: "WITHIN",
    primary_mechanism: "general_corrosion",
    damage_mechanisms: ["general_corrosion"],
    transcript: "6-inch carbon steel piping. General thinning.",
    validated_mechanisms: [{id: "general_corrosion", name: "General Corrosion"}],
    indeterminate_mechanisms: []
  }, function(b) {
    var disp = b.disposition || "?";
    var gate = (b.enforcement_metadata || {}).gate || "?";
    var ver = (b.metadata || {}).version || "?";
    return {pass: disp === "HOLD_FOR_INPUT_ENFORCEMENT" && gate === "consequence_undetermined", details: "disposition=" + disp + " gate=" + gate + " ver=" + ver};
  });
})

// T7: DOWNSTREAM REFUSAL SHORT-CIRCUITS
.then(function() {
  var downstream = ["reality-challenge", "unknown-state", "failure-timeline", "superbrain-synthesis", "case-audit-report"];
  var chain = Promise.resolve();
  downstream.forEach(function(fn) {
    chain = chain.then(function() {
      return runTest("T7: " + fn + " refusal", fn, {
        domain_not_supported: true,
        decision_core: {domain_not_supported: true},
        decision_core_result: {domain_not_supported: true},
        transcript: "Nuclear vessel test"
      }, function(b) {
        var dns = b.domain_not_supported === true || b.reality_state === "DOMAIN_NOT_SUPPORTED" || (b.governing_failure_mode === "DOMAIN_NOT_SUPPORTED");
        return {pass: dns, details: "refusal_detected=" + dns};
      });
    });
  });
  return chain;
})

// T8: FULL PIPELINE (refinery)
.then(function() {
  return runTest("T8: Full Pipeline (refinery piping)", "decision-core", {
    transcript: "We are inspecting a 10-inch schedule 40 carbon steel pipe in the crude unit atmospheric tower overhead. Operating at 350 degrees F, 75 psig. Service is light hydrocarbon with trace H2S. Wall thinning detected at 3 o clock position on the first elbow downstream of the tower. UT readings show minimum wall of 5.8 mm. Last inspection 4 years ago showed 7.2 mm. Corrosion rate about 0.35 mm per year. No cracking. No leaks. Pipe rack, personnel walkway below.",
    asset: {asset_class: "piping"},
    parsed: {events: ["wall_thinning", "ut_measurement", "elbow"], numeric_values: {operating_pressure_psi: 75, operating_temp_f: 350, current_thickness_mm: 5.8, corrosion_rate_mm_per_year: 0.35}},
    confirmed_flags: {}
  }, function(b) {
    var dc = b.decision_core || b;
    var ver = dc.engine_version || "?";
    var nps = (dc.physical_reality || {}).nps_inference || {};
    var pri = ((dc.damage_reality || {}).primary_mechanism || {}).name || "?";
    var tier = (dc.consequence_reality || {}).consequence_tier || "?";
    var disp = (dc.decision_reality || {}).disposition || "?";
    var ms = dc.elapsed_ms || "?";
    return {pass: ver.indexOf("v2.9.1") !== -1, details: "ver=" + ver + " nps=" + nps.nps_inch + "/sch" + nps.schedule + "/wall=" + nps.nominal_wall_mm + " primary=" + pri + " tier=" + tier + " disp=" + disp + " " + ms + "ms"};
  });
})

// SUMMARY
.then(function() {
  console.log("=".repeat(60));
  console.log("RESULTS: " + passed + " PASS / " + failed + " FAIL / " + totalTests + " TOTAL");
  console.log("=".repeat(60));
  if (failed > 0) {
    console.log("FAILURES:");
    results.forEach(function(r) { if (r.result !== "PASS") console.log("  " + r.test + ": " + r.details); });
  }
  console.table(results);
});
