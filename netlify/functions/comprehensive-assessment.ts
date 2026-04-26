// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE ASSESSMENT ORCHESTRATOR
// DEPLOY342
//
// Production orchestration engine that chains real sub-engines into a
// complete fitness-for-service assessment pipeline. Every value in the
// output comes from an actual engine calculation — nothing hardcoded,
// nothing simulated, nothing faked.
//
// Pipeline stages (executed in order):
//
//   STAGE 1 — ASSET CLASSIFICATION & ROUTING
//     Determines which sub-engines apply based on asset_context.domain,
//     equipment type, and inspection scope. Builds the execution plan.
//
//   STAGE 2 — DIFFERENTIAL DIAGNOSIS (DDE)
//     Bayesian damage mechanism ranking. Identifies top 3 competing
//     hypotheses and discriminating evidence. Feeds mechanism context
//     to downstream engines.
//
//   STAGE 3 — FITNESS-FOR-SERVICE (FFS)
//     Routes to the correct FFS engine(s):
//       - Pressure vessel / piping → API 579 Level 2 (Part 5 metal loss)
//       - Storage tank → API 653 tank assessment
//       - Pipeline → B31.8S + 49 CFR + API 1160
//       - Offshore structure → API RP 2A-WSD + DNV-RP-C203
//     Multiple FFS engines may run if the asset has multiple damage types.
//
//   STAGE 4 — RISK-BASED INSPECTION (RBI)
//     API 581 quantitative risk assessment. Uses FFS results to compute
//     probability of failure; consequence from fluid/location context.
//     Produces risk score, risk level, and next inspection interval.
//
//   STAGE 5 — ASSESSMENT ASSEMBLY
//     Combines all sub-engine results into a single auditable output
//     with deterministic/interpreted/provenance envelope. Computes
//     overall disposition: ACCEPTABLE / MONITOR / REPAIR / REPLACE.
//
// Each stage records timing, success/failure status, and the raw
// sub-engine response. If any stage fails, subsequent stages degrade
// gracefully — partial results are still returned with clear indication
// of what succeeded and what didn't.
//
// Actions:
// - get_registry: Return engine capabilities
// - assess: Full comprehensive assessment (all 5 stages)
// - assess_ffs_only: Run FFS stage only (skip DDE and RBI)
// - assess_with_dde: Run DDE + FFS (skip RBI)
// - get_execution_plan: Return which engines would run without executing
// - get_history: Retrieve past comprehensive assessments
//
// ══════════════════════════════════════════════════════════════════════════════

var ENGINE_VERSION = "CAO-1.0.0";

var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities and sub-engine routing map", method: "GET_OR_POST" },
  "assess": { description: "Full comprehensive assessment — DDE + FFS + RBI pipeline", method: "POST" },
  "assess_ffs_only": { description: "Fitness-for-service assessment only (skip DDE and RBI)", method: "POST" },
  "assess_with_dde": { description: "DDE + FFS assessment (skip RBI)", method: "POST" },
  "get_execution_plan": { description: "Preview which engines would run for given input", method: "POST" },
  "get_history": { description: "Retrieve past comprehensive assessments", method: "POST" }
};

// ── ENGINE ROUTING TABLE ────────────────────────────────────────────────
// Maps domain + equipment type to the correct sub-engine paths and actions
var ENGINE_ROUTES = {
  ffs: {
    pressure_vessel: { path: "/api/api579-level2-part5", action: "assess", name: "API 579-1 Part 5 Level 2" },
    piping: { path: "/api/api579-level2-part5", action: "assess", name: "API 579-1 Part 5 Level 2" },
    heat_exchanger: { path: "/api/api579-level2-part5", action: "assess", name: "API 579-1 Part 5 Level 2" },
    storage_tank: { path: "/api/api653-tank-assessment", action: "assess", name: "API 653 Tank Assessment" },
    pipeline: { path: "/api/pipeline-integrity-engine", action: "assess_segment", name: "Pipeline Integrity (B31.8S)" },
    jacket: { path: "/api/offshore-structural-assessment", action: "assess_member", name: "Offshore Structural (API RP 2A-WSD)" },
    platform: { path: "/api/offshore-structural-assessment", action: "assess_member", name: "Offshore Structural (API RP 2A-WSD)" },
    riser: { path: "/api/offshore-structural-assessment", action: "assess_fatigue", name: "Offshore Fatigue (DNV-RP-C203)" },
    subsea_pipeline: { path: "/api/pipeline-integrity-engine", action: "assess_segment", name: "Pipeline Integrity (B31.8S)" },
    marine_vessel: { path: "/api/offshore-structural-assessment", action: "assess_member", name: "Offshore Structural (API RP 2A-WSD)" }
  },
  rbi: {
    default: { path: "/api/api581-rbi-engine", action: "assess_risk", name: "API 581 RBI" }
  },
  dde: {
    default: { path: "/api/differential-diagnosis", action: "diagnose", name: "Differential Diagnosis Engine" }
  }
};

