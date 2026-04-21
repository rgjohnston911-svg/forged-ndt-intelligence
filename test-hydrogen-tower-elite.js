// ============================================================================
// FORGED NDT INTELLIGENCE OS -- ELITE SCENARIO TEST
// "Leaning Hydrogen Retrofit Tower -- False Stability / Hidden Fracture Cascade"
// Gulf Coast refinery, post-hurricane, dual-engine stress test
// Paste into F12 console at https://4dndt.netlify.app
// ============================================================================

(function() {
  var BASE = "https://4dndt.netlify.app/.netlify/functions";

  // --------------------------------------------------------------------------
  // THE SCENARIO: Rich transcript combining field language + inspection data
  // --------------------------------------------------------------------------
  var transcript = "180-foot hydrogenation reactor tower at Gulf Coast refinery. "
    + "Reactor shell is 2.25Cr-1Mo steel in high-temperature hydrogen service at 850 degrees F and 2200 psi hydrogen partial pressure. "
    + "Tower was retrofit onto existing 1970s structural frame, original frame is A36 carbon steel. "
    + "Retrofit welds are mixed SMAW and FCAW from multiple contractors. "
    + "Anchor system is grouted anchor bolts into aging concrete pedestal. "
    + "Hurricane passed through 3 weeks ago. Post-hurricane restart conditions. "
    + "Tower is showing approximately 1.8 degrees lean off plumb. "
    + "Operators report low rumble during hydrogen circulation, breathing sensation at platform level, occasional pressure oscillations in feed line. "
    + "Field notes: That tower has got a little swagger to it now. Base plate looks like it walked a hair. "
    + "Welds are not popped but they look tired. You can feel it in your boots when she cycles. "
    + "Anchor bolts might be stretching or something. We patched a few spots after the storm, nothing major. "
    + "Visual testing: No obvious catastrophic weld failure. Slight distortion at skirt-to-base weld and platform support brackets. "
    + "Hairline indications at toe of several structural welds. "
    + "Ultrasonic testing on structural frame: Indications at multiple column-to-beam junctions showing 20 to 35 percent wall loss. "
    + "Signal instability and echo drift. UT tech note: readings are bouncing, metal does not feel clean, could be junk data or something weird in the grain. "
    + "Phased array UT on reactor shell: Clustered reflectors near weld seams, depth unclear. "
    + "Some resemble hydrogen-induced cracking HIC but morphology is inconsistent. "
    + "Magnetic particle testing: Linear indications at skirt welds and anchor bolt fillet welds. Orientation suggests fatigue not overload. "
    + "Concrete foundation: Micro-cracking radiating from anchor points. Slight pedestal rotation detected. "
    + "Structural engineer says load path has changed, tower is not transferring weight vertically anymore. "
    + "Eccentric loading introduced due to lean. Cyclic stress now present in anchor bolts, base welds, and structural frame connections. "
    + "Mechanical engineer says hydrogen service plus cyclic stress means possible early-stage HTHA or crack propagation. "
    + "Original structure was never designed for this load or dynamic condition. "
    + "Retrofit created stiffness mismatch and resonance amplification zone. "
    + "Competing mechanisms: fatigue from structural oscillation, hydrogen-induced cracking HIC, "
    + "high-temperature hydrogen attack HTHA, foundation rotation and load redistribution, resonance-driven amplification. "
    + "Fatigue cracks are typically clean and directional. HIC and HTHA are internal and pressure plus temperature driven. "
    + "UT signals show neither pattern clearly. "
    + "Wall thickness measured at 11.2 mm. Minimum required thickness 8.5 mm. Corrosion rate estimated 0.8 mm per year.";

  var payload = {
    transcript: transcript,
    parsed: {
      raw_text: transcript,
      events: [
        { type: "wall_loss", severity: "moderate" },
        { type: "cracking", severity: "heavy" },
        { type: "vibration", severity: "heavy" },
        { type: "hydrogen_damage", severity: "heavy" },
        { type: "fatigue", severity: "heavy" },
        { type: "foundation_damage", severity: "moderate" }
      ],
      numeric_values: {
        wall_thickness_mm: 11.2,
        minimum_thickness_mm: 8.5,
        corrosion_rate_mm_per_year: 0.8,
        operating_temperature_f: 850,
        operating_pressure_psi: 2200,
        hydrogen_partial_pressure_psi: 2200
      }
    },
    asset: { asset_class: "pressure_vessel" }
  };

  console.log("============================================================");
  console.log("ELITE SCENARIO: Leaning Hydrogen Retrofit Tower");
  console.log("Gulf Coast Refinery | Post-Hurricane | Dual-Engine Test");
  console.log("============================================================");
  console.log("");

  // --------------------------------------------------------------------------
  // ENGINE 1: Decision Core (deterministic physics)
  // --------------------------------------------------------------------------
  console.log("=== ENGINE 1: Decision Core ===");

  fetch(BASE + "/decision-core", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json(); })
  .then(function(dcResult) {
    var dc = dcResult.decision_core || dcResult;

    console.log("[ENGINE 1] " + (dc.engine_version || "unknown"));

    // Validated mechanisms
    var validated = (dc.damage_reality || {}).validated_mechanisms || [];
    var validatedIds = validated.map(function(v) { return v.id; });
    console.log("[ENGINE 1] Validated: " + validatedIds.join(", "));

    // Rejected
    var rejected = (dc.damage_reality || {}).rejected_mechanisms || [];
    console.log("[ENGINE 1] Rejected: " + rejected.length + " mechanisms");

    // Primary mechanism
    var primary = (dc.damage_reality || {}).primary_mechanism || {};
    console.log("[ENGINE 1] Primary: " + (primary.id || "none"));

    // Physical reality summary
    var pr = dc.physical_reality || {};
    var mat = pr.material || {};
    console.log("[ENGINE 1] Material: " + (mat.class || "?") + " (confidence: " + (mat.class_confidence || 0) + ")");

    var thermal = pr.thermal || {};
    console.log("[ENGINE 1] Thermal: temp=" + (thermal.operating_temp_f || "?") + "F creep=" + (thermal.creep_range || false) + " cycling=" + (thermal.thermal_cycling || false));

    // Process chemistry flags (DEPLOY194 fix)
    var procChem = pr.process_chemistry || {};
    console.log("[ENGINE 1] Process Chemistry: hydrogen=" + (procChem.hydrogen_present || false) + " h2s=" + (procChem.h2s_present || false) + " caustic=" + (procChem.caustic_present || false));

    // Consequence
    var cr = dc.consequence_reality || {};
    console.log("[ENGINE 1] Consequence: tier=" + (cr.consequence_tier || "?") + " undetermined=" + cr.consequence_undetermined);

    // Physics computations
    var pc = dc.physics_computations || {};
    if (pc.remaining_life_years !== undefined) {
      console.log("[ENGINE 1] Remaining life: " + pc.remaining_life_years + " yrs | Rate: " + pc.corrosion_rate_mm_yr + " mm/yr");
    }

    // Disposition
    console.log("[ENGINE 1] Disposition: " + (dc.disposition || "?"));

    console.log("");
    console.log("=== ENGINE 2: Inspection Intelligence (calling GPT-4o-mini... 10-20s) ===");

    // --------------------------------------------------------------------------
    // ENGINE 2: Inspection Intelligence (AI reasoning)
    // --------------------------------------------------------------------------
    return fetch(BASE + "/inspection-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision_core: dc,
        transcript: transcript,
        asset_description: "180-ft hydrogenation reactor tower, 2.25Cr-1Mo shell, retrofit on 1970s A36 frame, post-hurricane 1.8 degree lean, Gulf Coast refinery"
      })
    });
  })
  .then(function(r) { return r.json(); })
  .then(function(iiResult) {
    // Check for errors
    if (iiResult.error) {
      console.log("[ENGINE 2 ERROR] " + iiResult.error);
      if (iiResult.debug) console.log("[DEBUG] " + JSON.stringify(iiResult.debug));
      return;
    }

    var meta = iiResult.metadata || {};
    console.log("[META] inspection-intelligence v" + meta.version + " | " + meta.elapsed_ms + "ms");
    console.log("[META] Static: " + meta.static_validated_count + " validated | AI: " + meta.ai_suggested_count + " suggested, " + meta.ai_approved_count + " approved, " + meta.ai_vetoed_count + " vetoed");
    console.log("");

    // Domain classification
    var dom = iiResult.domain_classification || {};
    console.log("[DOMAIN] " + (dom.primary_domain || "?") + " / " + (dom.sub_domain || "?") + " (" + (dom.confidence || "?") + ")");
    if (dom.basis) console.log("[DOMAIN BASIS] " + dom.basis);
    console.log("");

    // Governing codes
    var codes = iiResult.governing_codes || [];
    console.log("[CODES] " + codes.length + " identified:");
    for (var c = 0; c < codes.length; c++) {
      var code = codes[c];
      console.log("  " + (code.primary ? "* " : "  ") + (code.code || "?") + " -- " + (code.scope || ""));
    }
    console.log("");

    // Static mechanisms
    var staticMechs = ((iiResult.mechanisms || {}).static_catalog || {}).validated || [];
    var staticIds = staticMechs.map(function(s) { return s.id; });
    console.log("[STATIC MECHANISMS] " + staticIds.join(", "));

    // AI extended mechanisms
    var aiApproved = ((iiResult.mechanisms || {}).ai_extended || {}).approved || [];
    var aiVetoed = ((iiResult.mechanisms || {}).ai_extended || {}).vetoed || [];
    console.log("[AI EXTENDED - APPROVED] " + aiApproved.length + " mechanisms:");
    for (var a = 0; a < aiApproved.length; a++) {
      var am = aiApproved[a];
      console.log("  + " + (am.id || am.name || "?") + " -- " + (am.physical_basis || "") + " (confidence: " + (am.confidence || "?") + ")");
    }
    if (aiVetoed.length > 0) {
      console.log("[AI EXTENDED - VETOED] " + aiVetoed.length + " mechanisms:");
      for (var v = 0; v < aiVetoed.length; v++) {
        var vm = aiVetoed[v];
        console.log("  X " + (vm.id || vm.name || "?") + " -- VETO: " + (vm.veto_reason || ""));
      }
    }
    console.log("");

    // Inspection plan
    var plan = iiResult.inspection_plan || {};
    var techniques = plan.techniques || [];
    console.log("[INSPECTION PLAN] " + techniques.length + " techniques:");
    for (var t = 0; t < techniques.length; t++) {
      var tech = techniques[t];
      console.log("  [" + (tech.priority || "?") + "] " + (tech.mechanism_id || "?") + " -> " + (tech.technique || "?") + " | " + (tech.code_basis || ""));
      if (tech.acceptance_criteria) console.log("    Acceptance: " + tech.acceptance_criteria);
    }
    console.log("");

    // Temporal projection
    var tp = iiResult.temporal_projection || {};
    console.log("[TEMPORAL] Life: " + (tp.remaining_life_estimate || "?") + " | Next inspection: " + (tp.next_inspection_due || "?") + " | Trajectory: " + (tp.degradation_trajectory || "?"));

    // Digital twin progression
    var fp = tp.failure_progression || {};
    console.log("[TWIN] Now: " + (fp.current_state || "?"));
    if (fp.six_months) console.log("[TWIN] 6mo: " + fp.six_months);
    if (fp.one_year) console.log("[TWIN] 1yr: " + fp.one_year);
    if (fp.three_years) console.log("[TWIN] 3yr: " + fp.three_years);
    if (fp.five_years) console.log("[TWIN] 5yr: " + fp.five_years);
    console.log("[TWIN] Failure mode: " + (fp.failure_mode || "?"));
    console.log("");

    // Intervention windows
    var iw = tp.intervention_windows || [];
    for (var w = 0; w < iw.length; w++) {
      var win = iw[w];
      console.log("[" + (win.urgency || "?") + "] " + (win.window || "?") + " -> " + (win.action || "?"));
      if (win.consequence_of_inaction) console.log("  IF NOT: " + win.consequence_of_inaction);
    }
    console.log("");

    // Data gaps
    var gaps = tp.data_gaps || [];
    if (gaps.length > 0) {
      console.log("[DATA GAPS] " + gaps.length + ":");
      for (var g = 0; g < gaps.length; g++) {
        console.log("  ? " + gaps[g]);
      }
      console.log("");
    }

    // Confidence
    var conf = iiResult.confidence_assessment || {};
    console.log("[CONFIDENCE] Overall: " + (conf.overall || "?"));
    var lims = conf.limitations || [];
    if (lims.length > 0) {
      console.log("[LIMITATIONS]");
      for (var l = 0; l < lims.length; l++) {
        console.log("  - " + lims[l]);
      }
    }
    console.log("");

    // Teaching insight
    if (iiResult.teaching_insight) {
      console.log("[TEACHING] " + iiResult.teaching_insight);
    }

    console.log("");
    console.log("=== ELITE SCENARIO TEST COMPLETE ===");
  })
  .catch(function(err) {
    console.log("[FATAL ERROR] " + err.message);
  });
})();
