// DEPLOY118 — evidence-provenance.ts v1.0
// Evidence Provenance + Measurement Reality Layer
// Classifies every evidence claim by source and trust weight
// Evaluates whether NDE methods used can actually answer the questions asked
// Runs BEFORE decision-core to enrich the input with provenance data
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

// ============================================================================
// PROVENANCE CLASSES — epistemic classification of evidence
// ============================================================================

var PROVENANCE_CLASSES: any = {
  "MEASURED": { weight: 1.0, label: "Measured by calibrated NDE", description: "Quantitative result from calibrated instrument (UT thickness, PAUT sizing, hardness value)" },
  "OBSERVED": { weight: 0.85, label: "Directly observed by inspector", description: "Visual confirmation of condition (rust, coating damage, deformation, leak staining)" },
  "REPORTED": { weight: 0.6, label: "Reported by operator/third party", description: "Verbal or written report not independently verified by inspector" },
  "INFERRED": { weight: 0.45, label: "Inferred from context", description: "Derived from service, unit type, or environmental context (amine unit implies H2S)" },
  "COMPUTED": { weight: 0.7, label: "Computed from other data", description: "Calculated from measured inputs (remaining life, growth rate, stress ratio)" },
  "UNVERIFIED": { weight: 0.25, label: "Unverified claim", description: "Statement without supporting evidence or method confirmation" },
  "CONTRADICTED": { weight: 0.05, label: "Contradicted by other evidence", description: "Claim that conflicts with stronger evidence from another source" }
};

// ============================================================================
// METHOD CAPABILITY MAP — what each NDE method can actually detect/measure
// ============================================================================

var METHOD_CAPABILITIES: any = {
  "UT": {
    can_measure: ["wall_thickness", "remaining_wall", "lamination_depth"],
    can_detect: ["wall_loss", "lamination", "large_subsurface_flaw"],
    cannot_reliably: ["tight_crack_in_weld", "surface_breaking_crack", "pitting_depth_individual", "crack_morphology"],
    limitations: ["Single point measurement — does not characterize extent without grid", "Cannot distinguish mechanism (corrosion vs erosion vs CUI)", "Coupling-dependent — rough/corroded surfaces reduce reliability"],
    pod_notes: "Good for wall loss >10% of nominal. Poor for cracks unless specifically configured for crack detection."
  },
  "PAUT": {
    can_measure: ["wall_thickness", "flaw_depth", "flaw_length", "crack_height", "remaining_ligament"],
    can_detect: ["wall_loss", "crack", "lack_of_fusion", "subsurface_flaw", "lamination"],
    cannot_reliably: ["very_tight_SCC", "branched_cracking_morphology", "surface_pitting_count"],
    limitations: ["Requires trained operator for crack sizing", "Geometry-dependent (elbows, branches reduce reliability)", "Cannot determine mechanism without morphology analysis"],
    pod_notes: "Superior to conventional UT for crack detection and sizing. Standard of practice for critical crack assessment."
  },
  "TOFD": {
    can_measure: ["crack_height", "crack_depth", "through_wall_extent"],
    can_detect: ["crack", "lack_of_fusion", "subsurface_flaw"],
    cannot_reliably: ["wall_thickness_general", "surface_pitting", "corrosion_mapping"],
    limitations: ["Dead zone near surfaces", "Requires parallel scan surface", "Best for planar flaws in welds"],
    pod_notes: "Excellent for crack depth sizing. Not a screening tool for general corrosion."
  },
  "MT": {
    can_measure: [],
    can_detect: ["surface_breaking_crack", "near_surface_crack", "lack_of_fusion_surface"],
    cannot_reliably: ["subsurface_flaw", "wall_thickness", "crack_depth", "internal_corrosion"],
    limitations: ["Surface access required", "Ferromagnetic materials only", "Surface condition affects sensitivity", "Cannot size crack depth"],
    pod_notes: "High sensitivity for surface-breaking cracks in ferromagnetic steel. Cannot detect subsurface flaws."
  },
  "PT": {
    can_measure: [],
    can_detect: ["surface_breaking_crack", "porosity_surface", "lack_of_fusion_surface"],
    cannot_reliably: ["subsurface_flaw", "wall_thickness", "crack_depth", "internal_damage"],
    limitations: ["Surface must be clean and accessible", "Cannot detect closed or subsurface cracks", "Temperature-sensitive", "Cannot size crack depth"],
    pod_notes: "Good for surface-breaking flaws in any material. Requires clean, dry surface."
  },
  "RT": {
    can_measure: ["wall_thickness_profile"],
    can_detect: ["volumetric_flaw", "porosity", "slag", "wall_loss_profile", "large_crack"],
    cannot_reliably: ["tight_planar_crack", "crack_depth_sizing", "surface_condition"],
    limitations: ["Radiation safety requirements", "Orientation-dependent for planar flaws", "Limited crack detection for tight/planar flaws", "Profile shot can miss tight cracks"],
    pod_notes: "Good for volumetric flaws and wall loss profiles. Poor for tight planar cracks unless oriented favorably."
  },
  "VT": {
    can_measure: [],
    can_detect: ["surface_corrosion", "coating_damage", "deformation", "leak_staining", "alignment_change", "weld_profile"],
    cannot_reliably: ["wall_thickness", "subsurface_flaw", "crack_depth", "crack_confirmation", "internal_damage"],
    limitations: ["Surface access and lighting required", "Cannot confirm subsurface conditions", "Inspector-dependent", "Cannot quantify wall loss"],
    pod_notes: "Essential screening method. Cannot confirm or size any subsurface condition."
  },
  "HARDNESS": {
    can_measure: ["surface_hardness"],
    can_detect: ["material_property_change", "heat_affected_zone_variation", "tempering_effect"],
    cannot_reliably: ["crack", "wall_thickness", "corrosion_rate", "flaw_sizing"],
    limitations: ["Surface preparation required", "Point measurement", "Does not detect flaws directly"],
    pod_notes: "Useful for material verification and post-fire/post-weld assessment. Not a flaw detection method."
  }
};

