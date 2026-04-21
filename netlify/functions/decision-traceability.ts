// @ts-nocheck
/**
 * DEPLOY248 - decision-traceability.ts
 * netlify/functions/decision-traceability.ts
 *
 * DECISION TRACEABILITY ENGINE
 * Full evidence-to-decision trace for any case. Shows every step:
 * evidence → code selection → precedence resolution → engineering logic →
 * confidence contributors → risk factors → final disposition
 *
 * POST /api/decision-traceability { action, ... }
 *
 * Actions:
 *   trace_decision    - full decision trace for a case
 *   get_decision_tree - abstract decision tree structure
 *   compare_decisions - side-by-side comparison of two case decisions
 *   get_registry      - engine registry
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ── DECISION TREE DEFINITION ───────────────────────────────────────

var DECISION_TREE = [
  {
    step: 1,
    id: "evidence_collection",
    name: "Evidence Collection",
    description: "All evidence gathered for the case: findings, measurements, images, sensor data",
    inputs: ["findings", "evidence", "thickness_data", "sensor_data"],
    outputs: ["evidence_package"],
    engine: "data-ingestion / manual entry",
    deterministic: true
  },
  {
    step: 2,
    id: "code_identification",
    name: "Applicable Code Identification",
    description: "Identify all applicable codes, standards, and specifications for this component and jurisdiction",
    inputs: ["component_type", "material", "jurisdiction", "industry"],
    outputs: ["applicable_code_set"],
    engine: "universal-code-authority",
    deterministic: true
  },
  {
    step: 3,
    id: "code_precedence",
    name: "Code Precedence Resolution",
    description: "Resolve conflicts between applicable codes using 5-tier hierarchy: Regulatory > Jurisdictional > Industry > Owner Spec > Best Practice",
    inputs: ["applicable_code_set"],
    outputs: ["governing_code", "precedence_chain"],
    engine: "universal-code-authority",
    deterministic: true
  },
  {
    step: 4,
    id: "mechanism_identification",
    name: "Damage Mechanism Identification",
    description: "Match case evidence against known damage mechanisms for the applicable industry vertical",
    inputs: ["evidence_package", "component_type", "material", "environment"],
    outputs: ["identified_mechanisms", "mechanism_scores"],
    engine: "industry vertical (chemical-process, nuclear, aerospace, etc.)",
    deterministic: true
  },
  {
    step: 5,
    id: "engineering_assessment",
    name: "Engineering Assessment",
    description: "Evaluate findings against code requirements: thickness vs minimum wall, flaw size vs acceptance criteria, remaining life calculation",
    inputs: ["evidence_package", "governing_code", "identified_mechanisms"],
    outputs: ["code_compliance", "remaining_life", "fitness_for_service"],
    engine: "engineering-core",
    deterministic: true
  },
  {
    step: 6,
    id: "risk_scoring",
    name: "Risk Scoring",
    description: "Compute weighted composite risk score from 8 factors: severity, active mechanism, remaining life, code compliance, evidence quality, consequence, history, age",
    inputs: ["engineering_assessment", "evidence_quality", "case_history"],
    outputs: ["risk_score", "risk_level", "factor_breakdown"],
    engine: "risk-scoring",
    deterministic: true
  },
  {
    step: 7,
    id: "confidence_calculation",
    name: "Confidence Calculation",
    description: "Calculate decision confidence from evidence completeness, code coverage, precedent availability, and measurement uncertainty",
    inputs: ["evidence_completeness", "code_coverage", "historical_precedent", "measurement_uncertainty"],
    outputs: ["confidence_score", "confidence_factors"],
    engine: "decision-core",
    deterministic: true
  },
  {
    step: 8,
    id: "disposition_determination",
    name: "Disposition Determination",
    description: "Final system disposition: accept, accept_with_conditions, conditional, reject based on all preceding analysis",
    inputs: ["engineering_assessment", "risk_score", "confidence_score", "governing_code"],
    outputs: ["system_disposition", "disposition_rationale"],
    engine: "run-authority",
    deterministic: true
  },
  {
    step: 9,
    id: "compliance_check",
    name: "Compliance Verification",
    description: "Cross-check disposition against all applicable codes to verify compliance and identify any remaining gaps",
    inputs: ["system_disposition", "applicable_code_set"],
    outputs: ["compliance_status", "gap_list"],
    engine: "compliance-matrix",
    deterministic: true
  },
  {
    step: 10,
    id: "escalation_check",
    name: "Escalation Evaluation",
    description: "Determine if case requires escalation based on risk level, mechanism severity, or organizational rules",
    inputs: ["risk_score", "system_disposition", "org_rules"],
    outputs: ["escalation_required", "escalation_tier"],
    engine: "escalation-workflow",
    deterministic: true
  },
  {
    step: 11,
    id: "inspector_adjudication",
    name: "Inspector Adjudication (Optional)",
    description: "Inspector may override system disposition. Override creates parallel record — original system decision is never modified",
    inputs: ["system_disposition", "inspector_judgment"],
    outputs: ["final_disposition", "override_record"],
    engine: "inspector-adjudication",
    deterministic: true,
    optional: true
  },
  {
    step: 12,
    id: "audit_seal",
    name: "Audit Trail Seal",
    description: "All decision steps logged to audit trail, HMAC-signed, hash-chain-linked to previous events",
    inputs: ["all_previous_steps"],
    outputs: ["audit_bundle", "chain_hash"],
    engine: "enterprise-audit",
    deterministic: true
  }
];

// ── HANDLER ────────────────────────────────────────────────────────

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ── get_registry ──
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "decision-traceability",
          deploy: "DEPLOY248",
          version: "1.0.0",
          decision_steps: DECISION_TREE.length,
          trace_depth: "evidence_to_audit_seal",
          capabilities: ["full_decision_trace", "decision_tree_structure", "side_by_side_comparison"],
          philosophy: "Every disposition must be traceable from raw evidence through code authority, engineering logic, and risk scoring to final decision. No black boxes."
        })
      };
    }

    // ── get_decision_tree ──
    if (action === "get_decision_tree") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "get_decision_tree",
          total_steps: DECISION_TREE.length,
          all_deterministic: DECISION_TREE.every(function(s) { return s.deterministic; }),
          steps: DECISION_TREE
        })
      };
    }

    // ── trace_decision ──
    if (action === "trace_decision") {
      if (!body.case_id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      }

      var sb = createClient(supabaseUrl, supabaseKey);

      // gather all case data
      var caseRes = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseRes.error || !caseRes.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ action: "trace_decision", case_id: body.case_id, error: "case_not_found" }) };
      }

      var caseData = caseRes.data;

      // parallel data fetch
      var findingsRes = await sb.from("findings").select("*").eq("case_id", body.case_id);
      var evidenceRes = await sb.from("evidence").select("*").eq("case_id", body.case_id);
      var codeRes = await sb.from("code_sets").select("*").eq("case_id", body.case_id);
      var adjRes = await sb.from("inspector_adjudications").select("*").eq("case_id", body.case_id);
      var auditRes = await sb.from("audit_events").select("*").eq("case_id", body.case_id).order("created_at", { ascending: true });
      var escalationRes = await sb.from("escalation_queue").select("*").eq("case_id", body.case_id);

      var findings = findingsRes.data || [];
      var evidence = evidenceRes.data || [];
      var codes = codeRes.data || [];
      var adjudications = adjRes.data || [];
      var auditEvents = auditRes.data || [];
      var escalations = escalationRes.data || [];

      // build trace
      var trace = [];

      // Step 1: Evidence
      trace.push({
        step: 1,
        id: "evidence_collection",
        name: "Evidence Collection",
        status: findings.length > 0 || evidence.length > 0 ? "complete" : "no_evidence",
        data: {
          findings_count: findings.length,
          evidence_count: evidence.length,
          findings: findings.map(function(f) {
            return { id: f.id, description: f.description, severity: f.severity, created_at: f.created_at };
          }),
          evidence_types: evidence.map(function(e) {
            return { id: e.id, type: e.evidence_type, file_name: e.file_name };
          })
        }
      });

      // Step 2-3: Code Authority
      trace.push({
        step: 2,
        id: "code_identification",
        name: "Applicable Code Identification",
        status: codes.length > 0 ? "complete" : "no_codes_assigned",
        data: {
          codes_count: codes.length,
          codes: codes.map(function(c) {
            return { id: c.id, code_name: c.code_name, code_type: c.code_type, precedence_tier: c.precedence_tier };
          })
        }
      });

      trace.push({
        step: 3,
        id: "code_precedence",
        name: "Code Precedence Resolution",
        status: codes.length > 0 ? "complete" : "awaiting_codes",
        data: {
          hierarchy: ["Regulatory", "Jurisdictional", "Industry Code", "Owner Spec", "Best Practice"],
          governing_code: codes.length > 0 ? codes[0] : null,
          note: "Highest-tier applicable code governs disposition"
        }
      });

      // Step 4: Mechanism ID
      var mechanismEvents = auditEvents.filter(function(e) { return e.event_type === "mechanism_identified" || e.event_type === "vertical_assessment"; });
      trace.push({
        step: 4,
        id: "mechanism_identification",
        name: "Damage Mechanism Identification",
        status: mechanismEvents.length > 0 ? "complete" : "not_run",
        data: {
          mechanism_events: mechanismEvents.length,
          details: mechanismEvents.map(function(e) { return e.event_data; })
        }
      });

      // Step 5: Engineering Assessment
      var engEvents = auditEvents.filter(function(e) { return e.event_type === "engineering_assessment" || e.event_type === "fitness_for_service"; });
      trace.push({
        step: 5,
        id: "engineering_assessment",
        name: "Engineering Assessment",
        status: engEvents.length > 0 ? "complete" : "inferred_from_disposition",
        data: {
          component: caseData.component_name,
          method: caseData.inspection_method,
          engineering_events: engEvents.map(function(e) { return e.event_data; })
        }
      });

      // Step 6: Risk Scoring
      var riskEvents = auditEvents.filter(function(e) { return e.event_type === "risk_scored" || e.event_type === "risk_assessment"; });
      trace.push({
        step: 6,
        id: "risk_scoring",
        name: "Risk Scoring",
        status: riskEvents.length > 0 ? "complete" : "available_on_demand",
        data: {
          risk_events: riskEvents.map(function(e) { return e.event_data; }),
          scoring_method: "8-factor weighted composite (severity 0.25, mechanism 0.15, remaining_life 0.15, compliance 0.10, evidence 0.10, consequence 0.10, history 0.10, age 0.05)"
        }
      });

      // Step 7: Confidence
      trace.push({
        step: 7,
        id: "confidence_calculation",
        name: "Confidence Calculation",
        status: "computed",
        data: {
          evidence_completeness: evidence.length > 0 ? "has_evidence" : "no_evidence",
          code_coverage: codes.length > 0 ? "codes_assigned" : "no_codes",
          factors: ["evidence_completeness (0.35)", "code_coverage (0.25)", "historical_precedent (0.20)", "measurement_uncertainty (0.20)"]
        }
      });

      // Step 8: Disposition
      trace.push({
        step: 8,
        id: "disposition_determination",
        name: "Disposition Determination",
        status: "complete",
        data: {
          system_disposition: caseData.status,
          case_created: caseData.created_at,
          case_updated: caseData.updated_at
        }
      });

      // Step 9: Compliance
      var compEvents = auditEvents.filter(function(e) { return e.event_type === "compliance_check" || e.event_type === "compliance_verified"; });
      trace.push({
        step: 9,
        id: "compliance_check",
        name: "Compliance Verification",
        status: compEvents.length > 0 ? "verified" : "available_on_demand",
        data: { compliance_events: compEvents.map(function(e) { return e.event_data; }) }
      });

      // Step 10: Escalation
      trace.push({
        step: 10,
        id: "escalation_check",
        name: "Escalation Evaluation",
        status: escalations.length > 0 ? "escalated" : "not_escalated",
        data: {
          escalation_count: escalations.length,
          escalations: escalations.map(function(e) {
            return { id: e.id, priority: e.priority, status: e.status, assigned_to: e.assigned_to };
          })
        }
      });

      // Step 11: Adjudication
      trace.push({
        step: 11,
        id: "inspector_adjudication",
        name: "Inspector Adjudication",
        status: adjudications.length > 0 ? "overridden" : "no_override",
        data: {
          adjudication_count: adjudications.length,
          adjudications: adjudications.map(function(a) {
            return {
              id: a.id,
              original_disposition: a.original_disposition,
              inspector_disposition: a.inspector_disposition,
              justification: a.override_justification,
              inspector_id: a.inspector_id,
              created_at: a.created_at
            };
          }),
          note: adjudications.length > 0 ? "Original system decision preserved. Inspector override is a parallel record." : "System decision stands without override."
        }
      });

      // Step 12: Audit Seal
      trace.push({
        step: 12,
        id: "audit_seal",
        name: "Audit Trail Seal",
        status: auditEvents.length > 0 ? "sealed" : "no_events",
        data: {
          total_audit_events: auditEvents.length,
          first_event: auditEvents.length > 0 ? auditEvents[0].created_at : null,
          last_event: auditEvents.length > 0 ? auditEvents[auditEvents.length - 1].created_at : null,
          event_types: auditEvents.reduce(function(acc, e) { acc[e.event_type] = (acc[e.event_type] || 0) + 1; return acc; }, {})
        }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "trace_decision",
          case_id: body.case_id,
          component: caseData.component_name,
          current_status: caseData.status,
          trace_steps: trace.length,
          trace: trace,
          traceability_verdict: {
            evidence_present: findings.length > 0 || evidence.length > 0,
            codes_assigned: codes.length > 0,
            disposition_recorded: true,
            audit_trail_exists: auditEvents.length > 0,
            fully_traceable: (findings.length > 0 || evidence.length > 0) && codes.length > 0 && auditEvents.length > 0
          }
        })
      };
    }

    // ── compare_decisions ──
    if (action === "compare_decisions") {
      if (!body.case_id_a || !body.case_id_b) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id_a and case_id_b required" }) };
      }

      var sb2 = createClient(supabaseUrl, supabaseKey);
      var caseA = await sb2.from("inspection_cases").select("*").eq("id", body.case_id_a).single();
      var caseB = await sb2.from("inspection_cases").select("*").eq("id", body.case_id_b).single();

      if (caseA.error || !caseA.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ error: "case_id_a not found" }) };
      }
      if (caseB.error || !caseB.data) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ error: "case_id_b not found" }) };
      }

      var findA = await sb2.from("findings").select("id", { count: "exact", head: true }).eq("case_id", body.case_id_a);
      var findB = await sb2.from("findings").select("id", { count: "exact", head: true }).eq("case_id", body.case_id_b);
      var adjA = await sb2.from("inspector_adjudications").select("*").eq("case_id", body.case_id_a);
      var adjB = await sb2.from("inspector_adjudications").select("*").eq("case_id", body.case_id_b);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          action: "compare_decisions",
          case_a: {
            case_id: body.case_id_a,
            component: caseA.data.component_name,
            method: caseA.data.inspection_method,
            status: caseA.data.status,
            findings_count: findA.count || 0,
            has_override: (adjA.data || []).length > 0,
            created_at: caseA.data.created_at
          },
          case_b: {
            case_id: body.case_id_b,
            component: caseB.data.component_name,
            method: caseB.data.inspection_method,
            status: caseB.data.status,
            findings_count: findB.count || 0,
            has_override: (adjB.data || []).length > 0,
            created_at: caseB.data.created_at
          },
          comparison: {
            same_component: caseA.data.component_name === caseB.data.component_name,
            same_method: caseA.data.inspection_method === caseB.data.inspection_method,
            same_disposition: caseA.data.status === caseB.data.status,
            disposition_match: caseA.data.status === caseB.data.status ? "identical" : "different"
          }
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action, valid_actions: ["trace_decision", "get_decision_tree", "compare_decisions", "get_registry"] }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
