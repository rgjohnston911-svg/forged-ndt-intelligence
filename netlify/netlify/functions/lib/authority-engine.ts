/**
 * DEPLOY21_authority-engine.ts
 * Deploy to: netlify/functions/lib/authority-engine.ts
 *
 * INSPECTION AUTHORITY LOCK ENGINE v1
 * Unbreakable final decision layer.
 *
 * CRITICAL: String concatenation only. No backtick template literals.
 */

interface MeasurementData {
  finding_type: string;
  measurement_key: string;
  value_imperial: number;
  value_metric: number;
}

interface RuleDefinition {
  id: string;
  rule_name: string;
  code_family: string;
  rule_class: string;
  finding_type: string;
  measurement_key: string | null;
  threshold_imperial: number | null;
  threshold_metric: number | null;
  operator: string;
  engineering_basis: string;
}

interface RuleEvaluation {
  rule_id: string;
  rule_name: string;
  code_family: string;
  rule_class: string;
  passed: boolean | null;
  measured_value_imperial: number | null;
  measured_value_metric: number | null;
  threshold_imperial: number | null;
  threshold_metric: number | null;
  explanation: string;
  engineering_basis: string;
  evidence_chain: string;
}

interface AuthorityDecision {
  locked: boolean;
  disposition: string;
  confidence: number;
  reason: string;
  what: string;
  why: string;
  how: string;
  evidence: AuthorityEvidence;
  evaluations: RuleEvaluation[];
  missing_measurements: MissingMeasurement[];
  measurement_count: number;
}

interface AuthorityEvidence {
  rules_evaluated: number;
  rules_passed: number;
  rules_failed: number;
  rules_na: number;
  hard_rejects: string[];
  threshold_failures: string[];
  measurements_provided: number;
  measurements_needed: number;
}

interface MissingMeasurement {
  finding_type: string;
  measurement_key: string;
  label: string;
  required_by: string[];
}

