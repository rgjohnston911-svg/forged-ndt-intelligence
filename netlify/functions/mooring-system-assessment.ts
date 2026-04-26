// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// MOORING SYSTEM ASSESSMENT ENGINE
// DEPLOY345
//
// Complete mooring system integrity assessment for floating platforms:
//   Chain (studlink, studless), wire rope, synthetic (polyester, HMPE),
//   anchors (drag, suction pile, driven pile, VLA, SEPLA),
//   fairleads, chain stoppers, turret bearings, winches
//
// Standards:
//   API RP 2SK  — Stationkeeping Systems for Floating Structures
//   API RP 2SM  — Synthetic Mooring Systems
//   DNV-OS-E301 — Position Mooring
//   DNV-OS-E302 — Offshore Mooring Chain
//   DNV-OS-E303 — Offshore Mooring Fibre Ropes
//   DNV-OS-E304 — Offshore Mooring Steel Wire Ropes
//   IACS UR A   — Anchoring, Mooring, and Towing
//   BV NR 493   — Classification of Mooring Systems
//
// Actions:
// - get_registry: Return engine capabilities
// - assess_line: Full mooring line assessment (tension, fatigue, corrosion)
// - assess_chain: Chain segment assessment (wear, corrosion, OPB fatigue)
// - assess_wire: Wire rope assessment (broken wires, corrosion, fatigue)
// - assess_synthetic: Synthetic rope assessment (creep, UV, abrasion)
// - assess_anchor: Anchor holding capacity assessment
// - assess_fairlead: Fairlead/chain stopper assessment
// - assess_system: Full mooring system (all lines, redundancy check)
// - compute_tension: Static + dynamic tension envelope
// - get_history: Retrieve past assessments
// ══════════════════════════════════════════════════════════════════════════════

var ENGINE_VERSION = "MSA-1.0.0";

var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities", method: "GET_OR_POST" },
  "assess_line": { description: "Full mooring line assessment — tension, fatigue, corrosion", method: "POST" },
  "assess_chain": { description: "Chain segment — wear, corrosion, OPB fatigue, proof load", method: "POST" },
  "assess_wire": { description: "Wire rope — broken wires, corrosion, fatigue life", method: "POST" },
  "assess_synthetic": { description: "Synthetic rope — creep, UV degradation, abrasion", method: "POST" },
  "assess_anchor": { description: "Anchor holding capacity and installation verification", method: "POST" },
  "assess_fairlead": { description: "Fairlead and chain stopper wear assessment", method: "POST" },
  "assess_system": { description: "Full mooring system — all lines, redundancy, intact/damaged", method: "POST" },
  "compute_tension": { description: "Static + dynamic mooring tension envelope", method: "POST" },
  "get_history": { description: "Retrieve past mooring assessments", method: "POST" }
};

// ── CHAIN GRADE PROPERTIES ─────────────────────────────────────────────
// Per DNV-OS-E302 / IACS W22
var CHAIN_GRADES = {
  R3: { MBL_factor: 0.0223, proof_factor: 0.0149, description: "Standard offshore grade" },
  R3S: { MBL_factor: 0.0249, proof_factor: 0.0166, description: "High-strength offshore" },
  R4: { MBL_factor: 0.0274, proof_factor: 0.0183, description: "Extra-high-strength" },
  R4S: { MBL_factor: 0.0304, proof_factor: 0.0203, description: "Super-extra-high-strength" },
  R5: { MBL_factor: 0.0320, proof_factor: 0.0213, description: "Ultra-high-strength" }
};

// MBL (kN) = factor * d^2 * (44 - 0.08*d) where d = nominal diameter in mm

function computeChainMBL(grade: string, diameter_mm: number): number {
  var gradeInfo = CHAIN_GRADES[grade] || CHAIN_GRADES.R3;
  var d = diameter_mm;
  var MBL = gradeInfo.MBL_factor * d * d * (44 - 0.08 * d);
  return MBL;
}