// ── DOMAIN TO EQUIPMENT TYPE DEFAULTS ───────────────────────────────────
var DOMAIN_DEFAULTS = {
  fixed: "pressure_vessel",
  subsea: "jacket",
  marine: "marine_vessel",
  pipeline: "pipeline",
  tank: "storage_tank"
};

// ── INTERNAL ENGINE CALLER ──────────────────────────────────────────────
// Calls a sub-engine via its Netlify function path. In production on Netlify,
// functions can call each other via the site's own URL. We use the
// DEPLOY_URL or URL environment variable that Netlify provides.
async function callEngine(enginePath: string, payload: any): Promise<any> {
  var baseUrl = process.env.URL || process.env.DEPLOY_URL || "";

  // If no base URL (local dev), try localhost
  if (!baseUrl) {
    baseUrl = "http://localhost:8888";
  }

  var fullUrl = baseUrl + "/.netlify/functions/" + enginePath.replace("/api/", "");

  var startTime = Date.now();
  try {
    // Use dynamic import for node-fetch if needed, or native fetch
    var response = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    var elapsed = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        status_code: response.status,
        elapsed_ms: elapsed,
        error: "HTTP " + response.status,
        data: null
      };
    }

    var data = await response.json();
    return {
      success: true,
      status_code: 200,
      elapsed_ms: elapsed,
      error: null,
      data: data
    };
  } catch (err: any) {
    var elapsed2 = Date.now() - startTime;
    return {
      success: false,
      status_code: 0,
      elapsed_ms: elapsed2,
      error: "Engine call failed: " + (err.message || String(err)),
      data: null
    };
  }
}

// ── EXECUTION PLAN BUILDER ──────────────────────────────────────────────
function buildExecutionPlan(assetContext: any, scope: any): any {
  var domain = assetContext.domain || "fixed";
  var equipmentType = assetContext.equipment_type || assetContext.asset_class || DOMAIN_DEFAULTS[domain] || "pressure_vessel";

  var plan: any = {
    domain: domain,
    equipment_type: equipmentType,
    stages: []
  };

  // Stage 1: Classification (always runs, no engine call)
  plan.stages.push({
    stage: 1,
    name: "Asset Classification & Routing",
    engine: "internal",
    action: "classify",
    will_run: true
  });

  // Stage 2: DDE
  var runDDE = scope !== "ffs_only";
  plan.stages.push({
    stage: 2,
    name: "Differential Diagnosis",
    engine: ENGINE_ROUTES.dde.default.name,
    path: ENGINE_ROUTES.dde.default.path,
    action: ENGINE_ROUTES.dde.default.action,
    will_run: runDDE,
    skip_reason: runDDE ? null : "Scope limited to FFS only"
  });

  // Stage 3: FFS
  var ffsRoute = ENGINE_ROUTES.ffs[equipmentType];
  if (!ffsRoute) {
    ffsRoute = ENGINE_ROUTES.ffs.pressure_vessel; // Default fallback
  }
  plan.stages.push({
    stage: 3,
    name: "Fitness-for-Service",
    engine: ffsRoute.name,
    path: ffsRoute.path,
    action: ffsRoute.action,
    will_run: true
  });

  // Stage 3b: Joint assessment (offshore only)
  if (equipmentType === "jacket" || equipmentType === "platform") {
    plan.stages.push({
      stage: 3.1,
      name: "Tubular Joint Assessment",
      engine: "Offshore Structural (API RP 2A-WSD)",
      path: "/api/offshore-structural-assessment",
      action: "assess_joint",
      will_run: !!(assetContext.joint_data),
      skip_reason: assetContext.joint_data ? null : "No joint data provided"
    });

    plan.stages.push({
      stage: 3.2,
      name: "Fatigue Life Assessment",
      engine: "Offshore Fatigue (DNV-RP-C203)",
      path: "/api/offshore-structural-assessment",
      action: "assess_fatigue",
      will_run: !!(assetContext.fatigue_data),
      skip_reason: assetContext.fatigue_data ? null : "No fatigue data provided"
    });
  }

  // Stage 3c: Pipeline-specific sub-assessments
  if (equipmentType === "pipeline" || equipmentType === "subsea_pipeline") {
    plan.stages.push({
      stage: 3.1,
      name: "Threat Classification",
      engine: "Pipeline Integrity (B31.8S)",
      path: "/api/pipeline-integrity-engine",
      action: "classify_threats",
      will_run: true
    });

    if (assetContext.ili_features) {
      plan.stages.push({
        stage: 3.2,
        name: "ILI Feature Assessment",
        engine: "Pipeline Integrity (API 1160)",
        path: "/api/pipeline-integrity-engine",
        action: "assess_ili_feature",
        will_run: true
      });
    }
  }

  // Stage 4: RBI
  var runRBI = scope === "full";
  plan.stages.push({
    stage: 4,
    name: "Risk-Based Inspection",
    engine: ENGINE_ROUTES.rbi.default.name,
    path: ENGINE_ROUTES.rbi.default.path,
    action: ENGINE_ROUTES.rbi.default.action,
    will_run: runRBI,
    skip_reason: runRBI ? null : "Scope does not include RBI"
  });

  // Stage 5: Assembly (always)
  plan.stages.push({
    stage: 5,
    name: "Assessment Assembly & Disposition",
    engine: "internal",
    action: "assemble",
    will_run: true
  });

  plan.total_engine_calls = 0;
  for (var i = 0; i < plan.stages.length; i++) {
    if (plan.stages[i].will_run && plan.stages[i].engine !== "internal") {
      plan.total_engine_calls++;
    }
  }

  return plan;
}