var AUTHORITY_RULES: RuleDefinition[] = [
  // === HARD REJECTS ===
  {
    id: "HR_CRACK_D11", rule_name: "AWS D1.1 - Cracks Not Permitted",
    code_family: "AWS_D1_1", rule_class: "hard_reject",
    finding_type: "crack", measurement_key: null,
    threshold_imperial: null, threshold_metric: null, operator: "exists",
    engineering_basis: "Cracks are unconditionally rejected because any crack represents a stress concentration that can propagate under service loading. Crack tips concentrate stress by factors of 10-100x. A sharp-tipped discontinuity creates theoretical infinite stress at the tip in linear elastic fracture mechanics."
  },
  {
    id: "HR_CRACK_A8", rule_name: "ASME VIII - Cracks Not Permitted",
    code_family: "ASME_VIII", rule_class: "hard_reject",
    finding_type: "crack", measurement_key: null,
    threshold_imperial: null, threshold_metric: null, operator: "exists",
    engineering_basis: "Pressure vessels contain stored energy (PV = nRT for gases). A crack in a pressure boundary can propagate rapidly under internal pressure. The stored energy released in vessel rupture is catastrophic. Biaxial stress state makes crack propagation more aggressive than uniaxial."
  },
  {
    id: "HR_CRACK_API", rule_name: "API 1104 - Cracks Not Permitted",
    code_family: "API_1104", rule_class: "hard_reject",
    finding_type: "crack", measurement_key: null,
    threshold_imperial: null, threshold_metric: null, operator: "exists",
    engineering_basis: "Pipeline welds operate under internal pressure plus external loads. Consequences of failure include environmental contamination, fire/explosion, and public safety. A circumferential crack under hoop stress has the highest driving force for propagation."
  },
  {
    id: "HR_IP_A8", rule_name: "ASME VIII - Incomplete Penetration",
    code_family: "ASME_VIII", rule_class: "hard_reject",
    finding_type: "incomplete_penetration", measurement_key: null,
    threshold_imperial: null, threshold_metric: null, operator: "exists",
    engineering_basis: "Incomplete joint penetration reduces effective throat below design requirement. In pressure containment the weld must carry full hoop and longitudinal stress. Any reduction proportionally reduces the pressure rating. The root creates a crevice that traps corrosive media."
  },
  {
    id: "HR_IF_D11", rule_name: "AWS D1.1 - Incomplete Fusion Not Permitted",
    code_family: "AWS_D1_1", rule_class: "hard_reject",
    finding_type: "incomplete_fusion", measurement_key: null,
    threshold_imperial: null, threshold_metric: null, operator: "exists",
    engineering_basis: "Incomplete fusion creates an unbonded interface acting as a planar discontinuity. Planar discontinuities have essentially zero cross-section in the through-thickness direction. Under fatigue loading, the sharp edges of the unfused region act as crack initiation sites."
  },
  {
    id: "HR_OL_D11", rule_name: "AWS D1.1 - Overlap Not Permitted",
    code_family: "AWS_D1_1", rule_class: "hard_reject",
    finding_type: "overlap", measurement_key: null,
    threshold_imperial: null, threshold_metric: null, operator: "exists",
    engineering_basis: "Overlap creates a mechanical notch at the weld toe acting as a severe stress concentrator. The rolled-over weld metal is not fused to the base metal, creating a crack-like condition."
  },
  // === THRESHOLD RULES ===
  {
    id: "TH_UC_STATIC", rule_name: "AWS D1.1 - Undercut Static Loading",
    code_family: "AWS_D1_1", rule_class: "threshold",
    finding_type: "undercut", measurement_key: "depth",
    threshold_imperial: 0.03125, threshold_metric: 0.8, operator: "lte",
    engineering_basis: "For statically loaded structures the primary concern is cross-section reduction. The 1/32 in (0.8mm) limit represents the depth at which cross-section reduction begins to meaningfully affect static load capacity. At this depth in typical plate the section loss is less than 8%, within the safety factor."
  },
  {
    id: "TH_UC_DYNAMIC", rule_name: "AWS D1.1 - Undercut Dynamic/Cyclic",
    code_family: "AWS_D1_1", rule_class: "threshold",
    finding_type: "undercut", measurement_key: "depth",
    threshold_imperial: 0.01, threshold_metric: 0.25, operator: "lte",
    engineering_basis: "For dynamic or cyclic loading, undercut becomes a fatigue crack initiation site. The 0.01 in (0.25mm) limit is 3x stricter because the physics change fundamentally: the concern shifts from cross-section reduction to stress concentration and fatigue. Even shallow undercut creates a notch where stress concentrates and micro-cracks initiate."
  },
  {
    id: "TH_BT_API", rule_name: "API 1104 - Burn-Through Limit",
    code_family: "API_1104", rule_class: "threshold",
    finding_type: "burn_through", measurement_key: "diameter",
    threshold_imperial: 0.25, threshold_metric: 6.4, operator: "lte",
    engineering_basis: "Burn-through causes the weld pool to melt through the pipe wall. The 1/4 in (6.4mm) max applies because larger areas reduce wall thickness at the root, create geometric stress risers, and may trap slag. The root surface is inaccessible for repair after installation."
  },
  {
    id: "TH_REINF_D11", rule_name: "AWS D1.1 - Reinforcement Limit",
    code_family: "AWS_D1_1", rule_class: "threshold",
    finding_type: "reinforcement", measurement_key: "height",
    threshold_imperial: 0.125, threshold_metric: 3.0, operator: "lte",
    engineering_basis: "Excessive reinforcement creates stress concentration at the weld toe due to abrupt geometric transition. The 1/8 in (3mm) limit balances additional throat area against toe stress concentration."
  },
  {
    id: "TH_POR_D11", rule_name: "AWS D1.1 - Porosity Size Limit",
    code_family: "AWS_D1_1", rule_class: "threshold",
    finding_type: "porosity", measurement_key: "diameter",
    threshold_imperial: 0.09375, threshold_metric: 2.4, operator: "lte",
    engineering_basis: "The stress concentration factor for a spherical void is approximately 2.0 compared to theoretically infinite for a sharp crack. The 3/32 in limit represents the size at which rounded void stress concentration begins to affect structural performance."
  }
];

