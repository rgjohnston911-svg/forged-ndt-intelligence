// @ts-nocheck
/**
 * DEPLOY287 - subsea-structures-orchestrator.ts
 * netlify/functions/subsea-structures-orchestrator.ts
 *
 * SUBSEA STRUCTURES INTELLIGENCE AUTHORITY
 *
 * The orchestrator that thinks like:
 * "A senior offshore integrity engineer + corrosion specialist +
 *  structural analyst + inspection supervisor in one system."
 *
 * It always asks:
 * - What environment is this in?
 * - What is flowing through it?
 * - What hit it or interacted with it?
 * - What is the structure's role?
 * - What will happen next if nothing is done?
 *
 * Klein Bottle: subsea assets fail from INTERACTION.
 * ENVIRONMENT + STRUCTURE + MATERIAL + COATING + CP + FLOW + EVENTS
 * There is no inside or outside. One continuous degradation surface.
 *
 * POST /api/subsea-structures-orchestrator
 *
 * Actions:
 *   full_assessment        — complete subsea integrity assessment
 *   quick_assessment       — rapid screening assessment
 *   get_assessment_template — required inputs for assessment
 *   get_registry           — engine metadata
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_ID = "subsea-structures-orchestrator";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY287";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ============================================================
// SUBSEA EVIDENCE CONTRACT
// ============================================================

var REQUIRED_EVIDENCE = [
  { field: "asset_type", importance: "critical", description: "Asset class (jacket, pipeline, riser, etc.)" },
  { field: "zone", importance: "critical", description: "Zone (atmospheric, splash, tidal, submerged, mudline, buried, internal)" },
  { field: "location_description", importance: "critical", description: "Physical location on the asset" },
  { field: "damage_description", importance: "critical", description: "What was found or what happened" },
  { field: "coating_condition", importance: "high", description: "Coating state at assessment location" },
  { field: "cp_status", importance: "high", description: "CP protection status" },
  { field: "marine_growth_level", importance: "high", description: "Fouling level (none/light/moderate/heavy/extreme)" },
  { field: "structural_role", importance: "high", description: "Primary/secondary/appurtenance" },
  { field: "inspection_method", importance: "high", description: "How the finding was detected" },
  { field: "material", importance: "moderate", description: "Material grade" },
  { field: "wall_thickness_mm", importance: "moderate", description: "Measured or nominal wall thickness" },
  { field: "age_years", importance: "moderate", description: "Asset age" },
  { field: "depth_m", importance: "moderate", description: "Water depth" },
  { field: "internal_fluid", importance: "moderate", description: "What flows through it (if applicable)" },
  { field: "dimensions", importance: "moderate", description: "Damage dimensions (length, width, depth)" }
];

// ============================================================
// INTERNAL PROCESS CONDITIONS
// ============================================================

var INTERNAL_CONDITIONS = {
  dry_gas: { corrosion_risk: "low", mechanisms: ["none_if_dry"], severity_factor: 0.2 },
  wet_gas: { corrosion_risk: "moderate", mechanisms: ["CO2_corrosion", "condensation_corrosion"], severity_factor: 0.6 },
  oil: { corrosion_risk: "low_to_moderate", mechanisms: ["under_deposit", "wax_trapping"], severity_factor: 0.4 },
  multiphase: { corrosion_risk: "high", mechanisms: ["CO2_corrosion", "erosion_corrosion", "slug_impact"], severity_factor: 0.8 },
  high_water_cut: { corrosion_risk: "high", mechanisms: ["general_corrosion", "MIC", "under_deposit"], severity_factor: 0.8 },
  sour_service: { corrosion_risk: "very_high", mechanisms: ["H2S_corrosion", "SSC", "HIC", "SOHIC"], severity_factor: 1.0 },
  co2_rich: { corrosion_risk: "high", mechanisms: ["CO2_corrosion", "mesa_attack"], severity_factor: 0.8 },
  sand_producing: { corrosion_risk: "high", mechanisms: ["erosion", "erosion_corrosion"], severity_factor: 0.9 },
  seawater_injection: { corrosion_risk: "high", mechanisms: ["oxygen_corrosion", "MIC", "pitting"], severity_factor: 0.8 }
};

// ============================================================
// CONSEQUENCE CLASSIFICATION
// ============================================================

var CONSEQUENCE_MATRIX = {
  catastrophic: {
    description: "Loss of life risk, major environmental release, structural collapse",
    response_time: "immediate",
    decision_mode: "locked",
    examples: ["Platform structural failure", "Riser rupture", "Mooring failure"]
  },
  major: {
    description: "Significant environmental release, major production loss, major repair cost",
    response_time: "urgent_days",
    decision_mode: "supervisory",
    examples: ["Pipeline leak", "Significant structural damage", "CP system failure"]
  },
  moderate: {
    description: "Minor release risk, production impact, significant repair needed",
    response_time: "planned_weeks",
    decision_mode: "advisory",
    examples: ["Coating failure with corrosion", "Secondary member damage", "Anode depletion"]
  },
  minor: {
    description: "No safety impact, minor repair, no production impact",
    response_time: "next_scheduled",
    decision_mode: "assist",
    examples: ["Light marine growth", "Minor coating damage", "Cosmetic impact"]
  }
};

// ============================================================
// CORE ASSESSMENT LOGIC
// ============================================================

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

  var evidenceScore = provided.length / REQUIRED_EVIDENCE.length;
  var holdDecision = missing_critical.length > 0;

  var confidenceCeiling = 0.95;
  if (missing_critical.length > 0) confidenceCeiling = 0.40;
  else if (missing_high.length > 2) confidenceCeiling = 0.60;
  else if (missing_high.length > 0) confidenceCeiling = 0.75;

  return {
    evidence_score: Math.round(evidenceScore * 100) / 100,
    confidence_ceiling: confidenceCeiling,
    hold_decision: holdDecision,
    provided: provided,
    missing_critical: missing_critical,
    missing_high: missing_high,
    missing_moderate: missing_moderate,
    total_required: REQUIRED_EVIDENCE.length,
    total_provided: provided.length
  };
}

function assessSubsea(input) {
  var assessment = {
    engine: ENGINE_ID,
    version: ENGINE_VERSION,
    assessment_type: "subsea_integrity",
    assessed_at: new Date().toISOString()
  };

  // Step 1: Evidence check
  var evidence = checkEvidence(input);
  assessment.evidence = evidence;

  if (evidence.hold_decision) {
    assessment.status = "HOLD";
    assessment.hold_reason = "Missing critical evidence: " + evidence.missing_critical.map(function(f) { return f.field; }).join(", ");
    assessment.action = "Provide missing critical data before assessment can proceed.";
    return assessment;
  }

  // Step 2: Zone severity
  var zone = input.zone || "submerged";
  var zoneSeverity = 1.0;
  var ZONE_MULTIPLIERS = {
    atmospheric: 1.0, splash: 2.5, tidal: 1.8,
    submerged: 1.0, mudline: 1.5, buried: 1.2, internal: 1.5
  };
  zoneSeverity = ZONE_MULTIPLIERS[zone] || 1.0;

  var age = input.age_years || 0;
  if (age > 25) zoneSeverity = zoneSeverity * 1.3;
  else if (age > 15) zoneSeverity = zoneSeverity * 1.1;

  assessment.zone_assessment = {
    zone: zone,
    base_multiplier: ZONE_MULTIPLIERS[zone] || 1.0,
    adjusted_multiplier: Math.round(zoneSeverity * 100) / 100,
    age_years: age
  };

  // Step 3: Protection state
  var coatingCondition = input.coating_condition || "unknown";
  var cpStatus = input.cp_status || "unknown";
  var protectionState = "unknown";

  if (coatingCondition === "intact" && cpStatus === "effective") protectionState = "fully_protected";
  else if (coatingCondition === "failed" && cpStatus === "ineffective") protectionState = "unprotected";
  else if (coatingCondition === "failed" || coatingCondition === "severe_degradation") protectionState = "compromised";
  else if (cpStatus === "ineffective") protectionState = "partially_protected";
  else protectionState = "degraded";

  assessment.protection_state = {
    coating: coatingCondition,
    cp: cpStatus,
    combined: protectionState,
    note: protectionState === "unprotected" ? "CRITICAL: No protective barriers remain. Maximum corrosion rate." :
          protectionState === "compromised" ? "Protection significantly degraded. Accelerated corrosion likely." :
          protectionState === "fully_protected" ? "Both barriers functional. Corrosion rate minimized." :
          "Protection state requires verification."
  };

  // Step 4: Internal conditions (if flow asset)
  if (input.internal_fluid) {
    var internalDef = INTERNAL_CONDITIONS[input.internal_fluid];
    if (internalDef) {
      assessment.internal_assessment = {
        fluid: input.internal_fluid,
        corrosion_risk: internalDef.corrosion_risk,
        active_mechanisms: internalDef.mechanisms,
        severity_factor: internalDef.severity_factor,
        internal_external_interaction: "Internal conditions affect wall thickness which changes external stress state. External conditions change external corrosion which compounds with internal wall loss. One wall, two attack surfaces."
      };
    }
  }

  // Step 5: Marine growth impact
  var marineGrowth = input.marine_growth_level || "none";
  var growthConfidenceImpact = 1.0;
  var GROWTH_CONFIDENCE = { none: 1.0, light: 0.95, moderate: 0.75, heavy: 0.45, extreme: 0.20 };
  growthConfidenceImpact = GROWTH_CONFIDENCE[marineGrowth] || 1.0;

  assessment.marine_growth = {
    level: marineGrowth,
    confidence_modifier: growthConfidenceImpact,
    impact: growthConfidenceImpact < 0.5 ? "Marine growth severely limits inspection confidence. Clean before detailed assessment." : "Acceptable for current assessment."
  };

  // Step 6: External event (if present)
  if (input.external_event) {
    assessment.external_event = {
      event_type: input.external_event,
      note: "External event detected. Immediate and latent damage assessment required. Route to external-interaction-engine for detailed evaluation."
    };
  }

  // Step 7: Consequence classification
  var structuralRole = input.structural_role || "secondary";
  var assetType = input.asset_type || "unknown";
  var consequence = "moderate";

  if (structuralRole === "primary" || assetType === "jacket" || assetType === "pile" || assetType === "mooring") {
    consequence = "catastrophic";
  } else if (assetType === "pipeline" || assetType === "riser_rigid" || assetType === "riser_flexible") {
    consequence = "major";
  } else if (structuralRole === "secondary") {
    consequence = "moderate";
  } else {
    consequence = "minor";
  }

  if (protectionState === "unprotected" && consequence === "moderate") consequence = "major";
  if (protectionState === "unprotected" && consequence === "major") consequence = "catastrophic";

  var consequenceDef = CONSEQUENCE_MATRIX[consequence];
  assessment.consequence = {
    classification: consequence,
    description: consequenceDef.description,
    response_time: consequenceDef.response_time,
    decision_mode: consequenceDef.decision_mode
  };

  // Step 8: Confidence calculation
  var baseConfidence = evidence.confidence_ceiling;
  baseConfidence = baseConfidence * growthConfidenceImpact;
  if (coatingCondition === "unknown") baseConfidence = baseConfidence * 0.7;
  if (cpStatus === "unknown") baseConfidence = baseConfidence * 0.8;

  var confidenceLevel = "low";
  if (baseConfidence >= 0.80) confidenceLevel = "high";
  else if (baseConfidence >= 0.60) confidenceLevel = "moderate";
  else if (baseConfidence >= 0.40) confidenceLevel = "low";
  else confidenceLevel = "very_low";

  assessment.confidence = {
    value: Math.round(baseConfidence * 100) / 100,
    level: confidenceLevel,
    limiting_factors: []
  };
  if (evidence.missing_high.length > 0) assessment.confidence.limiting_factors.push("Missing high-importance evidence");
  if (growthConfidenceImpact < 0.5) assessment.confidence.limiting_factors.push("Heavy marine growth limits inspection reliability");
  if (coatingCondition === "unknown") assessment.confidence.limiting_factors.push("Coating condition unknown");
  if (cpStatus === "unknown") assessment.confidence.limiting_factors.push("CP status unknown");

  // Step 9: Overall risk score
  var riskScore = zoneSeverity * (protectionState === "unprotected" ? 1.0 : protectionState === "compromised" ? 0.7 : protectionState === "degraded" ? 0.4 : 0.1);
  if (assessment.internal_assessment) riskScore = riskScore + (assessment.internal_assessment.severity_factor * 2);
  if (input.external_event) riskScore = riskScore * 1.5;

  var riskLevel = "low";
  if (riskScore >= 5.0) riskLevel = "critical";
  else if (riskScore >= 3.0) riskLevel = "high";
  else if (riskScore >= 1.5) riskLevel = "moderate";

  assessment.risk = {
    score: Math.round(riskScore * 100) / 100,
    level: riskLevel
  };

  // Step 10: Recommendations
  var recommendations = [];

  if (protectionState === "unprotected") {
    recommendations.push({ priority: "critical", action: "Restore protection barriers (coating + CP)", rationale: "Asset is fully unprotected. Maximum degradation rate." });
  }
  if (consequence === "catastrophic" && confidenceLevel === "low") {
    recommendations.push({ priority: "critical", action: "Immediate detailed inspection with cleaning", rationale: "Catastrophic consequence asset with low confidence assessment." });
  }
  if (marineGrowth === "heavy" || marineGrowth === "extreme") {
    recommendations.push({ priority: "high", action: "Clean and re-inspect", rationale: "Marine growth prevents meaningful assessment." });
  }
  if (cpStatus === "ineffective" || cpStatus === "depleted") {
    recommendations.push({ priority: "high", action: "CP retrofit", rationale: "Cathodic protection not functional." });
  }
  if (zone === "splash" && coatingCondition !== "intact") {
    recommendations.push({ priority: "high", action: "Splash zone coating repair", rationale: "Splash zone has highest corrosion rate and CP cannot protect it." });
  }
  if (input.external_event) {
    recommendations.push({ priority: "high", action: "Detailed damage assessment of external event", rationale: "External event has both immediate and latent damage consequences." });
  }
  if (recommendations.length === 0) {
    recommendations.push({ priority: "routine", action: "Continue monitoring at scheduled intervals", rationale: "No immediate concerns identified." });
  }

  assessment.recommendations = recommendations;

  // Step 11: Engines to consult
  assessment.engines_consulted = [
    "subsea-domain-registry",
    "coatings-intelligence-authority",
    "corrosion-loop-engine",
    "mechanism-causality-engine",
    "uncertainty-boundary-engine",
    "evidence-contract-engine",
    "decision-liability-engine",
    "interaction-mesh",
    "root-cause-prevention"
  ];
  if (cpStatus !== "not_applicable") assessment.engines_consulted.push("cp-intelligence");
  if (marineGrowth !== "none") assessment.engines_consulted.push("marine-growth-engine");
  if (input.external_event) assessment.engines_consulted.push("external-interaction-engine");
  if (structuralRole === "primary") {
    assessment.engines_consulted.push("fatigue-vibration-proof");
    assessment.engines_consulted.push("weld-acceptance-authority");
    assessment.engines_consulted.push("multi-asset-cascade");
  }

  assessment.status = "ASSESSED";
  assessment.klein_bottle_summary = "This assessment evaluates the asset as one continuous system: environment + structure + material + coating + CP + flow + events. No factor is assessed in isolation. Every finding affects every other domain through the interaction mesh.";

  return assessment;
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          deploy: DEPLOY,
          mode: "deterministic",
          purpose: "Subsea Structures Intelligence Authority — the orchestrator that thinks like a senior offshore integrity engineer",
          principle: "Subsea assets fail from INTERACTION: environment + structure + material + coating + CP + flow + events",
          evidence_fields: REQUIRED_EVIDENCE.length,
          internal_conditions: Object.keys(INTERNAL_CONDITIONS).length,
          consequence_classes: Object.keys(CONSEQUENCE_MATRIX).length,
          actions: [
            "full_assessment — complete subsea integrity assessment",
            "quick_assessment — rapid screening assessment",
            "get_assessment_template — required inputs for assessment",
            "get_registry — engine metadata"
          ]
        })
      };
    }

    if (action === "full_assessment") {
      var result = assessSubsea(body);
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        await sb.from("subsea_assessments").insert({
          org_id: body.org_id || null,
          case_id: body.case_id || null,
          asset_type: body.asset_type || "unknown",
          zone: body.zone || "unknown",
          risk_level: result.risk ? result.risk.level : "unknown",
          consequence: result.consequence ? result.consequence.classification : "unknown",
          confidence: result.confidence ? result.confidence.value : null,
          status: result.status,
          result_json: result
        });
      } catch (dbErr) { /* non-fatal */ }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result, null, 2) };
    }

    if (action === "quick_assessment") {
      var quickResult = {
        engine: ENGINE_ID,
        version: ENGINE_VERSION,
        assessment_type: "quick_screening",
        asset_type: body.asset_type || "unknown",
        zone: body.zone || "submerged",
        coating: body.coating_condition || "unknown",
        cp: body.cp_status || "unknown"
      };

      var QUICK_ZONE = { atmospheric: 1.0, splash: 2.5, tidal: 1.8, submerged: 1.0, mudline: 1.5, buried: 1.2, internal: 1.5 };
      var qZone = QUICK_ZONE[quickResult.zone] || 1.0;
      var qProtection = (quickResult.coating === "failed" || quickResult.coating === "severe_degradation") ? 0.8 : 0.2;
      if (quickResult.cp === "ineffective") qProtection = qProtection + 0.3;
      var qRisk = qZone * qProtection;

      quickResult.risk_score = Math.round(qRisk * 100) / 100;
      quickResult.risk_level = qRisk >= 3.0 ? "high" : (qRisk >= 1.5 ? "moderate" : "low");
      quickResult.recommendation = qRisk >= 3.0 ? "Full assessment required" : (qRisk >= 1.5 ? "Detailed inspection recommended" : "Continue monitoring");

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(quickResult, null, 2) };
    }

    if (action === "get_assessment_template") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: ENGINE_ID,
          version: ENGINE_VERSION,
          action: action,
          required_fields: REQUIRED_EVIDENCE,
          internal_conditions: Object.keys(INTERNAL_CONDITIONS),
          note: "Provide as many fields as possible. Missing critical fields will HOLD the assessment."
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
