/**
 * DEPLOY13_truth_engine.ts
 * Netlify Function: truth-engine
 * Deploy to: netlify/functions/truth-engine.ts
 *
 * Deterministic Rule Enforcement - NO AI
 * Hard rules cannot be overridden by AI.
 * This is code-as-law.
 *
 * Produces: disposition + rule trace + WHAT/WHY/HOW
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var supabase = createClient(supabaseUrl, supabaseKey);

function getDeep(obj: any, path: string): any {
  var keys = path.split(".");
  var current = obj;
  for (var i = 0; i < keys.length; i++) {
    if (current == null) return undefined;
    current = current[keys[i]];
  }
  return current;
}

function compare(left: any, operator: string, right: any): boolean {
  if (operator === "eq") return left === right;
  if (operator === "neq") return left !== right;
  if (operator === "lt") return left < right;
  if (operator === "lte") return left <= right;
  if (operator === "gt") return left > right;
  if (operator === "gte") return left >= right;
  if (operator === "in") return Array.isArray(right) && right.indexOf(left) !== -1;
  if (operator === "includes") return Array.isArray(left) && left.indexOf(right) !== -1;
  return false;
}

export var handler: Handler = async function(event) {
  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;

    if (!caseId) {
      return { statusCode: 400, body: JSON.stringify({ error: "case_id required" }) };
    }

    // Fetch case
    var caseResult = await supabase.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseResult.error) throw caseResult.error;
    var inspectionCase = caseResult.data;

    // Fetch all findings
    var findingsResult = await supabase.from("findings").select("*").eq("case_id", caseId);
    var allFindings = findingsResult.data || [];

    // Fetch vision output
    var visionRunResult = await supabase.from("ai_runs").select("output_json")
      .eq("case_id", caseId).eq("run_type", "vision").order("created_at", { ascending: false }).limit(1).single();
    var visionOutput = visionRunResult.data ? visionRunResult.data.output_json : {};

    // Fetch reasoning output
    var reasoningRunResult = await supabase.from("ai_runs").select("output_json")
      .eq("case_id", caseId).eq("run_type", "reasoning").order("created_at", { ascending: false }).limit(1).single();
    var reasoningOutput = reasoningRunResult.data ? reasoningRunResult.data.output_json : {};

    // Fetch applicable rules
    var rulesResult = await supabase
      .from("rule_library")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (rulesResult.error) throw rulesResult.error;

    // Filter rules to matching method or ALL
    var applicableRules = (rulesResult.data || []).filter(function(r: any) {
      return r.method === inspectionCase.method || r.method === "ALL";
    });

    // Build context for rule evaluation
    var context: any = {};
    // Spread case data
    Object.keys(inspectionCase).forEach(function(key) {
      context[key] = inspectionCase[key];
    });
    // Add measurements from vision
    context.measurements = visionOutput.measurements || {};
    // Add observations
    context.observations = visionOutput.observations || [];
    // Add hypotheses from reasoning
    context.hypotheses = reasoningOutput.hypotheses || [];

    // Evaluate each rule
    var evaluations: any[] = [];
    var disposition = "accept";
    var finalReason = "No active rule violations detected.";
    var adjudicationRequired = false;
    var failedRules: any[] = [];

    for (var i = 0; i < applicableRules.length; i++) {
      var rule = applicableRules[i];
      var def = rule.rule_definition_json;
      var passed: boolean | null = null;

      // Check condition first (if rule has a condition)
      if (def.condition) {
        var condLeft = getDeep(context, def.condition.path);
        var conditionMet = compare(condLeft, def.condition.operator, def.condition.value);
        if (!conditionMet) {
          // Rule not applicable to this context
          passed = null;
        } else {
          var left = getDeep(context, def.path);
          if (left === undefined || left === null) {
            // Data not available for evaluation
            passed = null;
            if (rule.rule_class === "hard_reject" || rule.rule_class === "threshold") {
              adjudicationRequired = true;
            }
          } else {
            passed = compare(left, def.operator, def.value);
          }
        }
      } else {
        var leftVal = getDeep(context, def.path);
        if (leftVal === undefined || leftVal === null) {
          passed = null;
          if (rule.rule_class === "hard_reject") {
            adjudicationRequired = true;
          }
        } else {
          passed = compare(leftVal, def.operator, def.value);
        }
      }

      var explanation = "";
      if (passed === false) {
        explanation = rule.explanation_template;
      } else if (passed === true) {
        explanation = "Passed: " + rule.rule_name;
      } else {
        explanation = "Not applicable or data unavailable for: " + rule.rule_name;
      }

      var evalRecord = {
        case_id: caseId,
        rule_key: rule.rule_key,
        rule_name: rule.rule_name,
        method: rule.method,
        passed: passed,
        rule_class: rule.rule_class,
        input_snapshot_json: {
          evaluated_path: def.path,
          observed_value: def.path ? getDeep(context, def.path) : null,
          expected_value: def.value
        },
        output_snapshot_json: { passed: passed },
        explanation: explanation,
        engineering_basis_cited: rule.engineering_basis || null
      };

      evaluations.push(evalRecord);

      // Determine disposition based on rule failures
      if (passed === false && rule.rule_class === "hard_reject") {
        disposition = "reject";
        finalReason = explanation;
        failedRules.push(rule);
        break; // Hard reject stops evaluation
      }

      if (passed === false && rule.rule_class === "threshold" && disposition !== "reject") {
        disposition = "reject";
        finalReason = explanation;
        failedRules.push(rule);
      }

      if (passed === false && rule.rule_class === "physics_filter") {
        adjudicationRequired = true;
        if (disposition === "accept") {
          disposition = "review_required";
          finalReason = explanation;
        }
      }

      if (passed === null && rule.rule_class === "consistency") {
        adjudicationRequired = true;
      }
    }

    // Store rule evaluations
    if (evaluations.length > 0) {
      await supabase.from("rule_evaluations").insert(evaluations);
    }

    // Calculate confidence
    var confidence = 0.85;
    if (disposition === "reject") {
      confidence = 0.95;
    } else if (adjudicationRequired) {
      confidence = 0.65;
    } else if (disposition === "review_required") {
      confidence = 0.60;
    }

    // Build WHAT / WHY / HOW
    var whatText = "";
    var whyText = "";
    var howText = "";

    if (disposition === "reject") {
      whatText = "Nonconforming condition detected. " + (failedRules.length > 0 ? failedRules[0].rule_name : "");
      whyText = finalReason;
      if (failedRules.length > 0 && failedRules[0].engineering_basis) {
        whyText = whyText + " Engineering basis: " + failedRules[0].engineering_basis.substring(0, 200) + "...";
      }
      howText = "Repair per governing procedure and code. Re-inspect after repair using the same method and acceptance criteria. Escalate to adjudication if evidence is incomplete or disputed.";
    } else if (disposition === "review_required") {
      whatText = "Condition requires human review. Automated evaluation could not reach a definitive disposition.";
      whyText = finalReason;
      howText = "Submit to Level 3 inspector or engineer for adjudication. Provide all evidence and AI reasoning for review.";
    } else if (adjudicationRequired) {
      whatText = "Inspection passed available rules but some rules could not be evaluated due to missing data.";
      whyText = "One or more rules require measurement data that was not provided. " + finalReason;
      howText = "Provide missing measurements and re-run evaluation, or submit for adjudication.";
      disposition = "review_required";
    } else {
      whatText = "No nonconforming conditions detected by deterministic rule evaluation.";
      whyText = "All applicable rules passed. " + (reasoningOutput.summary || "");
      howText = "Proceed per procedure. Archive with full evidence trail. Schedule next inspection per applicable code.";
    }

    var truthOutput = {
      disposition: disposition,
      confidence: confidence,
      summary: whatText,
      rule_trace: evaluations.map(function(e: any) {
        return {
          rule_key: e.rule_key,
          rule_name: e.rule_name,
          passed: e.passed,
          explanation: e.explanation,
          rule_class: e.rule_class
        };
      }),
      final_reason: finalReason,
      adjudication_required: adjudicationRequired,
      what: whatText,
      why: whyText,
      how: howText,
      rules_evaluated: evaluations.length,
      rules_passed: evaluations.filter(function(e: any) { return e.passed === true; }).length,
      rules_failed: evaluations.filter(function(e: any) { return e.passed === false; }).length,
      rules_na: evaluations.filter(function(e: any) { return e.passed === null; }).length
    };

    // Update case with final decision
    await supabase
      .from("inspection_cases")
      .update({
        status: "truth_resolved",
        truth_engine_summary: truthOutput.what,
        final_disposition: truthOutput.disposition,
        final_decision_reason: truthOutput.why,
        final_confidence: truthOutput.confidence,
        adjudication_required: truthOutput.adjudication_required,
        adjudication_status: truthOutput.adjudication_required ? "pending" : "none",
        updated_at: new Date().toISOString()
      })
      .eq("id", caseId);

    // Log event
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: "truth_resolved",
      actor_id: null,
      event_json: {
        disposition: truthOutput.disposition,
        confidence: truthOutput.confidence,
        rules_evaluated: truthOutput.rules_evaluated,
        rules_failed: truthOutput.rules_failed
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(truthOutput)
    };

  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "truth-engine failed" })
    };
  }
};