function evaluateAuthority(
  findingsArr: Array<{ finding_type: string; confidence: number; source: string }>,
  measurements: MeasurementData[]
): AuthorityDecision {
  var evaluations: RuleEvaluation[] = [];
  var hardRejects: string[] = [];
  var thresholdFailures: string[] = [];
  var missingMeasurements: MissingMeasurement[] = [];
  var rulesPassed = 0;
  var rulesFailed = 0;
  var rulesNA = 0;

  // Build measurement lookup
  var mLookup: Record<string, MeasurementData> = {};
  for (var m = 0; m < measurements.length; m++) {
    mLookup[measurements[m].finding_type + ":" + measurements[m].measurement_key] = measurements[m];
  }

  // Build finding confidence map
  var fConf: Record<string, number> = {};
  for (var f = 0; f < findingsArr.length; f++) {
    var ft = findingsArr[f].finding_type;
    if (!fConf[ft] || findingsArr[f].confidence > fConf[ft]) {
      fConf[ft] = findingsArr[f].confidence;
    }
  }

  for (var r = 0; r < AUTHORITY_RULES.length; r++) {
    var rule = AUTHORITY_RULES[r];
    var exists = fConf[rule.finding_type] !== undefined;
    var conf = fConf[rule.finding_type] || 0;

    // HARD REJECT
    if (rule.rule_class === "hard_reject") {
      if (exists && conf >= 0.5) {
        rulesFailed++;
        evaluations.push({
          rule_id: rule.id, rule_name: rule.rule_name,
          code_family: rule.code_family, rule_class: rule.rule_class,
          passed: false,
          measured_value_imperial: null, measured_value_metric: null,
          threshold_imperial: null, threshold_metric: null,
          explanation: rule.rule_name + ": " + rule.finding_type + " detected at " + Math.round(conf * 100) + "% confidence. Unconditional rejection.",
          engineering_basis: rule.engineering_basis,
          evidence_chain: "AI Detection (" + Math.round(conf * 100) + "%) -> Hard Gate -> REJECT"
        });
        hardRejects.push(rule.rule_name);
      } else {
        rulesNA++;
        evaluations.push({
          rule_id: rule.id, rule_name: rule.rule_name,
          code_family: rule.code_family, rule_class: rule.rule_class,
          passed: null,
          measured_value_imperial: null, measured_value_metric: null,
          threshold_imperial: null, threshold_metric: null,
          explanation: rule.finding_type + " not detected by AI analysis.",
          engineering_basis: rule.engineering_basis,
          evidence_chain: "No detection -> N/A"
        });
      }
      continue;
    }

    // THRESHOLD
    if (rule.rule_class === "threshold") {
      if (!exists) {
        rulesNA++;
        evaluations.push({
          rule_id: rule.id, rule_name: rule.rule_name,
          code_family: rule.code_family, rule_class: rule.rule_class,
          passed: null,
          measured_value_imperial: null, measured_value_metric: null,
          threshold_imperial: rule.threshold_imperial, threshold_metric: rule.threshold_metric,
          explanation: rule.finding_type + " not detected. Rule not applicable.",
          engineering_basis: rule.engineering_basis,
          evidence_chain: "No detection -> N/A"
        });
        continue;
      }

      var mKey = rule.finding_type + ":" + rule.measurement_key;
      var mData = mLookup[mKey];

      if (!mData) {
        rulesNA++;
        evaluations.push({
          rule_id: rule.id, rule_name: rule.rule_name,
          code_family: rule.code_family, rule_class: rule.rule_class,
          passed: null,
          measured_value_imperial: null, measured_value_metric: null,
          threshold_imperial: rule.threshold_imperial, threshold_metric: rule.threshold_metric,
          explanation: rule.finding_type + " detected but " + rule.measurement_key + " not measured. MEASUREMENT REQUIRED.",
          engineering_basis: rule.engineering_basis,
          evidence_chain: "AI Detection (" + Math.round(conf * 100) + "%) -> Missing Measurement -> CANNOT EVALUATE"
        });
        var alreadyTracked = false;
        for (var mm = 0; mm < missingMeasurements.length; mm++) {
          if (missingMeasurements[mm].finding_type === rule.finding_type && missingMeasurements[mm].measurement_key === (rule.measurement_key || "")) {
            missingMeasurements[mm].required_by.push(rule.rule_name);
            alreadyTracked = true;
            break;
          }
        }
        if (!alreadyTracked) {
          missingMeasurements.push({
            finding_type: rule.finding_type,
            measurement_key: rule.measurement_key || "",
            label: rule.finding_type.replace(/_/g, " ") + " " + (rule.measurement_key || ""),
            required_by: [rule.rule_name]
          });
        }
        continue;
      }

      // EVALUATE with actual measurement
      var valI = mData.value_imperial;
      var valM = mData.value_metric;
      var thrI = rule.threshold_imperial || 0;
      var thrM = rule.threshold_metric || 0;
      var passed = false;

      if (rule.operator === "lte") passed = valI <= thrI;
      else if (rule.operator === "lt") passed = valI < thrI;
      else if (rule.operator === "gte") passed = valI >= thrI;

      if (passed) {
        rulesPassed++;
        evaluations.push({
          rule_id: rule.id, rule_name: rule.rule_name,
          code_family: rule.code_family, rule_class: rule.rule_class,
          passed: true,
          measured_value_imperial: valI, measured_value_metric: valM,
          threshold_imperial: thrI, threshold_metric: thrM,
          explanation: rule.finding_type + " " + (rule.measurement_key || "") + " = " + valI.toFixed(4) + " in (" + valM.toFixed(2) + " mm). Limit: " + thrI.toFixed(4) + " in (" + thrM.toFixed(2) + " mm). WITHIN LIMIT.",
          engineering_basis: rule.engineering_basis,
          evidence_chain: "AI (" + Math.round(conf * 100) + "%) -> Measured " + valI.toFixed(4) + " in -> Limit " + thrI.toFixed(4) + " in -> PASS"
        });
      } else {
        rulesFailed++;
        evaluations.push({
          rule_id: rule.id, rule_name: rule.rule_name,
          code_family: rule.code_family, rule_class: rule.rule_class,
          passed: false,
          measured_value_imperial: valI, measured_value_metric: valM,
          threshold_imperial: thrI, threshold_metric: thrM,
          explanation: rule.finding_type + " " + (rule.measurement_key || "") + " = " + valI.toFixed(4) + " in (" + valM.toFixed(2) + " mm). EXCEEDS limit " + thrI.toFixed(4) + " in (" + thrM.toFixed(2) + " mm). REJECT.",
          engineering_basis: rule.engineering_basis,
          evidence_chain: "AI (" + Math.round(conf * 100) + "%) -> Measured " + valI.toFixed(4) + " in -> Limit " + thrI.toFixed(4) + " in -> FAIL -> REJECT"
        });
        thresholdFailures.push(rule.rule_name);
      }
    }
  }

  // === FINAL DECISION ===
  var disposition = "accept";
  var locked = false;
  var confidence = 0.85;
  var reason = "";
  var whatText = "";
  var whyText = "";
  var howText = "";

  if (hardRejects.length > 0) {
    disposition = "reject";
    locked = true;
    confidence = 0.98;
    reason = "Hard rejection: " + hardRejects.join(", ");
    whatText = "REJECT - Nonconforming condition detected. " + hardRejects[0] + ".";
    whyText = reason + ". " + evaluations[0].engineering_basis.substring(0, 300);
    howText = "Repair per governing procedure and code. Re-inspect after repair. Document defect location and type for repair procedure selection.";
  } else if (thresholdFailures.length > 0) {
    disposition = "reject";
    locked = true;
    confidence = 0.95;
    reason = "Threshold exceeded: " + thresholdFailures.join(", ");
    var failedEval = evaluations.filter(function(e) { return e.passed === false && e.rule_class === "threshold"; })[0];
    whatText = "REJECT - Measured value exceeds code limit. " + thresholdFailures[0] + ".";
    whyText = failedEval ? failedEval.explanation + " " + failedEval.engineering_basis.substring(0, 200) : reason;
    howText = "Repair to bring dimension within code limits. Re-measure and re-evaluate. Consider loading condition (static vs dynamic) as limits differ.";
  } else if (missingMeasurements.length > 0) {
    disposition = "review_required";
    locked = false;
    confidence = 0.60;
    var missingList = missingMeasurements.map(function(mm) { return mm.label; }).join(", ");
    reason = "Missing measurements: " + missingList;
    whatText = "REVIEW REQUIRED - AI detected conditions requiring measurement verification.";
    whyText = "Measurements needed: " + missingList + ". Without these the system cannot determine if findings exceed code limits.";
    howText = "Enter measurements in the Measurements panel, then re-run analysis to lock the decision.";
  } else {
    disposition = "accept";
    locked = true;
    confidence = 0.90;
    reason = "All applicable rules passed.";
    whatText = "ACCEPT - No nonconforming conditions detected. " + rulesPassed + " rules passed.";
    whyText = "AI analysis found no hard-rejectable conditions. All threshold measurements within code limits. This disposition is locked by deterministic rule evaluation.";
    howText = "Proceed per governing procedure. Archive inspection record with evidence trail.";
  }

  return {
    locked: locked,
    disposition: disposition,
    confidence: confidence,
    reason: reason,
    what: whatText,
    why: whyText,
    how: howText,
    evidence: {
      rules_evaluated: evaluations.length,
      rules_passed: rulesPassed,
      rules_failed: rulesFailed,
      rules_na: rulesNA,
      hard_rejects: hardRejects,
      threshold_failures: thresholdFailures,
      measurements_provided: measurements.length,
      measurements_needed: missingMeasurements.length
    },
    evaluations: evaluations,
    missing_measurements: missingMeasurements,
    measurement_count: measurements.length
  };
}

export { evaluateAuthority, AuthorityDecision, RuleEvaluation, MissingMeasurement, MeasurementData };