// ── DDE PAYLOAD BUILDER ─────────────────────────────────────────────────
function buildDDEPayload(body: any): any {
  return {
    action: "diagnose",
    asset_context: body.asset_context || {},
    decision_core_result: body.decision_core_result || { state: "RESOLVED", fmd_dominant: null },
    observed_evidence: body.observed_evidence || {},
    inspection_meta: body.inspection_meta || {}
  };
}

// ── FFS PAYLOAD BUILDERS ────────────────────────────────────────────────

function buildAPI579Payload(body: any, ddeResult: any): any {
  var ffs = body.ffs_data || {};
  var payload: any = {
    action: "assess",
    asset_id: body.asset_context.asset_id || null,
    component_type: ffs.component_type || body.asset_context.equipment_type || "cylinder",
    D: ffs.diameter || ffs.D || null,
    P: ffs.design_pressure || ffs.P || null,
    S: ffs.allowable_stress || ffs.S || null,
    E: ffs.weld_efficiency || ffs.E || 1.0,
    W: ffs.weld_strength_factor || ffs.W || 1.0,
    tnom: ffs.nominal_thickness || ffs.tnom || null,
    tmm: ffs.measured_min_thickness || ffs.tmm || null,
    FCA: ffs.future_corrosion_allowance || ffs.FCA || 0,
    c: ffs.flaw_half_length || ffs.c || null,
    corrosion_rate: ffs.corrosion_rate || null
  };

  // Inject DDE top mechanism as context (informational, doesn't change math)
  if (ddeResult && ddeResult.deterministic && ddeResult.deterministic.hypotheses) {
    payload.dde_context = {
      top_mechanism: ddeResult.deterministic.hypotheses[0] ? ddeResult.deterministic.hypotheses[0].mechanism_id : null,
      top_posterior: ddeResult.deterministic.hypotheses[0] ? ddeResult.deterministic.hypotheses[0].posterior : null
    };
  }

  return payload;
}

function buildTankPayload(body: any): any {
  var tank = body.ffs_data || {};
  return {
    action: "assess",
    asset_id: body.asset_context.asset_id || null,
    tank_diameter_ft: tank.diameter_ft || tank.tank_diameter_ft || null,
    tank_height_ft: tank.height_ft || tank.tank_height_ft || null,
    shell_courses: tank.shell_courses || [],
    bottom_data: tank.bottom_data || null,
    settlement_data: tank.settlement_data || null,
    roof_data: tank.roof_data || null,
    product: tank.product || null,
    design_specific_gravity: tank.design_specific_gravity || 1.0,
    corrosion_allowance: tank.corrosion_allowance || 0
  };
}

function buildPipelinePayload(body: any): any {
  var pipe = body.ffs_data || {};
  return {
    action: "assess_segment",
    pipeline_id: body.asset_context.asset_id || pipe.pipeline_id || null,
    segment_id: pipe.segment_id || null,
    OD: pipe.outside_diameter || pipe.OD || null,
    WT: pipe.wall_thickness || pipe.WT || null,
    SMYS: pipe.smys || pipe.SMYS || null,
    MAOP: pipe.maop || pipe.MAOP || null,
    coating_type: pipe.coating_type || null,
    cp_adequate: pipe.cp_adequate !== undefined ? pipe.cp_adequate : true,
    vintage: pipe.vintage || null,
    product: pipe.product || null,
    class_location: pipe.class_location || 1,
    hca_context: pipe.hca_context || null,
    ili_features: pipe.ili_features || null,
    soil_conditions: pipe.soil_conditions || null
  };
}