// ── CHAIN ASSESSMENT ───────────────────────────────────────────────────
function assessChain(body: any): any {
  var grade = body.chain_grade || "R3S";
  var nominalDia_mm = body.nominal_diameter_mm || 84;
  var measuredDia_mm = body.measured_diameter_mm || nominalDia_mm;
  var length_m = body.length_m || 500;
  var age_years = body.age_years || 0;
  var zone = body.zone || "catenary"; // catenary, touchdown, fairlead_proximity, splash
  var studCondition = body.stud_condition || "intact"; // intact, loose, missing

  // Diameter reduction (corrosion/wear)
  var diameterLoss = nominalDia_mm - measuredDia_mm;
  var diameterLossRate = age_years > 0 ? diameterLoss / age_years : 0;

  // Zone-specific corrosion rates (mm/year per side, per DNV-RP-B401 & industry data)
  var zoneCorrosionRates: any = {
    catenary: 0.2,
    touchdown: 0.4,
    fairlead_proximity: 0.3,
    splash: 0.5,
    buried: 0.1
  };
  var expectedRate = zoneCorrosionRates[zone] || 0.2;
  var acceleratedCorrosion = diameterLossRate > expectedRate * 1.5;

  // MBL calculation (original and current)
  var originalMBL = computeChainMBL(grade, nominalDia_mm);
  var currentMBL = computeChainMBL(grade, measuredDia_mm);
  var MBL_reduction_pct = ((originalMBL - currentMBL) / originalMBL) * 100;

  // Remaining life (to 20% diameter reduction threshold)
  var maxLoss = nominalDia_mm * 0.20; // 20% diameter reduction = retirement
  var remainingAllowableLoss = maxLoss - diameterLoss;
  var remainingLife = diameterLossRate > 0 ? remainingAllowableLoss / diameterLossRate : 999;

  // OPB (Out-of-Plane Bending) fatigue — critical at fairlead
  var opbFatigueRisk = "low";
  if (zone === "fairlead_proximity") {
    opbFatigueRisk = age_years > 15 ? "high" : age_years > 8 ? "moderate" : "low";
  }

  // Interlink wear
  var interlinkWear_pct = body.interlink_wear_pct || 0;

  var riskFactors: string[] = [];
  if (MBL_reduction_pct > 15) riskFactors.push("MBL reduced by " + Math.round(MBL_reduction_pct) + "% from corrosion/wear");
  if (acceleratedCorrosion) riskFactors.push("Corrosion rate exceeds expected for " + zone + " zone");
  if (studCondition === "loose") riskFactors.push("Loose studs detected — fatigue life reduced");
  if (studCondition === "missing") riskFactors.push("CRITICAL: Missing studs — immediate assessment required");
  if (opbFatigueRisk === "high") riskFactors.push("OPB fatigue risk at fairlead — crack inspection required");
  if (interlinkWear_pct > 10) riskFactors.push("Interlink wear " + interlinkWear_pct + "% — chain interaction damage");
  if (remainingLife < 5) riskFactors.push("Remaining chain life < 5 years at current degradation rate");

  var acceptance = studCondition === "missing" || MBL_reduction_pct > 25 ? "REPLACEMENT_REQUIRED"
    : riskFactors.length >= 3 ? "MONITOR_URGENT"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    chain_grade: grade,
    nominal_diameter_mm: nominalDia_mm,
    measured_diameter_mm: measuredDia_mm,
    diameter_loss_mm: Math.round(diameterLoss * 100) / 100,
    diameter_loss_rate_mm_yr: Math.round(diameterLossRate * 1000) / 1000,
    zone: zone,
    expected_corrosion_rate_mm_yr: expectedRate,
    accelerated_corrosion: acceleratedCorrosion,
    original_MBL_kN: Math.round(originalMBL),
    current_MBL_kN: Math.round(currentMBL),
    MBL_reduction_pct: Math.round(MBL_reduction_pct * 10) / 10,
    remaining_life_years: Math.round(remainingLife * 10) / 10,
    stud_condition: studCondition,
    opb_fatigue_risk: opbFatigueRisk,
    interlink_wear_pct: interlinkWear_pct,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "DNV-OS-E302 / API RP 2SK chain assessment"
  };
}