// ============================================================================
// EVIDENCE CLASSIFIER — assigns provenance to each evidence item
// ============================================================================

function classifyEvidenceProvenance(transcript: string, numericValues: any): any[] {
  var lt = transcript.toLowerCase();
  var evidence: any[] = [];

  // Helper: check if keyword appears and classify by context
  function addEvidence(claim: string, provenance: string, basis: string, confidence: number) {
    evidence.push({
      claim: claim,
      provenance: provenance,
      provenance_weight: PROVENANCE_CLASSES[provenance] ? PROVENANCE_CLASSES[provenance].weight : 0.25,
      basis: basis,
      confidence: confidence
    });
  }

  // --- MEASURED evidence (highest trust) ---
  if (numericValues) {
    if (numericValues.wall_loss_percent) {
      addEvidence("wall_loss_" + numericValues.wall_loss_percent + "_percent", "MEASURED", "Quantified wall loss percentage", 0.9);
    }
    if (numericValues.temperature_f || numericValues.temperature_c) {
      addEvidence("operating_temperature", "REPORTED", "Temperature stated in transcript", 0.7);
    }
    if (numericValues.pressure_psi || numericValues.pressure_bar) {
      addEvidence("operating_pressure", "REPORTED", "Pressure stated in transcript", 0.7);
    }
    if (numericValues.diameter_inches) {
      addEvidence("diameter_" + numericValues.diameter_inches + "_inches", "REPORTED", "Diameter stated in transcript", 0.7);
    }
    if (numericValues.service_years) {
      addEvidence("service_life_" + numericValues.service_years + "_years", "REPORTED", "Service years stated in transcript", 0.7);
    }
  }

  // --- MEASURED by NDE method ---
  var utMeasured = lt.indexOf("ultrasonic") !== -1 || lt.indexOf("ut ") !== -1 || lt.indexOf("ut grid") !== -1 || lt.indexOf("paut") !== -1 || lt.indexOf("thickness reading") !== -1;
  var mtPerformed = lt.indexOf("magnetic particle") !== -1 || lt.indexOf(" mt ") !== -1 || lt.indexOf("mag particle") !== -1 || lt.indexOf("yoke") !== -1;
  var ptPerformed = lt.indexOf("penetrant") !== -1 || lt.indexOf(" pt ") !== -1 || lt.indexOf("dye pen") !== -1;
  var rtPerformed = lt.indexOf("radiograph") !== -1 || lt.indexOf(" rt ") !== -1 || lt.indexOf("x-ray") !== -1;

  if (utMeasured && (lt.indexOf("wall loss") !== -1 || lt.indexOf("thinned") !== -1 || lt.indexOf("thinning") !== -1)) {
    addEvidence("wall_loss_measured_by_ut", "MEASURED", "UT measurement confirms wall loss", 0.95);
  }
  if (utMeasured && lt.indexOf("crack") !== -1) {
    // UT can detect but not reliably characterize tight cracks
    addEvidence("crack_indication_by_ut", "OBSERVED", "UT indication — may be crack or geometry artifact. UT alone cannot confirm crack morphology.", 0.5);
  }
  if (mtPerformed && lt.indexOf("crack") !== -1) {
    addEvidence("crack_by_mt", "MEASURED", "MT detected surface-breaking indication", 0.85);
  }
  if (ptPerformed && lt.indexOf("crack") !== -1) {
    addEvidence("crack_by_pt", "MEASURED", "PT detected surface-breaking indication", 0.85);
  }

  // --- OBSERVED evidence (inspector visual) ---
  if (lt.indexOf("rust") !== -1 || lt.indexOf("rust bleed") !== -1) {
    addEvidence("external_corrosion_visible", "OBSERVED", "Inspector observed rust/corrosion visually", 0.8);
  }
  if (lt.indexOf("coating") !== -1 && (lt.indexOf("damage") !== -1 || lt.indexOf("cooked") !== -1 || lt.indexOf("shot") !== -1 || lt.indexOf("failed") !== -1)) {
    addEvidence("coating_damage_visible", "OBSERVED", "Inspector observed coating damage", 0.8);
  }
  if (lt.indexOf("deform") !== -1 || lt.indexOf("buckl") !== -1 || lt.indexOf("wrinkle") !== -1 || lt.indexOf("dent") !== -1) {
    addEvidence("deformation_visible", "OBSERVED", "Inspector observed deformation", 0.75);
  }
  if (lt.indexOf("leak") !== -1 || lt.indexOf("staining") !== -1 || lt.indexOf("sweating") !== -1 || lt.indexOf("weeping") !== -1) {
    addEvidence("leak_indicator_visible", "OBSERVED", "Inspector observed leak staining or seepage", 0.7);
  }
  if (lt.indexOf("insulation") !== -1 && (lt.indexOf("wet") !== -1 || lt.indexOf("damaged") !== -1 || lt.indexOf("shot") !== -1)) {
    addEvidence("insulation_damage", "OBSERVED", "Inspector observed insulation damage — CUI risk", 0.8);
  }

  // --- REPORTED evidence (operator/third party) ---
  if (lt.indexOf("operator report") !== -1 || lt.indexOf("operators report") !== -1 || lt.indexOf("operator says") !== -1) {
    addEvidence("operator_report", "REPORTED", "Information from operator — not independently verified", 0.55);
  }
  if (lt.indexOf("vibration") !== -1 || lt.indexOf("shaking") !== -1 || lt.indexOf("chattering") !== -1) {
    addEvidence("vibration_reported", "REPORTED", "Vibration reported — not instrumentally confirmed", 0.5);
  }

  // --- INFERRED evidence (from context) ---
  if (lt.indexOf("amine") !== -1) {
    addEvidence("h2s_caustic_inferred", "INFERRED", "Amine service implies H2S + caustic environment", 0.45);
  }
  if (lt.indexOf("hydro") !== -1 && (lt.indexOf("crack") !== -1 || lt.indexOf("reactor") !== -1)) {
    addEvidence("hydrogen_environment_inferred", "INFERRED", "Hydroprocessing context implies hydrogen environment", 0.45);
  }
  if (lt.indexOf("sour") !== -1) {
    addEvidence("h2s_inferred_sour", "INFERRED", "Sour service implies H2S present", 0.5);
  }

  // --- SUSPECTED but not confirmed ---
  var hasSuspectedCrack = (lt.indexOf("crack") !== -1 || lt.indexOf("cracking") !== -1) && (lt.indexOf("suspected") !== -1 || lt.indexOf("possible") !== -1 || lt.indexOf("might be") !== -1 || lt.indexOf("could be") !== -1 || lt.indexOf("hard to tell") !== -1);
  if (hasSuspectedCrack) {
    addEvidence("crack_suspected", "UNVERIFIED", "Cracking mentioned with uncertainty qualifier — not confirmed by crack-specific NDE", 0.3);
  }

  return evidence;
}