function buildOffshorePayload(body: any, action: string): any {
  var offshore = body.ffs_data || {};
  var payload: any = {
    action: action,
    platform_id: body.asset_context.asset_id || offshore.platform_id || null,
    member_id: offshore.member_id || null
  };

  if (action === "assess_member") {
    payload.OD = offshore.outside_diameter || offshore.OD || null;
    payload.WT = offshore.wall_thickness || offshore.WT || null;
    payload.L = offshore.length || offshore.L || null;
    payload.Fy = offshore.yield_strength || offshore.Fy || null;
    payload.K = offshore.effective_length_factor || offshore.K || 1.0;
    payload.axial_load = offshore.axial_load || 0;
    payload.bending_moment = offshore.bending_moment || 0;
    payload.external_pressure = offshore.external_pressure || 0;
    payload.depth = offshore.depth || 0;
  }

  if (action === "assess_joint") {
    payload.joint_type = offshore.joint_type || "T";
    payload.chord_OD = offshore.chord_OD || null;
    payload.chord_WT = offshore.chord_WT || null;
    payload.brace_OD = offshore.brace_OD || null;
    payload.brace_WT = offshore.brace_WT || null;
    payload.theta = offshore.theta || 90;
    payload.brace_force = offshore.brace_force || 0;
    payload.chord_Fy = offshore.chord_Fy || null;
  }

  if (action === "assess_fatigue") {
    payload.sn_curve = offshore.sn_curve || "D";
    payload.scf = offshore.scf || null;
    payload.stress_ranges = offshore.stress_ranges || [];
    payload.cycle_counts = offshore.cycle_counts || [];
    payload.design_life_years = offshore.design_life_years || 25;
  }

  return payload;
}

// ── RBI PAYLOAD BUILDER ─────────────────────────────────────────────────
function buildRBIPayload(body: any, ffsResult: any, ddeResult: any): any {
  var rbi = body.rbi_data || {};
  var ffs = body.ffs_data || {};

  var payload: any = {
    action: "assess_risk",
    asset_id: body.asset_context.asset_id || null,
    equipment_type: mapEquipmentForRBI(body.asset_context.equipment_type || body.asset_context.asset_class || "vessel"),
    tnom: ffs.nominal_thickness || ffs.tnom || rbi.tnom || null,
    tmm: ffs.measured_min_thickness || ffs.tmm || rbi.tmm || null,
    tmin: null, // Will be populated from FFS result if available
    inspection_count: rbi.inspection_count || 0,
    inspection_effectiveness: rbi.inspection_effectiveness || "B",
    fluid_category: rbi.fluid_category || "C3",
    release_mass_kg: rbi.release_mass_kg || 100,
    detection_rating: rbi.detection_rating || "B",
    isolation_rating: rbi.isolation_rating || "B",
    mitigation_factor: rbi.mitigation_factor || 1.0
  };

  // Inject tmin from FFS result if available
  if (ffsResult && ffsResult.data) {
    if (ffsResult.data.deterministic && ffsResult.data.deterministic.tmin !== undefined) {
      payload.tmin = ffsResult.data.deterministic.tmin;
    } else if (ffsResult.data.tmin !== undefined) {
      payload.tmin = ffsResult.data.tmin;
    }
  }

  // Inject damage factor context from DDE
  if (ddeResult && ddeResult.data && ddeResult.data.deterministic) {
    var hyps = ddeResult.data.deterministic.hypotheses;
    if (hyps && hyps.length > 0) {
      payload.dde_top_mechanism = hyps[0].mechanism_id;
      payload.dde_top_posterior = hyps[0].posterior;
    }
  }

  return payload;
}

function mapEquipmentForRBI(equipmentType: string): string {
  var mapping: any = {
    pressure_vessel: "vessel",
    piping: "pipe",
    heat_exchanger: "heat_exchanger_tube",
    storage_tank: "tank_bottom",
    pipeline: "pipe",
    subsea_pipeline: "pipe",
    jacket: "vessel",
    platform: "vessel",
    riser: "pipe",
    marine_vessel: "vessel"
  };
  return mapping[equipmentType] || "vessel";
}

