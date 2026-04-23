// @ts-nocheck
/**
 * DEPLOY291 - marine-vessel-orchestrator.ts
 * netlify/functions/marine-vessel-orchestrator.ts
 *
 * MARINE VESSEL INTELLIGENCE AUTHORITY
 *
 * POST /api/marine-vessel-orchestrator
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "marine-vessel-orchestrator";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY291";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var REQUIRED_EVIDENCE = [
  { field: "vessel_type", importance: "critical", description: "Vessel class" },
  { field: "vessel_zone", importance: "critical", description: "Zone on vessel" },
  { field: "damage_description", importance: "critical", description: "What was found" },
  { field: "structural_element", importance: "critical", description: "Which structure is affected" },
  { field: "coating_condition", importance: "high", description: "Coating state" },
  { field: "loading_condition", importance: "high", description: "Current loading" },
  { field: "sea_state", importance: "high", description: "Sea conditions" },
  { field: "inspection_method", importance: "high", description: "How finding was detected" },
  { field: "wall_thickness_mm", importance: "high", description: "Measured thickness" },
  { field: "material", importance: "moderate", description: "Steel grade" },
  { field: "age_years", importance: "moderate", description: "Vessel age" },
  { field: "gm_m", importance: "moderate", description: "Metacentric height" },
  { field: "class_survey_status", importance: "moderate", description: "Class status" },
  { field: "cargo_type", importance: "moderate", description: "Cargo carried" }
];

var DAMAGE_CATEGORIES = {
  corrosion_wastage: { name: "Corrosion Wastage", urgency: "planned", class_notification: "required_if_below_renewal" },
  fatigue_cracking: { name: "Fatigue Cracking", urgency: "priority", class_notification: "required_immediately" },
  buckling: { name: "Buckling", urgency: "urgent", class_notification: "required_immediately" },
  collision_damage: { name: "Collision Damage", urgency: "emergency", class_notification: "required_immediately" },
  grounding_damage: { name: "Grounding Damage", urgency: "emergency", class_notification: "required_immediately" },
  coating_failure: { name: "Coating Failure", urgency: "planned", class_notification: "noted_at_survey" },
  machinery_failure: { name: "Machinery Failure", urgency: "urgent_to_emergency", class_notification: "required_for_class_machinery" }
};

var OPERATIONAL_DECISIONS = {
  safe_to_operate: { decision: "SAFE TO OPERATE", description: "No restrictions.", color: "green" },
  operate_with_monitoring: { decision: "OPERATE WITH MONITORING", description: "Minor findings. Enhanced monitoring.", color: "yellow" },
  restricted_operations: { decision: "RESTRICTED OPERATIONS", description: "Reduce speed, avoid heavy weather, limit cargo.", color: "orange" },
  proceed_to_repair: { decision: "PROCEED TO REPAIR", description: "Continue to nearest port/yard under restrictions.", color: "orange" },
  stop_operations: { decision: "STOP OPERATIONS", description: "Not safe for current operations.", color: "red" },
  do_not_sail: { decision: "DO NOT SAIL", description: "Not seaworthy. Repair in place or tow.", color: "red" },
  emergency: { decision: "EMERGENCY", description: "Immediate threat. Activate emergency procedures.", color: "red" }
};

function checkEvidence(input) {
  var provided = [];
  var missing_critical = [];
  var missing_high = [];
  var missing_moderate = [];
  for (var i = 0; i < REQUIRED_EVIDENCE.length; i++) {
    var field = REQUIRED_EVIDENCE[i];
    if (input[field.field] !== undefined && input[field.field] !== null && input[field.field] !== "") {
      provided.push(field.field);
    } else {
      if (field.importance === "critical") missing_critical.push(field);
      else if (field.importance === "high") missing_high.push(field);
      else missing_moderate.push(field);
    }
  }
  var score = provided.length / REQUIRED_EVIDENCE.length;
  var ceiling = 0.95;
  if (missing_critical.length > 0) ceiling = 0.40;
  else if (missing_high.length > 2) ceiling = 0.60;
  else if (missing_high.length > 0) ceiling = 0.75;
  return { evidence_score: Math.round(score * 100) / 100, confidence_ceiling: ceiling, hold: missing_critical.length > 0, provided: provided, missing_critical: missing_critical, missing_high: missing_high, missing_moderate: missing_moderate };
}

function assessVessel(input) {
  var assessment = { engine: ENGINE_ID, version: ENGINE_VERSION, assessment_type: "vessel_integrity", assessed_at: new Date().toISOString() };

  var evidence = checkEvidence(input);
  assessment.evidence = evidence;
  if (evidence.hold) {
    assessment.status = "HOLD";
    assessment.hold_reason = "Missing critical evidence: " + evidence.missing_critical.map(function(f) { return f.field; }).join(", ");
    return assessment;
  }

  var damageType = input.damage_type || null;
  if (damageType && DAMAGE_CATEGORIES[damageType]) {
    var dmg = DAMAGE_CATEGORIES[damageType];
    assessment.damage = { type: damageType, name: dmg.name, urgency: dmg.urgency, class_notification: dmg.class_notification };
  }

  var wallThickness = input.wall_thickness_mm || null;
  var originalThickness = input.original_thickness_mm || null;
  if (wallThickness && originalThickness) {
    var wastage = originalThickness - wallThickness;
    var wastagePercent = Math.round((wastage / originalThickness) * 100);
    var renewalThreshold = originalThickness * 0.75;
    var structuralStatus = "acceptable";
    if (wallThickness < renewalThreshold) structuralStatus = "below_renewal_threshold";
    else if (wallThickness < originalThickness * 0.8) structuralStatus = "substantial_corrosion";
    else if (wallThickness < originalThickness * 0.9) structuralStatus = "moderate_corrosion";
    assessment.structural = { measured_mm: wallThickness, original_mm: originalThickness, wastage_mm: Math.round(wastage * 10) / 10, wastage_percent: wastagePercent, renewal_threshold_mm: Math.round(renewalThreshold * 10) / 10, status: structuralStatus };
  }

  var coating = input.coating_condition || "unknown";
  var zone = input.vessel_zone || "unknown";
  var ZONE_CORROSION = { topsides: 0.1, main_deck: 0.15, waterline: 0.3, splash: 0.5, underwater_hull: 0.15, cargo_tanks: 0.2, ballast_tanks: 0.3, void_spaces: 0.1 };
  var baseRate = ZONE_CORROSION[zone] || 0.15;
  if (coating === "failed" || coating === "severe_degradation") baseRate = baseRate * 3;
  else if (coating === "moderate_degradation") baseRate = baseRate * 2;
  else if (coating === "minor_degradation") baseRate = baseRate * 1.3;
  assessment.corrosion = { zone: zone, coating: coating, estimated_rate_mm_yr: Math.round(baseRate * 100) / 100 };

  if (input.gm_m) {
    var gmMin = 0.15;
    if (input.vessel_category === "drilling" || input.vessel_category === "offshore_production") gmMin = 0.30;
    var fse = input.fse_correction_m || 0;
    var effectiveGM = input.gm_m - fse;
    assessment.stability = { gm_m: input.gm_m, fse_m: fse, effective_gm_m: Math.round(effectiveGM * 1000) / 1000, minimum_m: gmMin, status: effectiveGM >= gmMin ? "adequate" : "below_minimum" };
  }

  var confidence = evidence.confidence_ceiling;
  if (coating === "unknown") confidence = confidence * 0.7;
  if (!input.wall_thickness_mm) confidence = confidence * 0.8;
  assessment.confidence = { value: Math.round(confidence * 100) / 100, level: confidence >= 0.8 ? "high" : (confidence >= 0.6 ? "moderate" : (confidence >= 0.4 ? "low" : "very_low")) };

  var risk = 1.0;
  var ZONE_SEV = { topsides: 1.0, main_deck: 1.2, waterline: 2.0, splash: 2.5, underwater_hull: 1.0, cargo_tanks: 1.8, ballast_tanks: 2.0, void_spaces: 1.2 };
  risk = ZONE_SEV[zone] || 1.0;
  if (assessment.structural && assessment.structural.status === "below_renewal_threshold") risk = risk * 2.0;
  else if (assessment.structural && assessment.structural.status === "substantial_corrosion") risk = risk * 1.5;
  if (coating === "failed") risk = risk * 1.5;
  if (assessment.stability && assessment.stability.status === "below_minimum") risk = risk * 3.0;
  if (assessment.damage && assessment.damage.urgency === "emergency") risk = risk * 2.5;
  assessment.risk = { score: Math.round(risk * 100) / 100, level: risk >= 8 ? "critical" : (risk >= 5 ? "high" : (risk >= 2.5 ? "moderate" : "low")) };

  var decision = "safe_to_operate";
  if (assessment.damage && assessment.damage.urgency === "emergency") decision = "emergency";
  else if (assessment.stability && assessment.stability.status === "below_minimum") decision = "do_not_sail";
  else if (assessment.risk.level === "critical") decision = "stop_operations";
  else if (assessment.structural && assessment.structural.status === "below_renewal_threshold") decision = "proceed_to_repair";
  else if (assessment.risk.level === "high") decision = "restricted_operations";
  else if (assessment.risk.level === "moderate") decision = "operate_with_monitoring";
  var decisionDef = OPERATIONAL_DECISIONS[decision];
  assessment.operational_decision = { decision: decisionDef.decision, description: decisionDef.description, severity: decisionDef.color };

  var recs = [];
  if (assessment.structural && assessment.structural.status === "below_renewal_threshold") {
    recs.push({ priority: "critical", action: "Steel renewal required. Plan dry dock.", rationale: "Below class renewal threshold." });
  }
  if (assessment.damage && assessment.damage.class_notification === "required_immediately") {
    recs.push({ priority: "critical", action: "Notify classification society immediately.", rationale: "Class rules require immediate notification." });
  }
  if (coating === "failed" && (zone === "ballast_tanks" || zone === "cargo_tanks")) {
    recs.push({ priority: "high", action: "Tank coating repair at next dry dock.", rationale: "Failed coating accelerates structural degradation." });
  }
  if (assessment.stability && assessment.stability.status === "below_minimum") {
    recs.push({ priority: "critical", action: "Correct stability before any operations.", rationale: "GM below minimum. Capsize risk." });
  }
  if (recs.length === 0) {
    recs.push({ priority: "routine", action: "Continue operations. Monitor at next survey.", rationale: "No immediate concerns." });
  }
  assessment.recommendations = recs;

  assessment.engines_consulted = [
    "vessel-class-registry", "stability-engine", "vessel-motion-engine",
    "coatings-intelligence-authority", "corrosion-loop-engine",
    "mechanism-causality-engine", "fatigue-vibration-proof",
    "weld-acceptance-authority", "uncertainty-boundary-engine",
    "evidence-contract-engine", "decision-liability-engine",
    "interaction-mesh", "root-cause-prevention"
  ];

  assessment.status = "ASSESSED";
  assessment.klein_bottle_summary = "This assessment evaluates the vessel as one continuous system: structure + stability + motion + cargo + coating + environment + operations. One surface, one assessment.";
  return assessment;
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Marine Vessel Intelligence Authority — naval architect + marine engineer + inspector in one system", evidence_fields: REQUIRED_EVIDENCE.length, damage_categories: Object.keys(DAMAGE_CATEGORIES).length, operational_decisions: Object.keys(OPERATIONAL_DECISIONS).length, actions: ["full_assessment", "quick_assessment", "get_assessment_template", "get_damage_categories", "get_operational_decisions", "get_registry"] }) };
    }
    if (action === "full_assessment") {
      var result = assessVessel(body);
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("vessel_assessments").insert({ org_id: body.org_id || null, case_id: body.case_id || null, vessel_type: body.vessel_type || "unknown", risk_level: result.risk ? result.risk.level : "unknown", decision: result.operational_decision ? result.operational_decision.decision : "unknown", confidence: result.confidence ? result.confidence.value : null, status: result.status, result_json: result });
      } catch (dbErr) { /* non-fatal */ }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result, null, 2) };
    }
    if (action === "quick_assessment") {
      var qZone = body.vessel_zone || "underwater_hull";
      var qCoating = body.coating_condition || "unknown";
      var QSEV = { topsides: 1.0, main_deck: 1.2, waterline: 2.0, splash: 2.5, underwater_hull: 1.0, cargo_tanks: 1.8, ballast_tanks: 2.0, void_spaces: 1.2 };
      var qSev = QSEV[qZone] || 1.0;
      var qProt = (qCoating === "failed" || qCoating === "severe_degradation") ? 0.8 : 0.2;
      var qRisk = qSev * qProt;
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, assessment_type: "quick_screening", vessel_type: body.vessel_type || "unknown", zone: qZone, coating: qCoating, risk_score: Math.round(qRisk * 100) / 100, risk_level: qRisk >= 3 ? "high" : (qRisk >= 1.5 ? "moderate" : "low"), recommendation: qRisk >= 3 ? "Full assessment required" : (qRisk >= 1.5 ? "Detailed inspection recommended" : "Continue monitoring") }, null, 2) };
    }
    if (action === "get_assessment_template") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, required_fields: REQUIRED_EVIDENCE }, null, 2) };
    }
    if (action === "get_damage_categories") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, categories: DAMAGE_CATEGORIES }, null, 2) };
    }
    if (action === "get_operational_decisions") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, decisions: OPERATIONAL_DECISIONS }, null, 2) };
    }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
