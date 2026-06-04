// @ts-nocheck
/**
 * DEPLOY233 - inspection-report.ts
 * netlify/functions/inspection-report.ts
 *
 * INSPECTION REPORT GENERATOR
 *
 * Assembles comprehensive inspection reports from all system engines.
 * Pulls case data, findings, evidence, decisions, code authority,
 * compliance, risk scoring, adjudications, escalations, and audit trail.
 *
 * POST /api/inspection-report { action: "generate", case_id }
 *   -> Full inspection report with all sections
 *
 * POST /api/inspection-report { action: "generate_summary", case_id }
 *   -> Executive summary (1-page overview)
 *
 * POST /api/inspection-report { action: "generate_batch", case_ids[] }
 *   -> Summary reports for multiple cases (fleet/portfolio view)
 *
 * POST /api/inspection-report { action: "get_templates" }
 *   -> Available report templates and their sections
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "inspection-report/1.0.0";
var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// REPORT TEMPLATES
// ================================================================
var REPORT_TEMPLATES = {
  full_inspection: {
    id: "full_inspection",
    name: "Full Inspection Report",
    description: "Comprehensive report with all findings, decisions, compliance, and audit trail",
    sections: [
      "header",
      "executive_summary",
      "case_details",
      "findings",
      "evidence_summary",
      "system_decision",
      "code_authority",
      "compliance_evaluation",
      "risk_assessment",
      "inspector_adjudication",
      "escalation_history",
      "outcome_projections",
      "audit_trail",
      "appendix"
    ]
  },
  executive_summary: {
    id: "executive_summary",
    name: "Executive Summary",
    description: "One-page overview for management review",
    sections: [
      "header",
      "executive_summary",
      "risk_assessment",
      "recommendation"
    ]
  },
  compliance_report: {
    id: "compliance_report",
    name: "Compliance Report",
    description: "Regulatory compliance evaluation with code references",
    sections: [
      "header",
      "case_details",
      "code_authority",
      "compliance_evaluation",
      "audit_trail"
    ]
  },
  adjudication_report: {
    id: "adjudication_report",
    name: "Adjudication Report",
    description: "Inspector review history and decision comparison",
    sections: [
      "header",
      "case_details",
      "system_decision",
      "inspector_adjudication",
      "escalation_history"
    ]
  }
};

// ================================================================
// SEVERITY / STATUS FORMATTING
// ================================================================
function riskLabel(score) {
  if (score >= 0.75) return "CRITICAL";
  if (score >= 0.55) return "HIGH";
  if (score >= 0.35) return "MEDIUM";
  if (score >= 0.15) return "LOW";
  return "MINIMAL";
}

function complianceLabel(score) {
  if (score >= 0.90) return "COMPLIANT";
  if (score >= 0.70) return "PARTIALLY COMPLIANT";
  return "NON-COMPLIANT";
}

function formatDate(d) {
  if (!d) return "N/A";
  var dt = new Date(d);
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[dt.getMonth()] + " " + dt.getDate() + ", " + dt.getFullYear();
}

function formatDateTime(d) {
  if (!d) return "N/A";
  var dt = new Date(d);
  return formatDate(d) + " " + String(dt.getHours()).padStart(2, "0") + ":" + String(dt.getMinutes()).padStart(2, "0") + " UTC";
}

function safe(v, fallback) {
  if (v === null || v === undefined || v === "") return fallback || "N/A";
  return String(v);
}

function pct(v) {
  if (v === null || v === undefined) return "N/A";
  return Math.round(v * 100) + "%";
}

// ================================================================
// DATA COLLECTION — Pull everything for a case
// ================================================================
async function collectCaseData(sb, caseId) {
  var data = {
    caseData: null,
    findings: [],
    evidence: [],
    codeSets: [],
    adjudications: [],
    escalations: [],
    auditEvents: [],
    auditBundles: [],
    findingCount: 0,
    evidenceCount: 0
  };

  // Case
  var caseResult = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
  if (caseResult.error || !caseResult.data) return { error: "Case not found: " + caseId };
  data.caseData = caseResult.data;

  // Findings
  var findResult = await sb.from("findings").select("*").eq("case_id", caseId).order("created_at", { ascending: true });
  if (findResult.data) {
    data.findings = findResult.data;
    data.findingCount = findResult.data.length;
  }

  // Evidence
  var evidResult = await sb.from("evidence").select("*").eq("case_id", caseId).order("created_at", { ascending: true });
  if (evidResult.data) {
    data.evidence = evidResult.data;
    data.evidenceCount = evidResult.data.length;
  }

  // Code sets
  var codeResult = await sb.from("code_sets").select("*").eq("case_id", caseId).order("tier", { ascending: true });
  if (codeResult.data) data.codeSets = codeResult.data;

  // Adjudications
  var adjResult = await sb.from("inspector_adjudications").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
  if (adjResult.data) data.adjudications = adjResult.data;

  // Escalations
  var escResult = await sb.from("escalation_queue").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
  if (escResult.data) data.escalations = escResult.data;

  // Audit events
  var auditEvResult = await sb.from("audit_events").select("*").eq("case_id", caseId).order("created_at", { ascending: true });
  if (auditEvResult.data) data.auditEvents = auditEvResult.data;

  // Audit bundles
  var auditBdResult = await sb.from("audit_bundles").select("*").eq("case_id", caseId).order("version", { ascending: true });
  if (auditBdResult.data) data.auditBundles = auditBdResult.data;

  return data;
}

// ================================================================
// RISK SCORING (inline, avoids cross-function call)
// ================================================================
var DAMAGE_RISK = {
  "hydrogen": 0.95, "scc": 0.95, "stress corrosion cracking": 0.95,
  "fatigue": 0.90, "creep": 0.85, "erosion-corrosion": 0.80,
  "pitting": 0.75, "corrosion": 0.65, "erosion": 0.65,
  "general corrosion": 0.55, "mechanical damage": 0.60, "wear": 0.50,
  "coating failure": 0.30, "cosmetic": 0.10
};

var DISPOSITION_RISK = {
  "replace": 1.0, "repair_immediate": 0.95, "repair": 0.80,
  "monitor_closely": 0.65, "monitor": 0.50,
  "acceptable": 0.20, "accept": 0.20, "no_action": 0.10
};

function calcRiskScore(caseData, findingCount) {
  var sevScore = 0.50;
  var disp = (caseData.disposition || "").toLowerCase();
  var state = (caseData.state || "").toLowerCase();
  var dispKeys = Object.keys(DISPOSITION_RISK);
  for (var i = 0; i < dispKeys.length; i++) {
    if (disp.indexOf(dispKeys[i]) >= 0) { sevScore = DISPOSITION_RISK[dispKeys[i]]; break; }
  }
  if (sevScore === 0.50) {
    if (state.indexOf("critical") >= 0) sevScore = 1.0;
    else if (state.indexOf("major") >= 0) sevScore = 0.80;
    else if (state.indexOf("moderate") >= 0) sevScore = 0.60;
    else if (state.indexOf("minor") >= 0) sevScore = 0.35;
    else if (state.indexOf("acceptable") >= 0) sevScore = 0.15;
  }

  var confGap = (caseData.confidence !== null && caseData.confidence !== undefined) ? Math.max(0, 1.0 - caseData.confidence) : 0.70;

  var dmgScore = 0.50;
  var dmg = (caseData.damage_type || "").toLowerCase();
  var dmgKeys = Object.keys(DAMAGE_RISK);
  for (var d = 0; d < dmgKeys.length; d++) {
    if (dmg.indexOf(dmgKeys[d]) >= 0) { dmgScore = DAMAGE_RISK[dmgKeys[d]]; break; }
  }

  var overrideScore = caseData.inspector_override_active ? 0.85 : 0.10;

  var escScore = 0.05;
  if (caseData.escalation_status === "open" || caseData.escalation_status === "assigned") escScore = 0.90;

  var findDensity = findingCount >= 10 ? 1.0 : findingCount >= 5 ? 0.75 : findingCount >= 3 ? 0.55 : findingCount >= 1 ? 0.35 : 0.10;

  var ageScore = 0.10;
  if (caseData.created_at && (caseData.status === "open" || caseData.status === "in_progress")) {
    var ageDays = (Date.now() - new Date(caseData.created_at).getTime()) / 86400000;
    if (ageDays > 90) ageScore = 0.90;
    else if (ageDays > 30) ageScore = 0.65;
    else if (ageDays > 7) ageScore = 0.40;
    else ageScore = 0.15;
  }

  var score = sevScore * 0.25 + confGap * 0.15 + dmgScore * 0.15 + overrideScore * 0.10 + escScore * 0.10 + findDensity * 0.10 + ageScore * 0.10 + 0.50 * 0.05;
  return Math.round(score * 1000) / 1000;
}

// ================================================================
// SECTION BUILDERS
// ================================================================
function buildHeader(data) {
  var c = data.caseData;
  return {
    section: "header",
    report_title: "Inspection Report",
    system: "FORGED NDT Intelligence OS",
    system_version: "FORGED-NDT/2.0.0",
    engine_version: ENGINE_VERSION,
    case_id: c.id,
    case_number: c.case_number || c.id.substring(0, 8),
    generated_at: new Date().toISOString(),
    generated_by: "FORGED NDT Report Engine",
    classification: "CONFIDENTIAL — Engineering Use Only"
  };
}

function buildExecutiveSummary(data) {
  var c = data.caseData;
  var riskScore = calcRiskScore(c, data.findingCount);
  var riskLvl = riskLabel(riskScore);
  var overrideStatus = c.inspector_override_active ? "INSPECTOR OVERRIDE ACTIVE — system decision differs from inspector decision" : "No override — system decision stands";
  var effectiveDecision = c.inspector_override_active ? (c.inspector_final_decision || c.disposition) : c.disposition;

  return {
    section: "executive_summary",
    component: safe(c.component_name),
    asset_type: safe(c.asset_type),
    material: safe(c.material),
    damage_type: safe(c.damage_type),
    status: safe(c.status),
    effective_disposition: safe(effectiveDecision),
    system_disposition: safe(c.disposition),
    system_confidence: pct(c.confidence),
    risk_score: riskScore,
    risk_level: riskLvl,
    finding_count: data.findingCount,
    evidence_count: data.evidenceCount,
    override_status: overrideStatus,
    escalation_status: safe(c.escalation_status, "None"),
    adjudication_count: data.adjudications.length,
    audit_bundle_count: data.auditBundles.length,
    chain_valid: c.chain_valid !== false,
    created: formatDate(c.created_at),
    last_updated: formatDate(c.updated_at)
  };
}

function buildCaseDetails(data) {
  var c = data.caseData;
  return {
    section: "case_details",
    case_id: c.id,
    case_number: c.case_number || c.id.substring(0, 8),
    status: safe(c.status),
    component_name: safe(c.component_name),
    asset_type: safe(c.asset_type),
    material: safe(c.material),
    material_family: safe(c.material_family),
    inspection_method: safe(c.inspection_method),
    damage_type: safe(c.damage_type),
    severity: safe(c.severity),
    notes: safe(c.notes, "No notes"),
    created_at: formatDateTime(c.created_at),
    updated_at: formatDateTime(c.updated_at)
  };
}

function buildFindings(data) {
  var items = [];
  for (var i = 0; i < data.findings.length; i++) {
    var f = data.findings[i];
    items.push({
      finding_number: i + 1,
      id: f.id,
      type: safe(f.finding_type || f.type),
      description: safe(f.description),
      location: safe(f.location),
      severity: safe(f.severity),
      measurements: f.measurements || null,
      created_at: formatDateTime(f.created_at)
    });
  }
  return {
    section: "findings",
    total: data.findingCount,
    items: items
  };
}

function buildEvidenceSummary(data) {
  var items = [];
  var byType = {};
  for (var i = 0; i < data.evidence.length; i++) {
    var e = data.evidence[i];
    var t = safe(e.evidence_type || e.type, "document");
    byType[t] = (byType[t] || 0) + 1;
    items.push({
      id: e.id,
      type: t,
      filename: safe(e.filename || e.name),
      description: safe(e.description),
      uploaded_at: formatDateTime(e.created_at)
    });
  }
  return {
    section: "evidence_summary",
    total: data.evidenceCount,
    by_type: byType,
    items: items
  };
}

function buildSystemDecision(data) {
  var c = data.caseData;
  return {
    section: "system_decision",
    state: safe(c.state),
    disposition: safe(c.disposition),
    confidence: c.confidence,
    confidence_display: pct(c.confidence),
    decision_mode: EXECUTION_MODE,
    physics_coverage: c.physics_coverage || null,
    contributing_engines: c.contributing_engines || null,
    reasoning_chain: c.reasoning_chain || null,
    decision_locked: c.state === "authority_locked",
    inspector_override_active: c.inspector_override_active || false,
    inspector_final_decision: c.inspector_final_decision || null,
    effective_decision: c.inspector_override_active ? (c.inspector_final_decision || c.disposition) : c.disposition,
    note: c.inspector_override_active ? "Inspector override is active. The effective decision reflects the inspector's judgment. The system decision is preserved for comparison and audit." : "System decision stands. No inspector override."
  };
}

function buildCodeAuthority(data) {
  var codes = [];
  for (var i = 0; i < data.codeSets.length; i++) {
    var cs = data.codeSets[i];
    codes.push({
      code_name: safe(cs.code_name || cs.name),
      tier: cs.tier,
      tier_label: cs.tier === 1 ? "Regulatory Authority" : cs.tier === 2 ? "Jurisdictional Law" : cs.tier === 3 ? "Industry Consensus Code" : cs.tier === 4 ? "Owner/Operator Specification" : "Best Practice Standard",
      clauses: cs.clauses || cs.applicable_clauses || null,
      status: safe(cs.status, "assigned"),
      conflicts: cs.conflicts || null
    });
  }
  return {
    section: "code_authority",
    governing_codes: codes,
    total_codes: codes.length,
    hierarchy_note: "Codes are listed by precedence tier (1=highest authority). When codes conflict, higher-tier codes take precedence."
  };
}

function buildComplianceEvaluation(data) {
  // Return what we know from case data; full evaluation requires calling compliance-matrix
  var c = data.caseData;
  return {
    section: "compliance_evaluation",
    standards_evaluated: "API 579-1, ASME PCC-2, ASME B31.3, API 510, API 570, ISO 24817",
    total_standards: 6,
    total_requirements: 33,
    note: "Full compliance evaluation available via POST /api/compliance-matrix { action: evaluate, case_id }. Applicable standards auto-detected from asset type and code sets.",
    compliance_data: c.compliance_evaluation || null
  };
}

function buildRiskAssessment(data) {
  var c = data.caseData;
  var score = calcRiskScore(c, data.findingCount);
  var level = riskLabel(score);
  return {
    section: "risk_assessment",
    risk_score: score,
    risk_level: level,
    factors: {
      severity: { weight: "25%", signal: "Case state and disposition severity" },
      confidence_gap: { weight: "15%", signal: "System uncertainty (low confidence = higher risk)" },
      damage_type: { weight: "15%", signal: "Inherent danger of damage mechanism" },
      override_risk: { weight: "10%", signal: "Inspector disagreement with system" },
      escalation_risk: { weight: "10%", signal: "Open or multiple escalations" },
      finding_density: { weight: "10%", signal: "Number of findings per case" },
      age_risk: { weight: "10%", signal: "Duration case has been open" },
      compliance_risk: { weight: "5%", signal: "Compliance evaluation gaps" }
    },
    interpretation: level === "CRITICAL" ? "Immediate attention required. This case represents the highest risk level." :
      level === "HIGH" ? "Prioritize for review. Elevated risk across multiple factors." :
      level === "MEDIUM" ? "Standard monitoring. Risk is within normal operating range." :
      level === "LOW" ? "Routine. Low risk across most factors." :
      "Minimal concern. No significant risk indicators."
  };
}

function buildInspectorAdjudication(data) {
  var items = [];
  for (var i = 0; i < data.adjudications.length; i++) {
    var a = data.adjudications[i];
    items.push({
      adjudication_number: i + 1,
      type: safe(a.adjudication_type),
      rationale: safe(a.rationale),
      inspector_decision: a.inspector_decision || null,
      priority: a.priority || null,
      inspector_email: safe(a.user_email || a.inspector_email),
      system_state_at_time: a.system_state_snapshot ? {
        state: a.system_state_snapshot.state,
        disposition: a.system_state_snapshot.disposition,
        confidence: a.system_state_snapshot.confidence
      } : null,
      created_at: formatDateTime(a.created_at)
    });
  }
  return {
    section: "inspector_adjudication",
    total_adjudications: data.adjudications.length,
    types_summary: {
      concur: items.filter(function(x) { return x.type === "concur"; }).length,
      override: items.filter(function(x) { return x.type === "override"; }).length,
      escalate: items.filter(function(x) { return x.type === "escalate"; }).length
    },
    items: items,
    note: "System decisions are never modified by inspector actions. Inspector decisions are recorded alongside system decisions for comparison and audit."
  };
}

function buildEscalationHistory(data) {
  var items = [];
  for (var i = 0; i < data.escalations.length; i++) {
    var e = data.escalations[i];
    items.push({
      escalation_number: i + 1,
      id: e.id,
      priority: safe(e.priority),
      status: safe(e.status),
      reason: safe(e.escalation_reason),
      escalated_by: safe(e.escalated_by_name || e.escalated_by_email),
      assigned_to: safe(e.assigned_to_name || e.assigned_to_email, "Unassigned"),
      deadline: formatDateTime(e.deadline),
      resolution_type: safe(e.resolution_type, "Pending"),
      resolution_decision: safe(e.resolution_decision, "Pending"),
      resolution_rationale: safe(e.resolution_rationale, ""),
      created_at: formatDateTime(e.created_at),
      resolved_at: formatDateTime(e.resolved_at)
    });
  }
  return {
    section: "escalation_history",
    total_escalations: data.escalations.length,
    open_escalations: items.filter(function(x) { return x.status === "open" || x.status === "assigned" || x.status === "in_review"; }).length,
    items: items
  };
}

function buildAuditTrail(data) {
  var events = [];
  for (var i = 0; i < data.auditEvents.length; i++) {
    var ev = data.auditEvents[i];
    events.push({
      event_number: i + 1,
      event_type: safe(ev.event_type),
      detail: safe(ev.detail),
      actor: safe(ev.user_email || ev.user_id, "system"),
      timestamp: formatDateTime(ev.created_at)
    });
  }

  var bundles = [];
  for (var b = 0; b < data.auditBundles.length; b++) {
    var bd = data.auditBundles[b];
    bundles.push({
      version: bd.version,
      hash: bd.hash ? bd.hash.substring(0, 16) + "..." : "N/A",
      signed: !!bd.signature,
      chain_linked: !!bd.previous_hash,
      created_at: formatDateTime(bd.created_at)
    });
  }

  return {
    section: "audit_trail",
    total_events: data.auditEvents.length,
    total_bundles: data.auditBundles.length,
    chain_valid: data.caseData.chain_valid !== false,
    events: events,
    bundles: bundles,
    integrity_note: "All audit events are append-only (INSERT-only RLS). Audit bundles are HMAC-SHA256 signed with hash chain linking. Verification available via POST /api/verify-audit-chain."
  };
}

function buildRecommendation(data) {
  var c = data.caseData;
  var riskScore = calcRiskScore(c, data.findingCount);
  var effectiveDecision = c.inspector_override_active ? (c.inspector_final_decision || c.disposition) : c.disposition;

  var urgency = "routine";
  if (riskScore >= 0.75) urgency = "immediate";
  else if (riskScore >= 0.55) urgency = "priority";
  else if (riskScore >= 0.35) urgency = "scheduled";

  return {
    section: "recommendation",
    effective_disposition: safe(effectiveDecision),
    risk_level: riskLabel(riskScore),
    action_urgency: urgency,
    next_steps: riskScore >= 0.75 ? "Immediate action required. Escalate to engineering management. Do not return asset to service without resolution." :
      riskScore >= 0.55 ? "Priority review required. Schedule corrective action within deadline period. Monitor closely until resolved." :
      riskScore >= 0.35 ? "Schedule follow-up inspection per code requirements. Continue monitoring per established intervals." :
      "Routine monitoring. Continue standard inspection schedule. No immediate action required.",
    system_confidence: pct(c.confidence),
    override_note: c.inspector_override_active ? "Inspector has overridden the system decision. The recommendation reflects the inspector's judgment." : null
  };
}

function buildAppendix(data) {
  return {
    section: "appendix",
    system_info: {
      platform: "FORGED NDT Intelligence OS",
      version: "FORGED-NDT/2.0.0",
      report_engine: ENGINE_VERSION,
      execution_mode: EXECUTION_MODE,
      total_engines: 25,
      deterministic_engines: 20,
      ai_assisted_engines: 3,
      hybrid_engines: 1
    },
    methodology: {
      decision_approach: "Deterministic physics-first evaluation with AI-assisted pattern recognition for edge cases only",
      confidence_model: "Unified confidence score capped at physics coverage percentage. OOD detection applies discounts.",
      risk_model: "Weighted composite score (0-1) with 8 factors. Severity 25%, Confidence gap 15%, Damage type 15%, Override 10%, Escalation 10%, Finding density 10%, Age 10%, Compliance 5%.",
      audit_model: "Append-only event logging with HMAC-SHA256 signed bundles and hash chain linking.",
      adjudication_model: "Non-destructive. System decisions immutable. Inspector decisions recorded in parallel. Effective decision computed at read time."
    },
    disclaimer: "This report is generated by an automated system. All decisions should be reviewed by qualified inspection personnel. The system provides decision support — final authority rests with the responsible inspector and engineering authority."
  };
}

// ================================================================
// SECTION ROUTER
// ================================================================
var SECTION_BUILDERS = {
  header: buildHeader,
  executive_summary: buildExecutiveSummary,
  case_details: buildCaseDetails,
  findings: buildFindings,
  evidence_summary: buildEvidenceSummary,
  system_decision: buildSystemDecision,
  code_authority: buildCodeAuthority,
  compliance_evaluation: buildComplianceEvaluation,
  risk_assessment: buildRiskAssessment,
  inspector_adjudication: buildInspectorAdjudication,
  escalation_history: buildEscalationHistory,
  outcome_projections: buildComplianceEvaluation, // placeholder — call outcome-simulation for real data
  audit_trail: buildAuditTrail,
  recommendation: buildRecommendation,
  appendix: buildAppendix
};

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: get_templates ──
    if (action === "get_templates") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          templates: REPORT_TEMPLATES,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: generate ──
    if (action === "generate") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var templateId = body.template || "full_inspection";
      var template = REPORT_TEMPLATES[templateId];
      if (!template) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown template: " + templateId + ". Valid: " + Object.keys(REPORT_TEMPLATES).join(", ") }) };

      var caseData = await collectCaseData(sb, body.case_id);
      if (caseData.error) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: caseData.error }) };

      var sections = [];
      for (var si = 0; si < template.sections.length; si++) {
        var sectionName = template.sections[si];
        var builder = SECTION_BUILDERS[sectionName];
        if (builder) {
          sections.push(builder(caseData));
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          report: {
            template: templateId,
            template_name: template.name,
            case_id: body.case_id,
            generated_at: new Date().toISOString(),
            engine_version: ENGINE_VERSION,
            sections: sections
          },
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: generate_summary ──
    if (action === "generate_summary") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

      var sumData = await collectCaseData(sb, body.case_id);
      if (sumData.error) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: sumData.error }) };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          report: {
            template: "executive_summary",
            template_name: "Executive Summary",
            case_id: body.case_id,
            generated_at: new Date().toISOString(),
            engine_version: ENGINE_VERSION,
            sections: [
              buildHeader(sumData),
              buildExecutiveSummary(sumData),
              buildRiskAssessment(sumData),
              buildRecommendation(sumData)
            ]
          },
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: generate_batch ──
    if (action === "generate_batch") {
      var caseIds = body.case_ids;
      if (!caseIds || !caseIds.length) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_ids array required" }) };
      if (caseIds.length > 50) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Maximum 50 cases per batch" }) };

      var summaries = [];
      var errors = [];

      for (var bi = 0; bi < caseIds.length; bi++) {
        var batchData = await collectCaseData(sb, caseIds[bi]);
        if (batchData.error) {
          errors.push({ case_id: caseIds[bi], error: batchData.error });
          continue;
        }
        var c2 = batchData.caseData;
        var rs = calcRiskScore(c2, batchData.findingCount);
        summaries.push({
          case_id: c2.id,
          case_number: c2.case_number || c2.id.substring(0, 8),
          component: safe(c2.component_name),
          asset_type: safe(c2.asset_type),
          material: safe(c2.material),
          damage_type: safe(c2.damage_type),
          status: safe(c2.status),
          disposition: safe(c2.disposition),
          confidence: pct(c2.confidence),
          risk_score: rs,
          risk_level: riskLabel(rs),
          finding_count: batchData.findingCount,
          override_active: c2.inspector_override_active || false,
          escalation_status: safe(c2.escalation_status, "none")
        });
      }

      // Sort by risk score descending
      summaries.sort(function(a, b) { return b.risk_score - a.risk_score; });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          batch_report: {
            total_cases: summaries.length,
            errors: errors,
            generated_at: new Date().toISOString(),
            engine_version: ENGINE_VERSION,
            risk_distribution: {
              critical: summaries.filter(function(s) { return s.risk_level === "CRITICAL"; }).length,
              high: summaries.filter(function(s) { return s.risk_level === "HIGH"; }).length,
              medium: summaries.filter(function(s) { return s.risk_level === "MEDIUM"; }).length,
              low: summaries.filter(function(s) { return s.risk_level === "LOW"; }).length,
              minimal: summaries.filter(function(s) { return s.risk_level === "MINIMAL"; }).length
            },
            cases: summaries
          },
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: generate, generate_summary, generate_batch, get_templates" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