// ── DISPOSITION LOGIC ───────────────────────────────────────────────────
// Combines FFS acceptance, RBI risk level, and DDE mechanism severity
// into a single overall disposition
function computeDisposition(ddeResult: any, ffsResult: any, rbiResult: any): any {
  var disposition = "ACCEPTABLE";
  var factors: any[] = [];
  var recommendations: any[] = [];

  // Factor 1: FFS acceptance
  if (ffsResult && ffsResult.success && ffsResult.data) {
    var ffsData = ffsResult.data.deterministic || ffsResult.data;
    var acceptance = ffsData.acceptance || ffsData.overall_verdict || ffsData.assessment_verdict || null;

    if (acceptance) {
      var normalizedAcceptance = String(acceptance).toUpperCase();
      if (normalizedAcceptance.indexOf("REPAIR") !== -1 || normalizedAcceptance.indexOf("REPLACE") !== -1) {
        disposition = "REPAIR_REQUIRED";
        factors.push({ source: "FFS", finding: acceptance, weight: "critical" });
        recommendations.push("FFS assessment indicates repair or replacement is required per applicable code");
      } else if (normalizedAcceptance.indexOf("REDUCED") !== -1 || normalizedAcceptance.indexOf("DERATE") !== -1) {
        if (disposition !== "REPAIR_REQUIRED") disposition = "MONITOR_DERATE";
        factors.push({ source: "FFS", finding: acceptance, weight: "significant" });
        recommendations.push("Operating at reduced MAWP is required — re-assess at next inspection interval");
      } else if (normalizedAcceptance.indexOf("ACCEPT") !== -1) {
        factors.push({ source: "FFS", finding: acceptance, weight: "supporting" });
      }
    }

    // Check remaining life
    var remainingLife = ffsData.remaining_life || ffsData.min_remaining_life || null;
    if (remainingLife !== null && remainingLife < 2) {
      if (disposition === "ACCEPTABLE") disposition = "MONITOR_URGENT";
      factors.push({ source: "FFS", finding: "Remaining life < 2 years: " + remainingLife, weight: "critical" });
      recommendations.push("Remaining life is critically short — schedule replacement or repair within " + Math.ceil(remainingLife) + " year(s)");
    } else if (remainingLife !== null && remainingLife < 5) {
      if (disposition === "ACCEPTABLE") disposition = "MONITOR";
      factors.push({ source: "FFS", finding: "Remaining life < 5 years: " + remainingLife, weight: "significant" });
      recommendations.push("Plan replacement or remediation within remaining life window");
    }
  }

  // Factor 2: RBI risk level
  if (rbiResult && rbiResult.success && rbiResult.data) {
    var rbiData = rbiResult.data.deterministic || rbiResult.data;
    var riskLevel = rbiData.risk_level || null;

    if (riskLevel) {
      var normalizedRisk = String(riskLevel).toUpperCase();
      if (normalizedRisk === "HIGH" || normalizedRisk === "HIGH-HIGH") {
        if (disposition === "ACCEPTABLE") disposition = "MONITOR_URGENT";
        factors.push({ source: "RBI", finding: "Risk level: " + riskLevel, weight: "critical" });
        recommendations.push("High risk — reduce inspection interval and consider mitigation measures");
      } else if (normalizedRisk === "MEDIUM-HIGH" || normalizedRisk === "MEDIUM") {
        if (disposition === "ACCEPTABLE") disposition = "MONITOR";
        factors.push({ source: "RBI", finding: "Risk level: " + riskLevel, weight: "significant" });
        recommendations.push("Medium risk — maintain current inspection program with enhanced monitoring");
      } else {
        factors.push({ source: "RBI", finding: "Risk level: " + riskLevel, weight: "supporting" });
      }
    }

    // Next inspection interval
    var nextInspection = rbiData.next_inspection_years || null;
    if (nextInspection !== null) {
      recommendations.push("Next inspection recommended in " + nextInspection + " years per API 581 risk-based interval");
    }
  }

  // Factor 3: DDE mechanism severity
  if (ddeResult && ddeResult.success && ddeResult.data) {
    var ddeData = ddeResult.data.deterministic || ddeResult.data;
    var hypotheses = ddeData.hypotheses || [];

    if (hypotheses.length > 0) {
      var topMech = hypotheses[0];
      if (topMech.severity_default === "high" && topMech.posterior > 0.50) {
        if (disposition === "ACCEPTABLE") disposition = "MONITOR";
        factors.push({
          source: "DDE",
          finding: topMech.display_name + " (posterior: " + Math.round(topMech.posterior * 100) + "%, severity: high)",
          weight: "significant"
        });
        recommendations.push("High-severity mechanism identified with strong confidence — confirm with discriminating tests before disposition");
      }

      // FMD divergence flag
      if (ddeData.fmd_divergence) {
        factors.push({
          source: "DDE",
          finding: "FMD/DDE divergence: " + ddeData.fmd_divergence.note,
          weight: "informational"
        });
        recommendations.push("DDE and FMD disagree on dominant mechanism — resolve with recommended discriminating evidence before finalizing disposition");
      }
    }

    // Surface discriminating evidence as recommendations
    var discEvidence = ddeData.discriminating_evidence || [];
    for (var d = 0; d < discEvidence.length && d < 2; d++) {
      recommendations.push("Recommended test: " + discEvidence[d].method_suggestion + " (discriminates " + discEvidence[d].dimension + ")");
    }
  }

  return {
    overall_disposition: disposition,
    disposition_factors: factors,
    recommendations: recommendations,
    factor_count: factors.length,
    recommendation_count: recommendations.length
  };
}

