// ============================================================================
// FORGED NDT INTELLIGENCE OS -- SYSTEM TEST v2.0
// DEPLOY182 (decision-core v2.9.2) + DEPLOY174+ (FMD v1.4.0) + DEPLOY180 (disposition v1.2)
// Paste into F12 console at https://4dndt.netlify.app
// ============================================================================

(function() {
  var BASE = "https://4dndt.netlify.app/.netlify/functions";
  var results = [];
  var pass = 0;
  var fail = 0;
  var total = 0;

  function post(fn, body) {
    return fetch(BASE + "/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json(); });
  }

  function record(name, passed, detail) {
    total++;
    if (passed) { pass++; console.log("[PASS] " + name + " -- " + detail); }
    else { fail++; console.log("[FAIL] " + name + " -- " + detail); }
    results.push({ name: name, passed: passed, detail: detail });
  }

  // Safe number accessor: treats 0 as valid, only defaults on undefined/null
  function num(val, fallback) {
    return (val !== undefined && val !== null) ? val : fallback;
  }

  // T1: Domain Refusal (nuclear)
  function T1() {
    return post("decision-core", {
      transcript: "Pressurized water reactor vessel with neutron embrittlement near beltline weld",
      parsed: { raw_text: "Pressurized water reactor vessel with neutron embrittlement near beltline weld", events: [], numeric_values: {} },
      asset: { asset_class: "nuclear_vessel" }
    }).then(function(d) {
      var dc = d.decision_core || d;
      var ver = dc.engine_version || "?";
      var refused = (dc.domain_refusal && dc.domain_refusal.refused === true) || false;
      record("T1: Domain Refusal (nuclear)", refused && ver.indexOf("v2.9.2") >= 0, "refused=" + refused + " ver=" + ver);
    }).catch(function(e) { record("T1: Domain Refusal (nuclear)", false, "ERROR: " + e.message); });
  }

  // T2: Consequence Undetermined (DEPLOY180)
  function T2() {
    return post("decision-core", {
      transcript: "8 inch carbon steel pipe in refinery crude unit. Heavy wall loss on elbow downstream of desalter. Thinning measured at multiple locations. Operating temperature 350 degrees F. High consequence area near personnel walkway.",
      parsed: {
        raw_text: "8 inch carbon steel pipe in refinery crude unit. Heavy wall loss on elbow downstream of desalter. Thinning measured at multiple locations. Operating temperature 350 degrees F. High consequence area near personnel walkway.",
        events: [{ type: "wall_loss", severity: "heavy" }],
        numeric_values: { wall_thickness_mm: 6.0, corrosion_rate_mm_per_year: 0.5, minimum_thickness_mm: 3.2, current_thickness_mm: 6.0, operating_pressure_psi: 150 }
      },
      asset: { asset_class: "piping" }
    }).then(function(d) {
      var dc = d.decision_core || d;
      var cr = dc.consequence_reality || {};
      var tier = cr.consequence_tier || "?";
      var undet = cr.consequence_undetermined;
      var impacts = cr.undetermined_impacts || [];
      record("T2: Consequence Undetermined (DEPLOY182)", typeof undet !== "undefined" && tier !== "?", "tier=" + tier + " undetermined=" + undet + " impacts=[" + impacts.join(",") + "]");
    }).catch(function(e) { record("T2: Consequence Undetermined (DEPLOY182)", false, "ERROR: " + e.message); });
  }

  // T3: NPS Wall Inference (DEPLOY182)
  function T3() {
    return post("decision-core", {
      transcript: "NPS 8 schedule 40 carbon steel piping in amine service. Wall loss observed on intrados of elbow. Corrosion under insulation suspected. Operating at 200 psi.",
      parsed: {
        raw_text: "NPS 8 schedule 40 carbon steel piping in amine service. Wall loss observed on intrados of elbow. Corrosion under insulation suspected. Operating at 200 psi.",
        events: [{ type: "wall_loss", severity: "moderate" }],
        numeric_values: { operating_pressure_psi: 200, corrosion_rate_mm_per_year: 0.3 }
      },
      asset: { asset_class: "piping" }
    }).then(function(d) {
      var dc = d.decision_core || d;
      var pr = dc.physical_reality || {};
      var nps = pr.nps_inference || {};
      var pc = dc.physics_computations || {};
      var dq = pc.data_quality || {};
      var npsVal = nps.nps_inch;
      var schVal = nps.schedule;
      var wallVal = nps.nominal_wall_mm;
      var src = nps.wall_source;
      var dqSrc = dq.wall_source;
      var passed = npsVal === 8 && schVal === "40" && wallVal === 8.18 && src === "INFERRED" && dqSrc === "INFERRED";
      record("T3: NPS Wall Inference (DEPLOY182)", passed, "nps=" + npsVal + " sch=" + schVal + " wall=" + wallVal + "mm source=" + src + " dq=" + dqSrc);
    }).catch(function(e) { record("T3: NPS Wall Inference (DEPLOY182)", false, "ERROR: " + e.message); });
  }

  // T4: Catalog Mechanism (sulfidation)
  function T4() {
    return post("decision-core", {
      transcript: "Carbon steel piping in crude unit overhead showing sulfidation wall loss. Operating temperature 550 degrees Fahrenheit. Naphthenic acid environment with high TAN crude. Measured wall thickness 5.2mm. Minimum required 3.0mm.",
      parsed: {
        raw_text: "Carbon steel piping in crude unit overhead showing sulfidation wall loss. Operating temperature 550 degrees Fahrenheit. Naphthenic acid environment with high TAN crude. Measured wall thickness 5.2mm. Minimum required 3.0mm.",
        events: [{ type: "wall_loss", severity: "moderate" }],
        numeric_values: { wall_thickness_mm: 5.2, minimum_thickness_mm: 3.0, corrosion_rate_mm_per_year: 0.4, operating_temperature_f: 550, current_thickness_mm: 5.2 }
      },
      asset: { asset_class: "piping" }
    }).then(function(d) {
      var dc = d.decision_core || d;
      var dm = dc.damage_reality || {};
      var primary = dm.primary_mechanism ? dm.primary_mechanism.id : "?";
      var validated = (dm.validated_mechanisms || []).map(function(v) { return v.id; });
      var hasSulf = validated.indexOf("sulfidation") >= 0;
      record("T4: Catalog Mechanism (sulfidation)", primary !== "?" && hasSulf, "primary=" + primary + " validated_ids=" + validated.join(",") + " sulfidation=" + hasSulf);
    }).catch(function(e) { record("T4: Catalog Mechanism (sulfidation)", false, "ERROR: " + e.message); });
  }

  // T5: FMD Catalog Family Map
  function T5() {
    return post("failure-mode-dominance", {
      mechanisms: ["general_corrosion", "pitting", "cui", "fatigue_cracking", "settlement"],
      transcript: "Refinery piping with general corrosion and pitting. CUI suspected. Fatigue crack at weld toe. Foundation settlement observed."
    }).then(function(d) {
      var mc = d.mechanism_count || {};
      var corr = num(mc.corrosion, -1);
      var crack = num(mc.cracking, -1);
      var struct = num(mc.structural, -1);
      var other = num(mc.other, -1);
      var ver = (d.metadata || {}).version || "?";
      var passed = corr === 3 && crack === 1 && struct === 1 && other === 0;
      record("T5: FMD Catalog Family Map", passed, "corr=" + corr + " crack=" + crack + " struct=" + struct + " other=" + other + " ver=" + ver);
    }).catch(function(e) { record("T5: FMD Catalog Family Map", false, "ERROR: " + e.message); });
  }

  // T6: Disposition Consequence Undetermined Gate
  function T6() {
    return post("disposition-pathway", {
      consequence_tier: "HIGH",
      primary_mechanism: { id: "general_corrosion", name: "General Corrosion" },
      confidence_band: "MODERATE",
      confidence_overall: 0.65,
      consequence_undetermined: true,
      undetermined_impacts: ["human_impact", "environmental_impact"]
    }).then(function(d) {
      var disp = d.disposition || "?";
      var gate = (d.enforcement_metadata || {}).gate || "?";
      var ver = (d.metadata || {}).version || "?";
      var passed = disp === "HOLD_FOR_INPUT_ENFORCEMENT" && gate === "consequence_undetermined";
      record("T6: Disposition Consequence Undetermined Gate", passed, "disposition=" + disp + " gate=" + gate + " ver=" + ver);
    }).catch(function(e) { record("T6: Disposition Consequence Undetermined Gate", false, "ERROR: " + e.message); });
  }

  // T7: Downstream refusal short-circuits (5 functions)
  function T7() {
    var downstreamFns = [
      { fn: "reality-challenge", name: "reality-challenge" },
      { fn: "unknown-state", name: "unknown-state" },
      { fn: "failure-timeline", name: "failure-timeline" },
      { fn: "superbrain-synthesis", name: "superbrain-synthesis" },
      { fn: "case-audit-report", name: "case-audit-report" }
    ];
    var refusalPayload = {
      decision_core: {
        domain_refusal: { refused: true, domain: "nuclear_vessel", reason: "test" }
      }
    };
    var promises = downstreamFns.map(function(item) {
      return post(item.fn, refusalPayload).then(function(d) {
        var refused = (d.refused === true || d.refusal_detected === true || (d.result && d.result.refused === true));
        record("T7: " + item.name + " refusal", refused, "refusal_detected=" + refused);
      }).catch(function(e) { record("T7: " + item.name + " refusal", false, "ERROR: " + e.message); });
    });
    return Promise.all(promises);
  }

  // T8: Full Pipeline Integration (refinery piping)
  function T8() {
    return post("decision-core", {
      transcript: "12 inch NPS schedule 80 carbon steel pipe in sour gas service. Hydrogen induced cracking detected at weld HAZ. Measured wall thickness 14.5mm against minimum 10.0mm. Operating pressure 450 psi. Temperature 180F. Corrosion rate 0.25mm per year.",
      parsed: {
        raw_text: "12 inch NPS schedule 80 carbon steel pipe in sour gas service. Hydrogen induced cracking detected at weld HAZ. Measured wall thickness 14.5mm against minimum 10.0mm. Operating pressure 450 psi. Temperature 180F. Corrosion rate 0.25mm per year.",
        events: [{ type: "crack", location: "weld HAZ" }, { type: "wall_loss" }],
        numeric_values: {
          wall_thickness_mm: 14.5, minimum_thickness_mm: 10.0, current_thickness_mm: 14.5,
          corrosion_rate_mm_per_year: 0.25, operating_pressure_psi: 450,
          flaw_depth_mm: 2.0, operating_temperature_f: 180
        }
      },
      asset: { asset_class: "piping" }
    }).then(function(d) {
      var dc = d.decision_core || d;
      var ver = dc.engine_version || "?";
      var nps = (dc.physical_reality || {}).nps_inference || {};
      var primary = ((dc.damage_reality || {}).primary_mechanism || {}).id || "?";
      var tier = (dc.consequence_reality || {}).consequence_tier || "?";
      var disp = (dc.decision_reality || {}).disposition || "?";
      var elapsed = dc.elapsed_ms || "?";
      // Wall already measured, so NPS source should be MEASURED
      var npsSource = nps.wall_source || "?";
      var passed = ver.indexOf("v2.9.2") >= 0 && primary !== "?" && tier !== "?" && disp !== "?";
      record("T8: Full Pipeline (refinery piping)", passed, "ver=" + ver + " nps=" + nps.nps_inch + "/" + nps.schedule + "/wall=" + npsSource + " primary=" + primary + " tier=" + tier + " disp=" + disp + " " + elapsed + "ms");
    }).catch(function(e) { record("T8: Full Pipeline (refinery piping)", false, "ERROR: " + e.message); });
  }

  // T9: NPS Wall Inference with MEASURED wall (should NOT override)
  function T9() {
    return post("decision-core", {
      transcript: "NPS 6 schedule 40 carbon steel piping. Wall thickness measured at 5.8mm.",
      parsed: {
        raw_text: "NPS 6 schedule 40 carbon steel piping. Wall thickness measured at 5.8mm.",
        events: [],
        numeric_values: { wall_thickness_mm: 5.8 }
      },
      asset: { asset_class: "piping" }
    }).then(function(d) {
      var dc = d.decision_core || d;
      var nps = (dc.physical_reality || {}).nps_inference || {};
      var dq = (dc.physics_computations || {}).data_quality || {};
      var passed = nps.wall_source === "MEASURED" && dq.wall_source === "MEASURED" && dq.wall_thickness_used_mm === 5.8;
      record("T9: NPS MEASURED wall priority", passed, "nps_source=" + nps.wall_source + " dq_source=" + dq.wall_source + " wall_used=" + dq.wall_thickness_used_mm);
    }).catch(function(e) { record("T9: NPS MEASURED wall priority", false, "ERROR: " + e.message); });
  }

  // Run all tests sequentially
  T1().then(T2).then(T3).then(T4).then(T5).then(T6).then(T7).then(T8).then(T9).then(function() {
    console.log("============================================================");
    console.log("RESULTS: " + pass + " PASS / " + fail + " FAIL / " + total + " TOTAL");
    console.log("============================================================");
    if (fail > 0) {
      console.log("FAILURES:");
      results.filter(function(r) { return !r.passed; }).forEach(function(r) {
        console.log(r.name + ": " + r.detail);
      });
    }
    console.log("");
    return results;
  });
})();
