// @ts-nocheck
/**
 * DEPLOY258 - Predictive Remaining Life v1.0.0
 * netlify/functions/predictive-remaining-life.ts
 *
 * The capstone engine. Estimates remaining component life from inspection
 * history, degradation rates, process data, and environmental factors.
 *
 * "Based on the wall loss rate, operating conditions, and 3 similar assets,
 *  this vessel has ~14 months before it drops below minimum thickness."
 *
 * 10 actions:
 *   get_registry
 *   predict_life
 *   record_condition
 *   get_condition_history
 *   get_predictions
 *   get_risk_projection
 *   recommend_schedule
 *   get_schedule
 *   get_asset_dashboard
 *   get_fleet_overview
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "predictive-remaining-life";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// ── helpers ──

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

function getOrg(event) {
  try {
    var auth = event.headers["authorization"] || "";
    if (!auth) return null;
    var token = auth.replace("Bearer ", "");
    var payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_metadata && payload.app_metadata.org_id ? payload.app_metadata.org_id : null;
  } catch (e) {
    return null;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function monthsFromNow(months) {
  var d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// ── audit helper ──

function auditLog(orgId, actionType, assetId, caseId, detail) {
  return supabase.from("prl_audit_events").insert({
    org_id: orgId,
    asset_id: assetId || null,
    case_id: caseId || null,
    action_type: actionType,
    event_json: detail
  });
}

// ── degradation rate calculation ──
// Uses at least 2 condition readings to compute observed rate
// Falls back to model base rate if insufficient data

function computeObservedRate(records) {
  if (!records || records.length < 2) return null;

  // Sort by date ascending
  var sorted = records.slice().sort(function(a, b) {
    return new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime();
  });

  var first = sorted[0];
  var last = sorted[sorted.length - 1];
  var timeDiffMs = new Date(last.inspection_date).getTime() - new Date(first.inspection_date).getTime();
  var timeDiffYears = timeDiffMs / (365.25 * 24 * 60 * 60 * 1000);

  if (timeDiffYears < 0.01) return null; // Less than ~4 days apart

  var valueDiff = first.measured_value - last.measured_value; // Thickness loss = first - last (positive = loss)
  var rate = valueDiff / timeDiffYears;

  // If rate is negative (thickness increased), likely measurement error — use absolute or zero
  if (rate < 0) rate = 0;

  return {
    observed_rate: round2(rate),
    unit: first.measurement_unit + "_per_year",
    data_points: sorted.length,
    span_years: round2(timeDiffYears),
    first_reading: { value: first.measured_value, date: first.inspection_date },
    last_reading: { value: last.measured_value, date: last.inspection_date }
  };
}

// ── risk level classification ──

function classifyRisk(remainingMonths) {
  if (remainingMonths <= 6) return "critical";
  if (remainingMonths <= 12) return "high";
  if (remainingMonths <= 36) return "medium";
  if (remainingMonths <= 60) return "low";
  return "very_low";
}

// ── inspection interval recommendation ──

function recommendInterval(remainingMonths, riskLevel) {
  if (riskLevel === "critical") return { months: 3, type: "focused", priority: "urgent" };
  if (riskLevel === "high") return { months: 6, type: "focused", priority: "high" };
  if (riskLevel === "medium") return { months: 12, type: "general", priority: "routine" };
  if (riskLevel === "low") return { months: 24, type: "general", priority: "routine" };
  return { months: 36, type: "general", priority: "low" };
}

// ── probability of failure curve ──

function computePoF(currentValue, minAllowable, rate, monthsOut) {
  if (rate <= 0) return 0;
  var yearsOut = monthsOut / 12;
  var projectedValue = currentValue - (rate * yearsOut);
  var margin = currentValue - minAllowable;
  if (margin <= 0) return 1.0;

  var consumed = (rate * yearsOut) / margin;
  // S-curve: low early, steep near end of life
  var pof = 1 / (1 + Math.exp(-8 * (consumed - 0.8)));
  return round2(Math.min(Math.max(pof, 0), 1));
}

// ══════════════════════════════════════════════
//  HANDLER
// ══════════════════════════════════════════════

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // ── get_registry ──
    if (action === "get_registry") {
      return ok({
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        status: "operational",
        capabilities: [
          "predict_life",
          "record_condition",
          "get_condition_history",
          "get_predictions",
          "get_risk_projection",
          "recommend_schedule",
          "get_schedule",
          "get_asset_dashboard",
          "get_fleet_overview"
        ],
        damage_mechanisms: [
          "general_corrosion",
          "corrosion_under_insulation",
          "fatigue_cracking",
          "erosion",
          "stress_corrosion_cracking",
          "hydrogen_damage",
          "creep",
          "pitting",
          "microbiologically_influenced_corrosion"
        ],
        prediction_types: ["remaining_life", "next_inspection", "retirement_date"],
        risk_levels: ["critical", "high", "medium", "low", "very_low"],
        description: "Predicts remaining component life from inspection history, degradation models, process data, and environmental factors."
      });
    }

    // ── record_condition ──
    if (action === "record_condition") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.asset_id) return fail(400, "asset_id required");
      if (body.measured_value === undefined) return fail(400, "measured_value required");
      if (!body.measurement_type) return fail(400, "measurement_type required");

      var condRow = {
        org_id: orgId,
        asset_id: body.asset_id,
        case_id: body.case_id || null,
        inspection_date: body.inspection_date || nowISO(),
        measurement_type: body.measurement_type,
        measured_value: body.measured_value,
        measurement_unit: body.measurement_unit || "mm",
        nominal_value: body.nominal_value || null,
        minimum_allowable: body.minimum_allowable || null,
        location_description: body.location_description || null,
        measurement_json: body.metadata || {},
        inspector_id: body.inspector_id || null,
        method: body.method || null
      };

      var insertResult = await supabase.from("asset_condition_records").insert(condRow).select().single();
      if (insertResult.error) return fail(500, insertResult.error.message);

      await auditLog(orgId, "condition_recorded", body.asset_id, body.case_id, {
        measurement_type: body.measurement_type,
        measured_value: body.measured_value,
        unit: condRow.measurement_unit
      });

      return ok({ success: true, record: insertResult.data });
    }

    // ── get_condition_history ──
    if (action === "get_condition_history") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.asset_id) return fail(400, "asset_id required");

      var query = supabase.from("asset_condition_records")
        .select("*")
        .eq("org_id", orgId)
        .eq("asset_id", body.asset_id)
        .order("inspection_date", { ascending: true });

      if (body.measurement_type) query = query.eq("measurement_type", body.measurement_type);
      var limit = body.limit || 200;
      query = query.limit(limit);

      var histResult = await query;
      if (histResult.error) return fail(500, histResult.error.message);

      var observed = computeObservedRate(histResult.data);

      return ok({
        asset_id: body.asset_id,
        records: histResult.data,
        total: histResult.data.length,
        observed_degradation: observed
      });
    }

    // ── predict_life ──
    if (action === "predict_life") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.asset_id) return fail(400, "asset_id required");

      // Get condition history
      var condResult = await supabase.from("asset_condition_records")
        .select("*")
        .eq("org_id", orgId)
        .eq("asset_id", body.asset_id)
        .order("inspection_date", { ascending: true });

      if (condResult.error) return fail(500, condResult.error.message);

      var conditions = condResult.data || [];

      // Determine current value
      var currentValue = body.current_value || null;
      var minAllowable = body.minimum_allowable || null;
      var nominalValue = body.nominal_value || null;

      if (conditions.length > 0) {
        var latest = conditions[conditions.length - 1];
        if (!currentValue) currentValue = latest.measured_value;
        if (!minAllowable) minAllowable = latest.minimum_allowable;
        if (!nominalValue) nominalValue = latest.nominal_value;
      }

      if (currentValue === null) return fail(400, "No condition data and no current_value provided");
      if (minAllowable === null) minAllowable = body.minimum_allowable || 0;

      // Compute observed rate
      var observed = computeObservedRate(conditions);
      var observedRate = observed ? observed.observed_rate : null;

      // Find matching degradation model
      var modelQuery = supabase.from("degradation_models")
        .select("*")
        .eq("active", true);

      if (body.damage_mechanism) modelQuery = modelQuery.eq("damage_mechanism", body.damage_mechanism);
      if (body.asset_type) modelQuery = modelQuery.eq("asset_type", body.asset_type);
      if (body.material_class) modelQuery = modelQuery.eq("material_class", body.material_class);

      // Try org-specific first, then global
      var orgModelResult = await modelQuery.eq("org_id", orgId).limit(5);
      var models = (orgModelResult.data && orgModelResult.data.length > 0) ? orgModelResult.data : [];

      if (models.length === 0) {
        var globalModelResult = await modelQuery.eq("org_id", "00000000-0000-0000-0000-000000000000").limit(5);
        models = globalModelResult.data || [];
      }

      var selectedModel = models.length > 0 ? models[0] : null;
      var modelRate = selectedModel ? selectedModel.base_rate : null;

      // Apply acceleration factors from model
      var adjustedModelRate = modelRate;
      if (selectedModel) {
        adjustedModelRate = modelRate
          * (selectedModel.temperature_factor || 1)
          * (selectedModel.pressure_factor || 1)
          * (selectedModel.cyclic_factor || 1)
          * (selectedModel.environment_factor || 1);
      }

      // Apply process data factors if available
      var processFactors = body.process_factors || {};
      var tempFactor = processFactors.temperature_factor || 1.0;
      var pressFactor = processFactors.pressure_factor || 1.0;
      var cyclicFactor = processFactors.cyclic_factor || 1.0;

      // Final rate: prefer observed, fallback to model, apply process factors
      var finalRate = observedRate || adjustedModelRate || body.assumed_rate || 0.1;
      finalRate = finalRate * tempFactor * pressFactor * cyclicFactor;
      finalRate = round2(finalRate);

      // Compute remaining life
      var remaining = currentValue - minAllowable;
      var remainingLifeYears = finalRate > 0 ? remaining / finalRate : 999;
      var remainingLifeMonths = round2(remainingLifeYears * 12);

      if (remainingLifeMonths < 0) remainingLifeMonths = 0;
      if (remainingLifeMonths > 1200) remainingLifeMonths = 1200; // Cap at 100 years

      // Confidence bounds (+/- 20%)
      var rateLow = finalRate * 1.2; // Faster = shorter life
      var rateHigh = finalRate * 0.8; // Slower = longer life
      var lowerMonths = round2(rateLow > 0 ? (remaining / rateLow) * 12 : 0);
      var upperMonths = round2(rateHigh > 0 ? (remaining / rateHigh) * 12 : 1200);
      if (lowerMonths < 0) lowerMonths = 0;
      if (upperMonths > 1200) upperMonths = 1200;

      // Confidence level
      var confidence = 0.5;
      if (observed && observed.data_points >= 3) confidence = 0.85;
      else if (observed && observed.data_points >= 2) confidence = 0.7;
      else if (selectedModel) confidence = selectedModel.confidence || 0.6;

      var riskLevel = classifyRisk(remainingLifeMonths);
      var retirementDate = monthsFromNow(Math.floor(remainingLifeMonths));
      var nextInspection = recommendInterval(remainingLifeMonths, riskLevel);

      // Build prediction record
      var predRow = {
        org_id: orgId,
        asset_id: body.asset_id,
        case_id: body.case_id || null,
        model_id: selectedModel ? selectedModel.id : null,
        prediction_type: "remaining_life",
        current_value: currentValue,
        minimum_allowable: minAllowable,
        degradation_rate: finalRate,
        degradation_rate_unit: (observed ? observed.unit : (selectedModel ? selectedModel.base_rate_unit : "mm_per_year")),
        remaining_life_months: remainingLifeMonths,
        remaining_life_lower: lowerMonths,
        remaining_life_upper: upperMonths,
        confidence: confidence,
        risk_level: riskLevel,
        next_inspection_recommended: monthsFromNow(nextInspection.months),
        retirement_date_estimated: retirementDate,
        factors_applied: {
          observed_rate: observedRate,
          model_rate: modelRate,
          adjusted_model_rate: adjustedModelRate,
          process_factors: processFactors,
          final_rate: finalRate,
          temp_factor: tempFactor,
          pressure_factor: pressFactor,
          cyclic_factor: cyclicFactor
        },
        prediction_json: {
          model_used: selectedModel ? selectedModel.model_key : "none",
          model_name: selectedModel ? selectedModel.model_name : "direct_observation",
          damage_mechanism: selectedModel ? selectedModel.damage_mechanism : (body.damage_mechanism || "unknown"),
          condition_readings_used: conditions.length,
          observed_degradation: observed,
          nominal_value: nominalValue,
          margin_remaining: round2(remaining),
          margin_percent: nominalValue ? round2((remaining / (nominalValue - minAllowable)) * 100) : null
        },
        engine_version: ENGINE_VERSION
      };

      var predInsert = await supabase.from("life_predictions").insert(predRow).select().single();
      if (predInsert.error) return fail(500, predInsert.error.message);

      // Generate risk projection curve
      var projections = [];
      var projMonths = [0, 3, 6, 12, 18, 24, 36, 48, 60];
      for (var pi = 0; pi < projMonths.length; pi++) {
        var mo = projMonths[pi];
        if (mo > remainingLifeMonths * 1.5) break; // Don't project past 150% of life
        var projValue = round2(currentValue - (finalRate * (mo / 12)));
        var pof = computePoF(currentValue, minAllowable, finalRate, mo);
        var projRisk = classifyRisk(remainingLifeMonths - mo);
        var riskScore = round2(pof * 100);

        projections.push({
          org_id: orgId,
          asset_id: body.asset_id,
          prediction_id: predInsert.data.id,
          projection_date: monthsFromNow(mo),
          months_from_now: mo,
          projected_value: projValue,
          projected_risk_score: riskScore,
          risk_level: projRisk,
          probability_of_failure: pof,
          consequence_category: body.consequence_category || "production_loss",
          projection_json: {},
          engine_version: ENGINE_VERSION
        });
      }

      if (projections.length > 0) {
        await supabase.from("risk_projections").insert(projections);
      }

      // Create schedule recommendation
      var schedRow = {
        org_id: orgId,
        asset_id: body.asset_id,
        prediction_id: predInsert.data.id,
        recommended_date: monthsFromNow(nextInspection.months),
        inspection_type: nextInspection.type,
        method_recommended: body.method || null,
        priority: nextInspection.priority,
        reason: "Remaining life: " + remainingLifeMonths + " months. Risk: " + riskLevel + ". Rate: " + finalRate + " " + predRow.degradation_rate_unit + ".",
        interval_months: nextInspection.months,
        schedule_json: { risk_level: riskLevel, confidence: confidence },
        engine_version: ENGINE_VERSION
      };

      await supabase.from("inspection_schedule_recommendations").insert(schedRow);

      await auditLog(orgId, "life_predicted", body.asset_id, body.case_id, {
        remaining_months: remainingLifeMonths,
        risk_level: riskLevel,
        rate: finalRate,
        confidence: confidence,
        model: selectedModel ? selectedModel.model_key : "observed"
      });

      return ok({
        prediction: predInsert.data,
        summary: {
          asset_id: body.asset_id,
          current_value: currentValue,
          minimum_allowable: minAllowable,
          nominal_value: nominalValue,
          margin_remaining: round2(remaining),
          degradation_rate: finalRate,
          rate_source: observedRate ? "observed (" + (observed ? observed.data_points : 0) + " readings)" : (selectedModel ? "model: " + selectedModel.model_key : "assumed"),
          remaining_life_months: remainingLifeMonths,
          remaining_life_range: lowerMonths + " - " + upperMonths + " months",
          confidence: round2(confidence * 100) + "%",
          risk_level: riskLevel,
          retirement_estimated: retirementDate,
          next_inspection: {
            date: monthsFromNow(nextInspection.months),
            type: nextInspection.type,
            priority: nextInspection.priority,
            interval_months: nextInspection.months
          }
        },
        risk_projection: projections.length > 0 ? projections.map(function(p) {
          return { months: p.months_from_now, value: p.projected_value, pof: p.probability_of_failure, risk: p.risk_level };
        }) : [],
        assessment: remainingLifeMonths <= 6
          ? "CRITICAL: Less than 6 months remaining life. Immediate action required."
          : remainingLifeMonths <= 12
          ? "HIGH RISK: Less than 12 months remaining. Schedule focused inspection and plan repair/replacement."
          : remainingLifeMonths <= 36
          ? "MEDIUM RISK: 1-3 years remaining. Continue monitoring at recommended intervals."
          : "LOW RISK: Over 3 years remaining life. Routine inspection schedule adequate."
      });
    }

    // ── get_predictions ──
    if (action === "get_predictions") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var query = supabase.from("life_predictions")
        .select("*")
        .eq("org_id", orgId)
        .order("computed_at", { ascending: false });

      if (body.asset_id) query = query.eq("asset_id", body.asset_id);
      if (body.case_id) query = query.eq("case_id", body.case_id);
      if (body.risk_level) query = query.eq("risk_level", body.risk_level);
      var limit = body.limit || 50;
      query = query.limit(limit);

      var predResult = await query;
      if (predResult.error) return fail(500, predResult.error.message);

      return ok({ predictions: predResult.data, total: predResult.data.length });
    }

    // ── get_risk_projection ──
    if (action === "get_risk_projection") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var query = supabase.from("risk_projections")
        .select("*")
        .eq("org_id", orgId)
        .order("months_from_now", { ascending: true });

      if (body.asset_id) query = query.eq("asset_id", body.asset_id);
      if (body.prediction_id) query = query.eq("prediction_id", body.prediction_id);

      var projResult = await query;
      if (projResult.error) return fail(500, projResult.error.message);

      return ok({ projections: projResult.data, total: projResult.data.length });
    }

    // ── recommend_schedule ──
    if (action === "recommend_schedule") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.asset_id) return fail(400, "asset_id required");

      // Get latest prediction
      var latestPred = await supabase.from("life_predictions")
        .select("*")
        .eq("org_id", orgId)
        .eq("asset_id", body.asset_id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPred.error) return fail(500, latestPred.error.message);
      if (!latestPred.data) return fail(404, "No prediction found for this asset. Run predict_life first.");

      var pred = latestPred.data;
      var interval = recommendInterval(pred.remaining_life_months, pred.risk_level);

      var schedRow = {
        org_id: orgId,
        asset_id: body.asset_id,
        prediction_id: pred.id,
        recommended_date: monthsFromNow(interval.months),
        inspection_type: interval.type,
        method_recommended: body.method || null,
        priority: interval.priority,
        reason: "Based on prediction: " + pred.remaining_life_months + " months remaining, risk " + pred.risk_level + ", rate " + pred.degradation_rate + " " + pred.degradation_rate_unit,
        interval_months: interval.months,
        schedule_json: { risk_level: pred.risk_level, remaining_months: pred.remaining_life_months },
        engine_version: ENGINE_VERSION
      };

      var schedInsert = await supabase.from("inspection_schedule_recommendations").insert(schedRow).select().single();
      if (schedInsert.error) return fail(500, schedInsert.error.message);

      return ok({ recommendation: schedInsert.data });
    }

    // ── get_schedule ──
    if (action === "get_schedule") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var query = supabase.from("inspection_schedule_recommendations")
        .select("*")
        .eq("org_id", orgId)
        .order("recommended_date", { ascending: true });

      if (body.asset_id) query = query.eq("asset_id", body.asset_id);
      if (body.priority) query = query.eq("priority", body.priority);
      if (body.upcoming_only) query = query.gte("recommended_date", nowISO());
      var limit = body.limit || 100;
      query = query.limit(limit);

      var schedResult = await query;
      if (schedResult.error) return fail(500, schedResult.error.message);

      // Summary
      var byPriority = { urgent: 0, high: 0, routine: 0, low: 0 };
      for (var si = 0; si < schedResult.data.length; si++) {
        var p = schedResult.data[si].priority;
        byPriority[p] = (byPriority[p] || 0) + 1;
      }

      return ok({
        schedule: schedResult.data,
        total: schedResult.data.length,
        by_priority: byPriority
      });
    }

    // ── get_asset_dashboard ──
    if (action === "get_asset_dashboard") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.asset_id) return fail(400, "asset_id required");

      // Latest prediction
      var predResult = await supabase.from("life_predictions")
        .select("*")
        .eq("org_id", orgId)
        .eq("asset_id", body.asset_id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Condition history
      var condResult = await supabase.from("asset_condition_records")
        .select("*")
        .eq("org_id", orgId)
        .eq("asset_id", body.asset_id)
        .order("inspection_date", { ascending: true });

      // Risk projections (latest)
      var projResult = { data: [] };
      if (predResult.data) {
        projResult = await supabase.from("risk_projections")
          .select("*")
          .eq("prediction_id", predResult.data.id)
          .order("months_from_now", { ascending: true });
      }

      // Upcoming schedule
      var schedResult = await supabase.from("inspection_schedule_recommendations")
        .select("*")
        .eq("org_id", orgId)
        .eq("asset_id", body.asset_id)
        .gte("recommended_date", nowISO())
        .order("recommended_date", { ascending: true })
        .limit(5);

      var observed = computeObservedRate(condResult.data || []);

      return ok({
        asset_id: body.asset_id,
        latest_prediction: predResult.data || null,
        condition_history: {
          records: (condResult.data || []).length,
          observed_degradation: observed,
          latest_reading: condResult.data && condResult.data.length > 0 ? condResult.data[condResult.data.length - 1] : null
        },
        risk_curve: (projResult.data || []).map(function(p) {
          return { months: p.months_from_now, value: p.projected_value, pof: p.probability_of_failure, risk: p.risk_level };
        }),
        upcoming_inspections: schedResult.data || [],
        status: predResult.data
          ? { risk_level: predResult.data.risk_level, remaining_months: predResult.data.remaining_life_months, confidence: predResult.data.confidence }
          : { risk_level: "unknown", remaining_months: null, confidence: null }
      });
    }

    // ── get_fleet_overview ──
    if (action === "get_fleet_overview") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      // Get all latest predictions (one per asset)
      var allPreds = await supabase.from("life_predictions")
        .select("*")
        .eq("org_id", orgId)
        .order("computed_at", { ascending: false })
        .limit(500);

      if (allPreds.error) return fail(500, allPreds.error.message);

      // Deduplicate to latest per asset
      var assetMap = {};
      var preds = allPreds.data || [];
      for (var ai = 0; ai < preds.length; ai++) {
        var p = preds[ai];
        if (!assetMap[p.asset_id]) {
          assetMap[p.asset_id] = p;
        }
      }

      var assets = [];
      var byRisk = { critical: 0, high: 0, medium: 0, low: 0, very_low: 0 };
      var totalRemaining = 0;
      var assetCount = 0;

      for (var assetId in assetMap) {
        var pred = assetMap[assetId];
        assets.push({
          asset_id: assetId,
          risk_level: pred.risk_level,
          remaining_months: pred.remaining_life_months,
          degradation_rate: pred.degradation_rate,
          confidence: pred.confidence,
          last_computed: pred.computed_at
        });
        byRisk[pred.risk_level] = (byRisk[pred.risk_level] || 0) + 1;
        totalRemaining += pred.remaining_life_months;
        assetCount++;
      }

      // Sort: critical first
      var riskOrder = { critical: 0, high: 1, medium: 2, low: 3, very_low: 4 };
      assets.sort(function(a, b) {
        return (riskOrder[a.risk_level] || 5) - (riskOrder[b.risk_level] || 5);
      });

      // Upcoming urgent inspections
      var urgentScheds = await supabase.from("inspection_schedule_recommendations")
        .select("*")
        .eq("org_id", orgId)
        .in("priority", ["urgent", "high"])
        .gte("recommended_date", nowISO())
        .order("recommended_date", { ascending: true })
        .limit(10);

      return ok({
        fleet_summary: {
          total_assets_monitored: assetCount,
          by_risk_level: byRisk,
          average_remaining_life_months: assetCount > 0 ? round2(totalRemaining / assetCount) : 0,
          assets_under_12_months: byRisk.critical + byRisk.high,
          assets_under_36_months: byRisk.critical + byRisk.high + byRisk.medium
        },
        assets: assets.slice(0, 50),
        urgent_inspections: urgentScheds.data || [],
        assessment: (byRisk.critical > 0)
          ? "CRITICAL: " + byRisk.critical + " asset(s) with less than 6 months remaining life. Immediate action required."
          : (byRisk.high > 0)
          ? "HIGH PRIORITY: " + byRisk.high + " asset(s) approaching end of life within 12 months."
          : "Fleet health is within acceptable parameters."
      });
    }

    return fail(400, "Unknown action: " + action + ". Valid actions: get_registry, predict_life, record_condition, get_condition_history, get_predictions, get_risk_projection, recommend_schedule, get_schedule, get_asset_dashboard, get_fleet_overview");

  } catch (err) {
    return fail(500, String(err && err.message ? err.message : err));
  }
};