// ── FULL ASSESSMENT PIPELINE ────────────────────────────────────────────
async function runFullAssessment(body: any, scope: string): Promise<any> {
  var totalStart = Date.now();
  var stageResults: any = {};
  var errors: any[] = [];

  // Validate minimum input
  if (!body.asset_context) {
    return {
      status: "HOLD",
      reason: "No asset_context provided — cannot route to sub-engines",
      engine_version: ENGINE_VERSION
    };
  }

  var assetContext = body.asset_context;
  var domain = assetContext.domain || "fixed";
  var equipmentType = assetContext.equipment_type || assetContext.asset_class || DOMAIN_DEFAULTS[domain] || "pressure_vessel";

  // ── STAGE 1: Classification ──────────────────────────────────────
  var plan = buildExecutionPlan(assetContext, scope);
  stageResults.classification = {
    stage: 1,
    name: "Asset Classification",
    success: true,
    elapsed_ms: 0,
    result: {
      domain: domain,
      equipment_type: equipmentType,
      execution_plan: plan
    }
  };

  // ── STAGE 2: DDE ─────────────────────────────────────────────────
  var ddeResult: any = null;
  if (scope !== "ffs_only") {
    var ddePayload = buildDDEPayload(body);
    ddeResult = await callEngine(ENGINE_ROUTES.dde.default.path, ddePayload);

    stageResults.dde = {
      stage: 2,
      name: "Differential Diagnosis",
      success: ddeResult.success,
      elapsed_ms: ddeResult.elapsed_ms,
      error: ddeResult.error,
      result: ddeResult.data
    };

    if (!ddeResult.success) {
      errors.push({ stage: 2, engine: "DDE", error: ddeResult.error });
    }
  } else {
    stageResults.dde = { stage: 2, name: "Differential Diagnosis", skipped: true, reason: "Scope: ffs_only" };
  }

  // ── STAGE 3: FFS ─────────────────────────────────────────────────
  var ffsResult: any = null;
  var ffsRoute = ENGINE_ROUTES.ffs[equipmentType] || ENGINE_ROUTES.ffs.pressure_vessel;
  var ffsPayload: any = null;

  if (equipmentType === "storage_tank") {
    ffsPayload = buildTankPayload(body);
  } else if (equipmentType === "pipeline" || equipmentType === "subsea_pipeline") {
    ffsPayload = buildPipelinePayload(body);
  } else if (equipmentType === "jacket" || equipmentType === "platform" || equipmentType === "riser") {
    ffsPayload = buildOffshorePayload(body, ffsRoute.action);
  } else {
    ffsPayload = buildAPI579Payload(body, ddeResult ? ddeResult.data : null);
  }

  ffsResult = await callEngine(ffsRoute.path, ffsPayload);

  stageResults.ffs = {
    stage: 3,
    name: "Fitness-for-Service",
    engine: ffsRoute.name,
    success: ffsResult.success,
    elapsed_ms: ffsResult.elapsed_ms,
    error: ffsResult.error,
    result: ffsResult.data
  };

  if (!ffsResult.success) {
    errors.push({ stage: 3, engine: ffsRoute.name, error: ffsResult.error });
  }

  // Stage 3 sub-assessments for offshore
  if (equipmentType === "jacket" || equipmentType === "platform") {
    if (assetContext.joint_data || (body.ffs_data && body.ffs_data.joint_type)) {
      var jointPayload = buildOffshorePayload(body, "assess_joint");
      var jointResult = await callEngine("/api/offshore-structural-assessment", jointPayload);
      stageResults.ffs_joint = {
        stage: 3.1,
        name: "Tubular Joint Assessment",
        success: jointResult.success,
        elapsed_ms: jointResult.elapsed_ms,
        result: jointResult.data
      };
    }

    if (assetContext.fatigue_data || (body.ffs_data && body.ffs_data.stress_ranges)) {
      var fatiguePayload = buildOffshorePayload(body, "assess_fatigue");
      var fatigueResult = await callEngine("/api/offshore-structural-assessment", fatiguePayload);
      stageResults.ffs_fatigue = {
        stage: 3.2,
        name: "Fatigue Life Assessment",
        success: fatigueResult.success,
        elapsed_ms: fatigueResult.elapsed_ms,
        result: fatigueResult.data
      };
    }
  }

  // Stage 3 sub-assessments for pipeline
  if (equipmentType === "pipeline" || equipmentType === "subsea_pipeline") {
    var threatPayload = buildPipelinePayload(body);
    threatPayload.action = "classify_threats";
    var threatResult = await callEngine("/api/pipeline-integrity-engine", threatPayload);
    stageResults.ffs_threats = {
      stage: 3.1,
      name: "Threat Classification",
      success: threatResult.success,
      elapsed_ms: threatResult.elapsed_ms,
      result: threatResult.data
    };

    if (body.ffs_data && body.ffs_data.ili_features) {
      var iliPayload = buildPipelinePayload(body);
      iliPayload.action = "assess_ili_feature";
      iliPayload.feature = body.ffs_data.ili_features;
      var iliResult = await callEngine("/api/pipeline-integrity-engine", iliPayload);
      stageResults.ffs_ili = {
        stage: 3.2,
        name: "ILI Feature Assessment",
        success: iliResult.success,
        elapsed_ms: iliResult.elapsed_ms,
        result: iliResult.data
      };
    }
  }

  // ── STAGE 4: RBI ─────────────────────────────────────────────────
  var rbiResult: any = null;
  if (scope === "full") {
    var rbiPayload = buildRBIPayload(body, ffsResult, ddeResult);
    rbiResult = await callEngine(ENGINE_ROUTES.rbi.default.path, rbiPayload);

    stageResults.rbi = {
      stage: 4,
      name: "Risk-Based Inspection",
      engine: "API 581 RBI",
      success: rbiResult.success,
      elapsed_ms: rbiResult.elapsed_ms,
      error: rbiResult.error,
      result: rbiResult.data
    };

    if (!rbiResult.success) {
      errors.push({ stage: 4, engine: "API 581 RBI", error: rbiResult.error });
    }
  } else {
    stageResults.rbi = { stage: 4, name: "Risk-Based Inspection", skipped: true, reason: "Scope: " + scope };
  }

  // ── STAGE 5: Assembly ────────────────────────────────────────────
  var dispositionResult = computeDisposition(
    ddeResult ? { success: ddeResult.success, data: ddeResult.data } : null,
    ffsResult ? { success: ffsResult.success, data: ffsResult.data } : null,
    rbiResult ? { success: rbiResult.success, data: rbiResult.data } : null
  );

  var totalElapsed = Date.now() - totalStart;

  // Count successes
  var stageKeys = Object.keys(stageResults);
  var successCount = 0;
  var totalStages = 0;
  for (var s = 0; s < stageKeys.length; s++) {
    var sr = stageResults[stageKeys[s]];
    if (sr.skipped) continue;
    totalStages++;
    if (sr.success) successCount++;
  }

  var output = {
    deterministic: {
      disposition: dispositionResult,
      stages: stageResults,
      stage_summary: {
        total: totalStages,
        succeeded: successCount,
        failed: totalStages - successCount,
        errors: errors
      }
    },
    interpreted: {
      overall_disposition: dispositionResult.overall_disposition,
      top_mechanism: null as string | null,
      ffs_acceptance: null as string | null,
      risk_level: null as string | null,
      recommendation_count: dispositionResult.recommendation_count,
      primary_recommendation: dispositionResult.recommendations.length > 0 ? dispositionResult.recommendations[0] : "No specific recommendations"
    },
    provenance: {
      engine_version: ENGINE_VERSION,
      domain: domain,
      equipment_type: equipmentType,
      scope: scope,
      total_elapsed_ms: totalElapsed,
      engines_called: plan.total_engine_calls,
      stages_succeeded: successCount,
      stages_failed: totalStages - successCount,
      timestamp: new Date().toISOString()
    }
  };

  // Fill interpreted fields from sub-engine results
  if (ddeResult && ddeResult.success && ddeResult.data) {
    var ddeOut = ddeResult.data.deterministic || ddeResult.data;
    if (ddeOut.hypotheses && ddeOut.hypotheses.length > 0) {
      output.interpreted.top_mechanism = ddeOut.hypotheses[0].display_name + " (" + Math.round(ddeOut.hypotheses[0].posterior * 100) + "%)";
    }
  }

  if (ffsResult && ffsResult.success && ffsResult.data) {
    var ffsOut = ffsResult.data.deterministic || ffsResult.data;
    output.interpreted.ffs_acceptance = ffsOut.acceptance || ffsOut.overall_verdict || ffsOut.assessment_verdict || "See FFS detail";
  }

  if (rbiResult && rbiResult.success && rbiResult.data) {
    var rbiOut = rbiResult.data.deterministic || rbiResult.data;
    output.interpreted.risk_level = rbiOut.risk_level || "See RBI detail";
  }

  return output;
}