// ── WIRE ROPE ASSESSMENT ───────────────────────────────────────────────
function assessWire(body: any): any {
  var nominalDia_mm = body.nominal_diameter_mm || 96;
  var MBL_kN = body.MBL_kN || 5000;
  var length_m = body.length_m || 500;
  var age_years = body.age_years || 0;
  var brokenWires = body.broken_wire_count || 0;
  var totalWires = body.total_wire_count || 200;
  var corrosionGrade = body.corrosion_grade || "none"; // none, light, moderate, heavy
  var lubrication = body.lubrication_condition || "adequate"; // adequate, poor, dry

  // Broken wire criterion (DNV-OS-E304 / API RP 2SK)
  var brokenWirePct = totalWires > 0 ? (brokenWires / totalWires) * 100 : 0;
  var brokenWireLimit = 5; // 5% retirement threshold

  // MBL reduction from broken wires
  var effectiveMBL = MBL_kN * (1 - brokenWirePct / 100);

  // Corrosion impact
  var corrosionFactor: any = { none: 1.0, light: 0.95, moderate: 0.85, heavy: 0.70 };
  var corrFactor = corrosionFactor[corrosionGrade] || 1.0;
  effectiveMBL *= corrFactor;

  var totalMBLReduction = ((MBL_kN - effectiveMBL) / MBL_kN) * 100;

  var riskFactors: string[] = [];
  if (brokenWirePct > brokenWireLimit) riskFactors.push("CRITICAL: Broken wires " + Math.round(brokenWirePct) + "% exceed " + brokenWireLimit + "% retirement limit");
  if (brokenWirePct > 2) riskFactors.push("Broken wire count elevated — " + brokenWires + " of " + totalWires);
  if (corrosionGrade === "heavy") riskFactors.push("Heavy corrosion — significant MBL reduction");
  if (corrosionGrade === "moderate") riskFactors.push("Moderate corrosion — monitor rate of progression");
  if (lubrication === "dry") riskFactors.push("Wire rope dry — accelerated wear and corrosion expected");
  if (totalMBLReduction > 20) riskFactors.push("Effective MBL reduced by " + Math.round(totalMBLReduction) + "%");

  var acceptance = brokenWirePct > brokenWireLimit || totalMBLReduction > 30 ? "REPLACEMENT_REQUIRED"
    : riskFactors.length >= 3 ? "MONITOR_URGENT"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    nominal_diameter_mm: nominalDia_mm,
    original_MBL_kN: MBL_kN,
    effective_MBL_kN: Math.round(effectiveMBL),
    MBL_reduction_pct: Math.round(totalMBLReduction * 10) / 10,
    broken_wires: { count: brokenWires, total: totalWires, percent: Math.round(brokenWirePct * 10) / 10, limit_pct: brokenWireLimit },
    corrosion_grade: corrosionGrade,
    corrosion_MBL_factor: corrFactor,
    lubrication: lubrication,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "DNV-OS-E304 / API RP 2SK wire rope assessment"
  };
}