// ============================================================================
// MEASUREMENT REALITY ENGINE — can the methods used answer the questions asked?
// ============================================================================

function evaluateMeasurementReality(methods: string[], findings: string[], transcript: string): any {
  var lt = transcript.toLowerCase();
  var assessments: any[] = [];
  var gaps: any[] = [];
  var overallAdequacy = "ADEQUATE";

  // What questions need answering based on findings?
  var questionsNeeded: any[] = [];

  var hasWallLoss = findings.indexOf("wall_loss") !== -1 || findings.indexOf("corrosion") !== -1 || findings.indexOf("pitting") !== -1;
  var hasCrack = findings.indexOf("crack") !== -1;
  var hasDeformation = findings.indexOf("deformation") !== -1;

  if (hasWallLoss) {
    questionsNeeded.push({ question: "What is the remaining wall thickness?", requires: ["wall_thickness_measurement"], critical: true });
    questionsNeeded.push({ question: "Is the wall loss localized or general?", requires: ["wall_thickness_grid_or_scan"], critical: false });
    questionsNeeded.push({ question: "What is the corrosion rate / growth rate?", requires: ["prior_measurement_comparison"], critical: false });
  }
  if (hasCrack) {
    questionsNeeded.push({ question: "Is there actually a crack present?", requires: ["crack_detection_method"], critical: true });
    questionsNeeded.push({ question: "What is the crack depth/height?", requires: ["crack_sizing_method"], critical: true });
    questionsNeeded.push({ question: "What is the crack morphology (branching, linear, stepwise)?", requires: ["crack_morphology_assessment"], critical: false });
  }
  if (hasDeformation) {
    questionsNeeded.push({ question: "What is the magnitude of deformation?", requires: ["dimensional_measurement"], critical: false });
  }

  // Evaluate each method against the questions
  for (var mi = 0; mi < methods.length; mi++) {
    var method = methods[mi];
    var cap = METHOD_CAPABILITIES[method];
    if (!cap) {
      assessments.push({ method: method, status: "UNKNOWN", notes: "Method not in capability database" });
      continue;
    }

    var canAnswer: string[] = [];
    var cannotAnswer: string[] = [];

    for (var qi = 0; qi < questionsNeeded.length; qi++) {
      var q = questionsNeeded[qi];
      var answered = false;

      for (var ri = 0; ri < q.requires.length; ri++) {
        var req = q.requires[ri];
        if (req === "wall_thickness_measurement" && cap.can_measure.indexOf("wall_thickness") !== -1) answered = true;
        if (req === "wall_thickness_grid_or_scan" && (cap.can_measure.indexOf("wall_thickness") !== -1 || cap.can_detect.indexOf("wall_loss") !== -1)) answered = true;
        if (req === "crack_detection_method" && cap.can_detect.indexOf("crack") !== -1) answered = true;
        if (req === "crack_detection_method" && cap.can_detect.indexOf("surface_breaking_crack") !== -1) answered = true;
        if (req === "crack_sizing_method" && (cap.can_measure.indexOf("crack_height") !== -1 || cap.can_measure.indexOf("flaw_depth") !== -1)) answered = true;
        if (req === "crack_morphology_assessment") answered = false; // No standard NDE method confirms morphology alone
        if (req === "dimensional_measurement") answered = true; // Any visual/measurement method
      }

      if (answered) canAnswer.push(q.question);
      else cannotAnswer.push(q.question);
    }

    assessments.push({
      method: method,
      status: cannotAnswer.length === 0 ? "ADEQUATE" : (canAnswer.length > 0 ? "PARTIAL" : "INSUFFICIENT"),
      can_answer: canAnswer,
      cannot_answer: cannotAnswer,
      limitations: cap.limitations,
      pod_notes: cap.pod_notes
    });
  }

  // Identify unanswered critical questions
  for (var cqi = 0; cqi < questionsNeeded.length; cqi++) {
    var cq = questionsNeeded[cqi];
    if (!cq.critical) continue;

    var anyMethodAnswers = false;
    for (var ami = 0; ami < assessments.length; ami++) {
      if (assessments[ami].can_answer && assessments[ami].can_answer.indexOf(cq.question) !== -1) {
        anyMethodAnswers = true;
        break;
      }
    }
    if (!anyMethodAnswers) {
      gaps.push({
        question: cq.question,
        severity: "critical",
        message: "No method in current inspection plan can answer: " + cq.question
      });
      overallAdequacy = "INSUFFICIENT";
    }
  }

  // Check for single-point UT warning
  if (hasWallLoss && methods.indexOf("UT") !== -1) {
    var hasGrid = lt.indexOf("grid") !== -1 || lt.indexOf("scan") !== -1 || lt.indexOf("survey") !== -1 || lt.indexOf("mapping") !== -1;
    if (!hasGrid) {
      gaps.push({
        question: "Is spot UT sufficient to characterize wall loss extent?",
        severity: "warning",
        message: "Single-point UT cannot characterize extent of wall loss. UT grid or scan mapping recommended for remaining thickness assessment."
      });
      if (overallAdequacy === "ADEQUATE") overallAdequacy = "PARTIAL";
    }
  }

  // Check for crack claim without crack-capable method
  if (hasCrack) {
    var hasCrackCapable = methods.indexOf("MT") !== -1 || methods.indexOf("PT") !== -1 || methods.indexOf("PAUT") !== -1 || methods.indexOf("TOFD") !== -1 || methods.indexOf("ACFM") !== -1 || methods.indexOf("ET") !== -1;
    if (!hasCrackCapable) {
      gaps.push({
        question: "Can the methods used actually confirm or rule out cracking?",
        severity: "critical",
        message: "Cracking is suspected but no crack-capable NDE method (MT/PT/PAUT/TOFD/ACFM) was performed. Crack existence is unresolved."
      });
      overallAdequacy = "INSUFFICIENT";
    }
  }

  return {
    measurement_reality_version: "1.0",
    methods_evaluated: methods,
    questions_needed: questionsNeeded,
    method_assessments: assessments,
    unanswered_gaps: gaps,
    overall_adequacy: overallAdequacy,
    data_sufficiency: {
      has_thickness_data: !!(hasWallLoss && methods.indexOf("UT") !== -1),
      has_crack_data: !!(hasCrack && (methods.indexOf("MT") !== -1 || methods.indexOf("PT") !== -1 || methods.indexOf("PAUT") !== -1)),
      has_grid_coverage: lt.indexOf("grid") !== -1 || lt.indexOf("scan") !== -1 || lt.indexOf("mapping") !== -1,
      single_point_only: hasWallLoss && methods.indexOf("UT") !== -1 && lt.indexOf("grid") === -1 && lt.indexOf("scan") === -1,
      prior_data_available: lt.indexOf("previous") !== -1 || lt.indexOf("prior") !== -1 || lt.indexOf("last inspection") !== -1 || lt.indexOf("history") !== -1
    }
  };
}