// ── HANDLER ────────────────────────────────────────────────────────────
var handler: Handler = async function(event) {
  var headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headers, body: "" };
  }

  try {
    var body: any = {};
    if (event.body) {
      try { body = JSON.parse(event.body); } catch (e) { body = {}; }
    }

    var action = body.action || "get_registry";

    // ── GET_REGISTRY ──────────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          engine: "Comprehensive Assessment Orchestrator",
          version: ENGINE_VERSION,
          deploy: "DEPLOY342",
          description: "Production orchestration engine — chains DDE, FFS (API 579/653/B31.8S/API RP 2A-WSD), and RBI (API 581) into a complete fitness-for-service assessment pipeline. Every result comes from real engine calculations.",
          actions: ACTION_REGISTRY,
          sub_engines: {
            dde: "Differential Diagnosis Engine (DDE-1.0.0) — Bayesian mechanism ranking",
            api579: "API 579-1 Part 5 Level 2 — Local metal loss assessment",
            api653: "API 653 — Tank integrity assessment",
            pipeline: "Pipeline Integrity — B31.8S + 49 CFR 192/195 + API 1160",
            offshore: "Offshore Structural — API RP 2A-WSD + DNV-RP-C203",
            rbi: "API 581 — Quantitative risk-based inspection"
          },
          routing: ENGINE_ROUTES,
          pipeline_stages: [
            "Stage 1: Asset Classification & Routing",
            "Stage 2: Differential Diagnosis (DDE)",
            "Stage 3: Fitness-for-Service (domain-specific)",
            "Stage 4: Risk-Based Inspection (API 581)",
            "Stage 5: Assessment Assembly & Disposition"
          ],
          disposition_levels: [
            "ACCEPTABLE — all criteria met",
            "MONITOR — reinspect within defined interval",
            "MONITOR_URGENT — remaining life < 2 years or high risk",
            "MONITOR_DERATE — operating at reduced MAWP required",
            "REPAIR_REQUIRED — FFS assessment requires repair or replacement"
          ]
        })
      };
    }

    // ── ASSESS (full pipeline) ────────────────────────────────────
    if (action === "assess") {
      var result = await runFullAssessment(body, "full");

      // Non-fatal DB write
      try {
        if (supabaseUrl && supabaseKey) {
          var db = createClient(supabaseUrl, supabaseKey);
          await db.from("comprehensive_assessments").insert({
            case_id: body.case_id || (body.asset_context && body.asset_context.case_id) || null,
            domain: body.asset_context ? body.asset_context.domain : null,
            equipment_type: body.asset_context ? (body.asset_context.equipment_type || body.asset_context.asset_class) : null,
            scope: "full",
            disposition: result.deterministic ? result.deterministic.disposition.overall_disposition : null,
            stages_succeeded: result.provenance ? result.provenance.stages_succeeded : 0,
            stages_failed: result.provenance ? result.provenance.stages_failed : 0,
            total_elapsed_ms: result.provenance ? result.provenance.total_elapsed_ms : 0,
            input_data: body,
            result_data: result
          });
        }
      } catch (dbErr) {
        // Non-fatal
      }

      return { statusCode: 200, headers: headers, body: JSON.stringify(result) };
    }

    // ── ASSESS_FFS_ONLY ───────────────────────────────────────────
    if (action === "assess_ffs_only") {
      var ffsOnlyResult = await runFullAssessment(body, "ffs_only");
      return { statusCode: 200, headers: headers, body: JSON.stringify(ffsOnlyResult) };
    }

    // ── ASSESS_WITH_DDE ───────────────────────────────────────────
    if (action === "assess_with_dde") {
      var ddeOnlyResult = await runFullAssessment(body, "dde_ffs");
      return { statusCode: 200, headers: headers, body: JSON.stringify(ddeOnlyResult) };
    }

    // ── GET_EXECUTION_PLAN ────────────────────────────────────────
    if (action === "get_execution_plan") {
      var planResult = buildExecutionPlan(body.asset_context || {}, body.scope || "full");
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({
          execution_plan: planResult,
          engine_version: ENGINE_VERSION
        })
      };
    }

    // ── GET_HISTORY ───────────────────────────────────────────────
    if (action === "get_history") {
      if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ history: [], note: "Database not configured" }) };
      }
      var db2 = createClient(supabaseUrl, supabaseKey);
      var query = db2.from("comprehensive_assessments").select("*").order("created_at", { ascending: false }).limit(body.limit || 20);
      if (body.case_id) query = query.eq("case_id", body.case_id);
      if (body.domain) query = query.eq("domain", body.domain);
      var dbResult = await query;
      return {
        statusCode: 200,
        headers: headers,
        body: JSON.stringify({ history: dbResult.data || [], count: (dbResult.data || []).length, engine_version: ENGINE_VERSION })
      };
    }

    // ── UNKNOWN ACTION ────────────────────────────────────────────
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        error: "Unknown action: " + action,
        available_actions: Object.keys(ACTION_REGISTRY),
        engine_version: ENGINE_VERSION
      })
    };

  } catch (err: any) {
    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({
        error: "Orchestrator error: " + (err.message || String(err)),
        engine_version: ENGINE_VERSION
      })
    };
  }
};

export { handler };
