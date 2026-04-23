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
  assessment.corrosion = { zone: zone, coating: coating, estimated