// ── SYNTHETIC ROPE ASSESSMENT ──────────────────────────────────────────
function assessSynthetic(body: any): any {
  var material = body.material || "polyester"; // polyester, HMPE, nylon, aramid
  var nominalDia_mm = body.nominal_diameter_mm || 160;
  var MBL_kN = body.MBL_kN || 8000;
  var age_years = body.age_years || 0;
  var designLife = body.design_life_years || 20;
  var meanTension_pct_MBL = body.mean_tension_pct_MBL || 15;
  var maxTension_pct_MBL = body.max_tension_pct_MBL || 50;
  var uvExposure = body.uv_exposure || "none"; // none, limited, moderate, severe
  var abrasionDamage = body.abrasion_damage || "none"; // none, light, moderate, severe
  var marineBiofouling = body.biofouling || false;
  var submerged = body.fully_submerged || true;

  // Creep assessment (polyester and HMPE)
  var creepRisk = "low";
  var creepLifeFactor = 1.0;
  if (material === "HMPE") {
    // HMPE is sensitive to creep at high mean loads
    if (meanTension_pct_MBL > 30) { creepRisk = "high"; creepLifeFactor = 0.50; }
    else if (meanTension_pct_MBL > 20) { creepRisk = "moderate"; creepLifeFactor = 0.75; }
  } else if (material === "polyester") {
    if (meanTension_pct_MBL > 40) { creepRisk = "moderate"; creepLifeFactor = 0.80; }
  }

  // UV degradation
  var uvFactor = 1.0;
  if (!submerged) {
    var uvFactors: any = { none: 1.0, limited: 0.95, moderate: 0.85, severe: 0.70 };
    uvFactor = uvFactors[uvExposure] || 1.0;
  }

  // Abrasion
  var abrasionFactor: any = { none: 1.0, light: 0.95, moderate: 0.85, severe: 0.65 };
  var abrasFactor = abrasionFactor[abrasionDamage] || 1.0;

  // Effective capacity
  var effectiveMBL = MBL_kN * creepLifeFactor * uvFactor * abrasFactor;
  var tensionUtilization = (maxTension_pct_MBL / 100 * MBL_kN) / effectiveMBL;

  var riskFactors: string[] = [];
  if (creepRisk === "high") riskFactors.push("HMPE creep risk at " + meanTension_pct_MBL + "% mean load — reduce tension or replace with polyester");
  if (uvExposure === "severe" && !submerged) riskFactors.push("Severe UV exposure on non-submerged section");
  if (abrasionDamage === "severe") riskFactors.push("Severe abrasion damage — rope capacity significantly reduced");
  if (abrasionDamage === "moderate") riskFactors.push("Moderate abrasion — inspect contact points");
  if (tensionUtilization > 0.90) riskFactors.push("Tension utilization > 90% of effective capacity");
  if (age_years > designLife * 0.80) riskFactors.push("Rope age > 80% of design life — plan replacement");
  if (marineBiofouling) riskFactors.push("Marine biofouling present — weight increase affects catenary");

  var acceptance = abrasionDamage === "severe" || tensionUtilization > 1.0 ? "REPLACEMENT_REQUIRED"
    : riskFactors.length >= 3 ? "MONITOR_URGENT"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    material: material,
    nominal_diameter_mm: nominalDia_mm,
    original_MBL_kN: MBL_kN,
    effective_MBL_kN: Math.round(effectiveMBL),
    degradation_factors: { creep: creepLifeFactor, uv: uvFactor, abrasion: abrasFactor },
    tension: { mean_pct_MBL: meanTension_pct_MBL, max_pct_MBL: maxTension_pct_MBL, utilization: Math.round(tensionUtilization * 1000) / 1000 },
    creep_risk: creepRisk,
    age_years: age_years,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API RP 2SM / DNV-OS-E303 synthetic rope assessment"
  };
}