// ============================================================================
// PROVENANCE SUMMARY — aggregates provenance across all evidence
// ============================================================================

function summarizeProvenance(evidence: any[]): any {
  var counts: any = { MEASURED: 0, OBSERVED: 0, REPORTED: 0, INFERRED: 0, COMPUTED: 0, UNVERIFIED: 0, CONTRADICTED: 0 };
  var totalWeight = 0;
  var weightedSum = 0;

  for (var ei = 0; ei < evidence.length; ei++) {
    var e = evidence[ei];
    if (counts.hasOwnProperty(e.provenance)) counts[e.provenance]++;
    totalWeight++;
    weightedSum += e.provenance_weight * e.confidence;
  }

  var avgTrust = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  var dominantSource = "UNVERIFIED";
  var maxCount = 0;
  for (var key in counts) {
    if (counts[key] > maxCount) { maxCount = counts[key]; dominantSource = key; }
  }

  var trustBand = avgTrust >= 0.7 ? "HIGH" : avgTrust >= 0.5 ? "MODERATE" : avgTrust >= 0.3 ? "LOW" : "VERY_LOW";

  return {
    counts: counts,
    total_evidence_items: totalWeight,
    average_trust_weight: avgTrust,
    trust_band: trustBand,
    dominant_source: dominantSource,
    measured_fraction: totalWeight > 0 ? Math.round((counts.MEASURED / totalWeight) * 100) / 100 : 0,
    recommendation: avgTrust < 0.5 ? "Evidence base is primarily reported/inferred — additional measured data recommended before disposition." : null
  };
}

// ============================================================================
// NETLIFY HANDLER
// ============================================================================

var handler = async function(event: any): Promise<any> {
  var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var body = JSON.parse(event.body || "{}");
    var transcript = body.transcript || "";
    var numericValues = body.numeric_values || {};
    var methods = body.methods || [];
    var findings = body.findings || [];

    // Classify evidence provenance
    var evidence = classifyEvidenceProvenance(transcript, numericValues);
    var provenanceSummary = summarizeProvenance(evidence);

    // Evaluate measurement reality
    var measurementReality = evaluateMeasurementReality(methods, findings, transcript);

    return {
      statusCode: 200, headers: headers,
      body: JSON.stringify({
        ok: true,
        evidence_provenance_version: "1.0",
        evidence: evidence,
        provenance_summary: provenanceSummary,
        measurement_reality: measurementReality
      })
    };

  } catch (err: any) {
    return {
      statusCode: 500, headers: headers,
      body: JSON.stringify({ error: "evidence-provenance error", message: err.message || "Unknown" })
    };
  }
};

export { handler };