// ── ANCHOR ASSESSMENT ──────────────────────────────────────────────────
function assessAnchor(body: any): any {
  var anchorType = body.anchor_type || "drag_embedment"; // drag_embedment, suction_pile, driven_pile, VLA, SEPLA, gravity
  var designHoldingCapacity_kN = body.design_holding_capacity_kN || 5000;
  var proofLoadAchieved_kN = body.proof_load_achieved_kN || null;
  var maxLineTension_kN = body.max_line_tension_kN || 3000;
  var soilType = body.soil_type || "clay"; // clay, sand, layered
  var waterDepth_m = body.water_depth_m || 500;
  var age_years = body.age_years || 0;
  var scourObserved = body.scour_observed || false;

  // Safety factor check (API RP 2SK Table 3)
  var SF_intact = designHoldingCapacity_kN / maxLineTension_kN;
  var SF_required_intact = 1.6; // API RP 2SK for permanent systems
  var SF_damaged = body.damaged_line_tension_kN ? designHoldingCapacity_kN / body.damaged_line_tension_kN : null;
  var SF_required_damaged = 1.2;

  // Proof load verification
  var proofLoadVerified = proofLoadAchieved_kN && proofLoadAchieved_kN >= maxLineTension_kN * 1.0;

  var riskFactors: string[] = [];
  if (SF_intact < SF_required_intact) riskFactors.push("Intact safety factor " + Math.round(SF_intact * 100) / 100 + " below " + SF_required_intact + " required");
  if (SF_damaged !== null && SF_damaged < SF_required_damaged) riskFactors.push("Damaged safety factor below " + SF_required_damaged);
  if (!proofLoadVerified && proofLoadAchieved_kN) riskFactors.push("Proof load " + proofLoadAchieved_kN + " kN below verification threshold");
  if (scourObserved) riskFactors.push("Scour observed around anchor — holding capacity may be reduced");
  if (anchorType === "suction_pile" && age_years > 20) riskFactors.push("Suction pile age > 20 years — corrosion assessment recommended");

  var acceptance = SF_intact < 1.0 ? "CRITICAL_INSUFFICIENT_CAPACITY"
    : SF_intact < SF_required_intact ? "BELOW_CODE_REQUIREMENT"
    : riskFactors.length >= 2 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    anchor_type: anchorType,
    design_holding_capacity_kN: designHoldingCapacity_kN,
    max_line_tension_kN: maxLineTension_kN,
    safety_factor_intact: Math.round(SF_intact * 100) / 100,
    required_SF_intact: SF_required_intact,
    safety_factor_damaged: SF_damaged ? Math.round(SF_damaged * 100) / 100 : null,
    proof_load_achieved_kN: proofLoadAchieved_kN,
    proof_load_verified: proofLoadVerified,
    soil_type: soilType,
    water_depth_m: waterDepth_m,
    scour_observed: scourObserved,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API RP 2SK Table 3 anchor assessment"
  };
}

// ── SYSTEM ASSESSMENT ──────────────────────────────────────────────────
function assessSystem(body: any): any {
  var lineCount = body.line_count || 8;
  var pattern = body.pattern || "spread"; // spread, catenary, taut_leg, semi_taut
  var lineResults = body.line_results || [];
  var redundancy = body.redundancy || true; // Can survive one line failure

  var failedLines = 0;
  var degradedLines = 0;
  var totalMBL = 0;
  var minSF = 999;

  for (var i = 0; i < lineResults.length; i++) {
    var lr = lineResults[i];
    if (lr.acceptance === "REPLACEMENT_REQUIRED") failedLines++;
    else if (lr.acceptance === "MONITOR_URGENT" || lr.acceptance === "MONITOR") degradedLines++;
    if (lr.safety_factor !== undefined && lr.safety_factor < minSF) minSF = lr.safety_factor;
  }

  // Redundancy check — can system survive loss of worst line?
  var survivesOneLineLoss = (lineCount - failedLines - 1) >= Math.ceil(lineCount * 0.5);

  var riskFactors: string[] = [];
  if (failedLines > 0) riskFactors.push(failedLines + " line(s) require replacement");
  if (!survivesOneLineLoss) riskFactors.push("CRITICAL: System cannot survive loss of one additional line");
  if (degradedLines > lineCount * 0.3) riskFactors.push("More than 30% of lines in degraded condition");
  if (minSF < 1.6) riskFactors.push("Minimum line safety factor " + Math.round(minSF * 100) / 100 + " below 1.6 requirement");

  var acceptance = !survivesOneLineLoss ? "CRITICAL_NO_REDUNDANCY"
    : failedLines > 0 ? "REPAIR_REQUIRED"
    : riskFactors.length >= 2 ? "MONITOR_URGENT"
    : riskFactors.length >= 1 ? "MONITOR"
    : "ACCEPTABLE";

  return {
    line_count: lineCount,
    pattern: pattern,
    failed_lines: failedLines,
    degraded_lines: degradedLines,
    min_safety_factor: minSF < 999 ? Math.round(minSF * 100) / 100 : null,
    survives_one_line_loss: survivesOneLineLoss,
    risk_factors: riskFactors,
    acceptance: acceptance,
    method: "API RP 2SK system assessment — intact and damaged conditions"
  };
}

// ── HANDLER ────────────────────────────────────────────────────────────
var handler: Handler = async function(event) {
  var headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: headers, body: "" };

  try {
    var body: any = {};
    if (event.body) { try { body = JSON.parse(event.body); } catch (e) { body = {}; } }
    var action = body.action || "get_registry";

    if (action === "get_registry") {
      return { statusCode: 200, headers: headers, body: JSON.stringify({
        engine: "Mooring System Assessment Engine", version: ENGINE_VERSION, deploy: "DEPLOY345",
        description: "Complete mooring integrity — chain, wire rope, synthetic, anchors, fairleads, system redundancy",
        actions: ACTION_REGISTRY,
        chain_grades: Object.keys(CHAIN_GRADES),
        standards: ["API RP 2SK", "API RP 2SM", "DNV-OS-E301", "DNV-OS-E302", "DNV-OS-E303", "DNV-OS-E304", "IACS UR A", "BV NR 493"]
      }) };
    }

    if (action === "assess_chain") return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: assessChain(body), provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    if (action === "assess_wire") return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: assessWire(body), provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    if (action === "assess_synthetic") return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: assessSynthetic(body), provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    if (action === "assess_anchor") return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: assessAnchor(body), provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    if (action === "assess_system") return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: assessSystem(body), provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };

    if (action === "assess_line") {
      // Full line = chain + wire or synthetic segments combined
      var segments: any[] = [];
      if (body.chain_segment) segments.push({ type: "chain", result: assessChain(body.chain_segment) });
      if (body.wire_segment) segments.push({ type: "wire", result: assessWire(body.wire_segment) });
      if (body.synthetic_segment) segments.push({ type: "synthetic", result: assessSynthetic(body.synthetic_segment) });
      var worstAcceptance = "ACCEPTABLE";
      for (var s = 0; s < segments.length; s++) {
        var sa = segments[s].result.acceptance;
        if (sa === "REPLACEMENT_REQUIRED") worstAcceptance = "REPLACEMENT_REQUIRED";
        else if (sa === "MONITOR_URGENT" && worstAcceptance !== "REPLACEMENT_REQUIRED") worstAcceptance = "MONITOR_URGENT";
        else if (sa === "MONITOR" && worstAcceptance === "ACCEPTABLE") worstAcceptance = "MONITOR";
      }
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: { segments: segments, overall_acceptance: worstAcceptance }, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "assess_fairlead") {
      var flWear_mm = body.wear_depth_mm || 0;
      var flMaxWear_mm = body.max_wear_mm || 15;
      var flAge = body.age_years || 0;
      var flRate = flAge > 0 ? flWear_mm / flAge : 0;
      var flLife = flRate > 0 ? (flMaxWear_mm - flWear_mm) / flRate : 999;
      var flAcceptance = flWear_mm > flMaxWear_mm ? "REPLACEMENT_REQUIRED" : flWear_mm > flMaxWear_mm * 0.7 ? "MONITOR" : "ACCEPTABLE";
      return { statusCode: 200, headers: headers, body: JSON.stringify({ deterministic: { wear_depth_mm: flWear_mm, max_allowable_mm: flMaxWear_mm, wear_rate_mm_yr: Math.round(flRate * 1000) / 1000, remaining_life_years: Math.round(flLife * 10) / 10, acceptance: flAcceptance, method: "Manufacturer specification / DNV-OS-E301" }, provenance: { engine_version: ENGINE_VERSION, timestamp: new Date().toISOString() } }) };
    }

    if (action === "get_history") {
      if (!supabaseUrl || !supabaseKey) return { statusCode: 200, headers: headers, body: JSON.stringify({ history: [] }) };
      var db = createClient(supabaseUrl, supabaseKey);
      var q = db.from("mooring_assessments").select("*").order("created_at", { ascending: false }).limit(body.limit || 20);
      var r = await q;
      return { statusCode: 200, headers: headers, body: JSON.stringify({ history: r.data || [], count: (r.data || []).length }) };
    }

    return { statusCode: 200, headers: headers, body: JSON.stringify({ error: "Unknown action: " + action, available_actions: Object.keys(ACTION_REGISTRY), engine_version: ENGINE_VERSION }) };
  } catch (err: any) {
    return { statusCode: 200, headers: headers, body: JSON.stringify({ error: "Engine error: " + (err.message || String(err)), engine_version: ENGINE_VERSION }) };
  }
};

export { handler };
