// @ts-nocheck
/**
 * DEPLOY257 - Process Data Integration v1.0.0
 * netlify/functions/process-data-integration.ts
 *
 * Connects live sensor/process data to inspection cases.
 * Correlates operating conditions with failure modes.
 * "This pipe was running at 450F for 6 months before the crack appeared."
 *
 * 10 actions:
 *   get_registry
 *   register_source
 *   ingest_readings
 *   get_sources
 *   get_readings
 *   detect_exceedances
 *   correlate_case
 *   get_exposure_summary
 *   get_exceedance_history
 *   get_case_correlations
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "process-data-integration";
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

function safeNum(v, fallback) {
  var n = Number(v);
  if (isNaN(n)) return fallback;
  return n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── audit helper ──

function auditLog(orgId, actionType, sourceId, caseId, detail) {
  return supabase.from("process_audit_events").insert({
    org_id: orgId,
    source_id: sourceId || null,
    case_id: caseId || null,
    action_type: actionType,
    event_json: detail
  });
}

// ── exceedance detection ──

function classifyExceedance(value, source) {
  if (source.critical_high !== null && source.critical_high !== undefined && value >= source.critical_high) {
    return { type: "critical_high", threshold: source.critical_high, severity: "critical" };
  }
  if (source.critical_low !== null && source.critical_low !== undefined && value <= source.critical_low) {
    return { type: "critical_low", threshold: source.critical_low, severity: "critical" };
  }
  if (source.alarm_high !== null && source.alarm_high !== undefined && value >= source.alarm_high) {
    return { type: "alarm_high", threshold: source.alarm_high, severity: "high" };
  }
  if (source.alarm_low !== null && source.alarm_low !== undefined && value <= source.alarm_low) {
    return { type: "alarm_low", threshold: source.alarm_low, severity: "high" };
  }
  if (source.normal_max !== null && source.normal_max !== undefined && value > source.normal_max) {
    return { type: "above_normal", threshold: source.normal_max, severity: "medium" };
  }
  if (source.normal_min !== null && source.normal_min !== undefined && value < source.normal_min) {
    return { type: "below_normal", threshold: source.normal_min, severity: "medium" };
  }
  return null;
}

// ── statistics helpers ──

function computeStats(values) {
  if (!values || values.length === 0) return { count: 0, avg: 0, min: 0, max: 0, std: 0 };
  var sum = 0;
  var mn = values[0];
  var mx = values[0];
  for (var i = 0; i < values.length; i++) {
    sum += values[i];
    if (values[i] < mn) mn = values[i];
    if (values[i] > mx) mx = values[i];
  }
  var avg = sum / values.length;
  var variance = 0;
  for (var j = 0; j < values.length; j++) {
    variance += (values[j] - avg) * (values[j] - avg);
  }
  variance = variance / values.length;
  return { count: values.length, avg: round2(avg), min: round2(mn), max: round2(mx), std: round2(Math.sqrt(variance)) };
}

function classifyOperatingRegime(value, source) {
  if (source.critical_high !== null && source.critical_high !== undefined && value >= source.critical_high) return "critical_high";
  if (source.critical_low !== null && source.critical_low !== undefined && value <= source.critical_low) return "critical_low";
  if (source.alarm_high !== null && source.alarm_high !== undefined && value >= source.alarm_high) return "alarm_high";
  if (source.alarm_low !== null && source.alarm_low !== undefined && value <= source.alarm_low) return "alarm_low";
  if (source.normal_max !== null && source.normal_max !== undefined && value > source.normal_max) return "above_normal";
  if (source.normal_min !== null && source.normal_min !== undefined && value < source.normal_min) return "below_normal";
  return "normal";
}

// ── severity scoring ──

function computeSeverityScore(stats, exceedanceCount, regimeBreakdown) {
  var score = 0;
  if (exceedanceCount > 0) score += Math.min(exceedanceCount * 5, 40);
  var criticalPct = ((regimeBreakdown["critical_high"] || 0) + (regimeBreakdown["critical_low"] || 0));
  var alarmPct = ((regimeBreakdown["alarm_high"] || 0) + (regimeBreakdown["alarm_low"] || 0));
  score += criticalPct * 3;
  score += alarmPct * 1.5;
  if (stats.std > 0 && stats.avg > 0) {
    var cv = stats.std / Math.abs(stats.avg);
    if (cv > 0.5) score += 10;
    else if (cv > 0.3) score += 5;
  }
  return Math.min(round2(score), 100);
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
          "register_source",
          "ingest_readings",
          "get_sources",
          "get_readings",
          "detect_exceedances",
          "correlate_case",
          "get_exposure_summary",
          "get_exceedance_history",
          "get_case_correlations"
        ],
        source_types: ["sensor", "historian", "manual", "scada", "dcs", "iot"],
        data_types: ["numeric", "boolean", "string"],
        exceedance_types: ["critical_high", "critical_low", "alarm_high", "alarm_low", "above_normal", "below_normal"],
        correlation_types: ["temporal", "causal", "coincidental", "environmental"],
        description: "Connects live sensor and process data to inspection cases. Correlates operating conditions with failure modes."
      });
    }

    // ── register_source ──
    if (action === "register_source") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.source_key) return fail(400, "source_key required");
      if (!body.source_name) return fail(400, "source_name required");

      var sourceRow = {
        org_id: orgId,
        source_key: body.source_key,
        source_name: body.source_name,
        source_type: body.source_type || "sensor",
        asset_id: body.asset_id || null,
        asset_name: body.asset_name || null,
        location: body.location || null,
        unit_of_measure: body.unit_of_measure || "unknown",
        data_type: body.data_type || "numeric",
        normal_min: body.normal_min !== undefined ? body.normal_min : null,
        normal_max: body.normal_max !== undefined ? body.normal_max : null,
        alarm_low: body.alarm_low !== undefined ? body.alarm_low : null,
        alarm_high: body.alarm_high !== undefined ? body.alarm_high : null,
        critical_low: body.critical_low !== undefined ? body.critical_low : null,
        critical_high: body.critical_high !== undefined ? body.critical_high : null,
        sampling_interval_seconds: body.sampling_interval_seconds || null,
        tags: body.tags || [],
        metadata_json: body.metadata || {},
        active: true
      };

      var insertResult = await supabase.from("process_data_sources").insert(sourceRow).select().single();
      if (insertResult.error) return fail(500, insertResult.error.message);

      await auditLog(orgId, "source_registered", insertResult.data.id, null, {
        source_key: body.source_key,
        source_type: sourceRow.source_type,
        asset_id: sourceRow.asset_id
      });

      return ok({ success: true, source: insertResult.data });
    }

    // ── ingest_readings ──
    if (action === "ingest_readings") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.source_id) return fail(400, "source_id required");
      if (!body.readings || !Array.isArray(body.readings) || body.readings.length === 0) {
        return fail(400, "readings array required (each: { value, timestamp })");
      }

      // Validate source exists
      var sourceCheck = await supabase.from("process_data_sources").select("*").eq("id", body.source_id).eq("org_id", orgId).maybeSingle();
      if (sourceCheck.error) return fail(500, sourceCheck.error.message);
      if (!sourceCheck.data) return fail(404, "source not found");

      var sourceData = sourceCheck.data;
      var rows = [];
      var exceedances = [];

      for (var ri = 0; ri < body.readings.length; ri++) {
        var r = body.readings[ri];
        var val = safeNum(r.value, null);
        if (val === null) continue;

        rows.push({
          org_id: orgId,
          source_id: body.source_id,
          reading_value: val,
          reading_quality: r.quality || "good",
          reading_timestamp: r.timestamp || nowISO(),
          raw_json: r.raw || {}
        });

        // Check for exceedances
        var exc = classifyExceedance(val, sourceData);
        if (exc) {
          exceedances.push({
            org_id: orgId,
            source_id: body.source_id,
            exceedance_type: exc.type,
            threshold_value: exc.threshold,
            peak_value: val,
            severity: exc.severity,
            start_at: r.timestamp || nowISO(),
            reading_count: 1,
            event_json: { reading_value: val, source_key: sourceData.source_key, unit: sourceData.unit_of_measure }
          });
        }
      }

      // Batch insert readings (max 500 at a time)
      var totalInserted = 0;
      var batchSize = 500;
      for (var bi = 0; bi < rows.length; bi += batchSize) {
        var batch = rows.slice(bi, bi + batchSize);
        var batchResult = await supabase.from("process_data_readings").insert(batch);
        if (batchResult.error) return fail(500, "Batch insert error: " + batchResult.error.message);
        totalInserted += batch.length;
      }

      // Insert exceedances
      var excInserted = 0;
      if (exceedances.length > 0) {
        var excResult = await supabase.from("process_exceedance_events").insert(exceedances);
        if (!excResult.error) excInserted = exceedances.length;
      }

      await auditLog(orgId, "readings_ingested", body.source_id, null, {
        readings_count: totalInserted,
        exceedances_detected: excInserted,
        source_key: sourceData.source_key
      });

      return ok({
        success: true,
        readings_ingested: totalInserted,
        exceedances_detected: excInserted,
        source: { id: sourceData.id, source_key: sourceData.source_key, source_name: sourceData.source_name }
      });
    }

    // ── get_sources ──
    if (action === "get_sources") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var query = supabase.from("process_data_sources").select("*").eq("org_id", orgId).order("created_at", { ascending: false });

      if (body.source_type) query = query.eq("source_type", body.source_type);
      if (body.asset_id) query = query.eq("asset_id", body.asset_id);
      if (body.active !== undefined) query = query.eq("active", body.active);

      var limit = body.limit || 100;
      query = query.limit(limit);

      var sourcesResult = await query;
      if (sourcesResult.error) return fail(500, sourcesResult.error.message);

      return ok({ sources: sourcesResult.data, total: sourcesResult.data.length });
    }

    // ── get_readings ──
    if (action === "get_readings") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.source_id) return fail(400, "source_id required");

      var query = supabase.from("process_data_readings")
        .select("*")
        .eq("org_id", orgId)
        .eq("source_id", body.source_id)
        .order("reading_timestamp", { ascending: false });

      if (body.start_time) query = query.gte("reading_timestamp", body.start_time);
      if (body.end_time) query = query.lte("reading_timestamp", body.end_time);

      var limit = body.limit || 500;
      query = query.limit(limit);

      var readingsResult = await query;
      if (readingsResult.error) return fail(500, readingsResult.error.message);

      // Compute inline stats
      var values = [];
      for (var vi = 0; vi < readingsResult.data.length; vi++) {
        values.push(readingsResult.data[vi].reading_value);
      }
      var stats = computeStats(values);

      return ok({
        readings: readingsResult.data,
        total: readingsResult.data.length,
        statistics: stats
      });
    }

    // ── detect_exceedances ──
    if (action === "detect_exceedances") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.source_id) return fail(400, "source_id required");

      // Get source config
      var srcCheck = await supabase.from("process_data_sources").select("*").eq("id", body.source_id).eq("org_id", orgId).maybeSingle();
      if (srcCheck.error) return fail(500, srcCheck.error.message);
      if (!srcCheck.data) return fail(404, "source not found");
      var src = srcCheck.data;

      // Get readings in window
      var windowHours = body.window_hours || 24;
      var windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

      var rdQuery = supabase.from("process_data_readings")
        .select("*")
        .eq("source_id", body.source_id)
        .eq("org_id", orgId)
        .gte("reading_timestamp", windowStart)
        .order("reading_timestamp", { ascending: true });

      var rdResult = await rdQuery;
      if (rdResult.error) return fail(500, rdResult.error.message);

      var newExceedances = [];
      for (var ei = 0; ei < rdResult.data.length; ei++) {
        var rdg = rdResult.data[ei];
        var exc = classifyExceedance(rdg.reading_value, src);
        if (exc) {
          newExceedances.push({
            org_id: orgId,
            source_id: body.source_id,
            exceedance_type: exc.type,
            threshold_value: exc.threshold,
            peak_value: rdg.reading_value,
            severity: exc.severity,
            start_at: rdg.reading_timestamp,
            reading_count: 1,
            event_json: { reading_id: rdg.id, value: rdg.reading_value, unit: src.unit_of_measure }
          });
        }
      }

      // Insert new exceedances
      var inserted = 0;
      if (newExceedances.length > 0) {
        var insResult = await supabase.from("process_exceedance_events").insert(newExceedances);
        if (!insResult.error) inserted = newExceedances.length;
      }

      var bySeverity = { critical: 0, high: 0, medium: 0 };
      for (var si = 0; si < newExceedances.length; si++) {
        var sev = newExceedances[si].severity;
        bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      }

      await auditLog(orgId, "exceedances_detected", body.source_id, null, {
        window_hours: windowHours,
        readings_scanned: rdResult.data.length,
        exceedances_found: newExceedances.length,
        by_severity: bySeverity
      });

      return ok({
        source: { id: src.id, source_key: src.source_key, source_name: src.source_name },
        window_hours: windowHours,
        readings_scanned: rdResult.data.length,
        exceedances_found: newExceedances.length,
        by_severity: bySeverity,
        exceedances: newExceedances.slice(0, 50)
      });
    }

    // ── correlate_case ──
    if (action === "correlate_case") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.case_id) return fail(400, "case_id required");

      // Get case to find asset and time window
      var caseCheck = await supabase.from("inspection_cases").select("*").eq("id", body.case_id).maybeSingle();
      if (caseCheck.error) return fail(500, caseCheck.error.message);
      if (!caseCheck.data) return fail(404, "case not found");
      var caseData = caseCheck.data;

      // Determine time window: default 30 days before case creation
      var lookbackDays = body.lookback_days || 30;
      var caseDate = new Date(caseData.created_at);
      var windowStart = body.window_start || new Date(caseDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
      var windowEnd = body.window_end || caseData.created_at;

      // Find sources for this asset
      var sourceQuery = supabase.from("process_data_sources").select("*").eq("org_id", orgId).eq("active", true);

      var assetId = body.asset_id || caseData.asset_id || null;
      if (assetId) {
        sourceQuery = sourceQuery.eq("asset_id", assetId);
      }

      var sourcesResult = await sourceQuery;
      if (sourcesResult.error) return fail(500, sourcesResult.error.message);

      // If no specific asset sources, get all org sources
      var sources = sourcesResult.data || [];
      if (sources.length === 0 && assetId) {
        var allSourcesResult = await supabase.from("process_data_sources").select("*").eq("org_id", orgId).eq("active", true).limit(20);
        sources = (allSourcesResult.data || []);
      }

      var correlations = [];

      for (var sci = 0; sci < sources.length; sci++) {
        var src = sources[sci];

        // Get readings in window
        var rdResult = await supabase.from("process_data_readings")
          .select("reading_value, reading_timestamp")
          .eq("source_id", src.id)
          .eq("org_id", orgId)
          .gte("reading_timestamp", windowStart)
          .lte("reading_timestamp", windowEnd)
          .order("reading_timestamp", { ascending: true })
          .limit(2000);

        if (rdResult.error || !rdResult.data || rdResult.data.length === 0) continue;

        var values = [];
        var regimeCounts = {};
        for (var rdi = 0; rdi < rdResult.data.length; rdi++) {
          var v = rdResult.data[rdi].reading_value;
          values.push(v);
          var regime = classifyOperatingRegime(v, src);
          regimeCounts[regime] = (regimeCounts[regime] || 0) + 1;
        }

        var stats = computeStats(values);

        // Convert regime counts to percentages
        var regimePcts = {};
        var totalReadings = values.length;
        for (var rk in regimeCounts) {
          regimePcts[rk] = round2((regimeCounts[rk] / totalReadings) * 100);
        }

        // Count exceedances in window
        var excCount = await supabase.from("process_exceedance_events")
          .select("id", { count: "exact", head: true })
          .eq("source_id", src.id)
          .eq("org_id", orgId)
          .gte("start_at", windowStart)
          .lte("start_at", windowEnd);

        var exceedanceCount = excCount.count || 0;

        // Compute correlation score: higher if many readings in abnormal regimes
        var abnormalPct = 100 - (regimePcts["normal"] || 0);
        var correlationScore = round2(Math.min(abnormalPct + (exceedanceCount * 10), 100));

        var correlationType = "temporal";
        if (correlationScore > 60) correlationType = "causal";
        else if (correlationScore > 30) correlationType = "coincidental";

        var operatingRegime = "normal";
        if (regimePcts["critical_high"] > 5 || regimePcts["critical_low"] > 5) operatingRegime = "critical";
        else if (regimePcts["alarm_high"] > 10 || regimePcts["alarm_low"] > 10) operatingRegime = "alarm";
        else if (abnormalPct > 20) operatingRegime = "stressed";

        var corrRow = {
          org_id: orgId,
          case_id: body.case_id,
          source_id: src.id,
          correlation_type: correlationType,
          correlation_score: correlationScore,
          window_start: windowStart,
          window_end: windowEnd,
          avg_value: stats.avg,
          min_value: stats.min,
          max_value: stats.max,
          std_deviation: stats.std,
          exceedance_count: exceedanceCount,
          operating_regime: operatingRegime,
          correlation_json: {
            source_key: src.source_key,
            source_name: src.source_name,
            unit: src.unit_of_measure,
            readings_analyzed: totalReadings,
            regime_breakdown: regimePcts,
            statistics: stats
          }
        };

        var corrInsert = await supabase.from("process_case_correlations").insert(corrRow).select().single();
        if (!corrInsert.error) {
          correlations.push(corrInsert.data);
        }
      }

      // Build exposure summary
      var severityScore = 0;
      var totalExceedances = 0;
      for (var ci = 0; ci < correlations.length; ci++) {
        totalExceedances += correlations[ci].exceedance_count || 0;
        severityScore = Math.max(severityScore, correlations[ci].correlation_score || 0);
      }

      if (correlations.length > 0) {
        var exposureRow = {
          org_id: orgId,
          asset_id: assetId,
          case_id: body.case_id,
          summary_type: "case",
          period_start: windowStart,
          period_end: windowEnd,
          exceedance_count: totalExceedances,
          operating_regime_breakdown: {},
          exposure_json: {
            correlations_count: correlations.length,
            lookback_days: lookbackDays,
            top_correlation_score: severityScore
          },
          severity_score: severityScore,
          engine_version: ENGINE_VERSION
        };

        await supabase.from("process_exposure_summaries").insert(exposureRow);
      }

      await auditLog(orgId, "case_correlated", null, body.case_id, {
        sources_analyzed: sources.length,
        correlations_created: correlations.length,
        total_exceedances: totalExceedances,
        top_severity_score: severityScore
      });

      return ok({
        case_id: body.case_id,
        asset_id: assetId,
        window: { start: windowStart, end: windowEnd, lookback_days: lookbackDays },
        sources_analyzed: sources.length,
        correlations: correlations,
        summary: {
          total_correlations: correlations.length,
          total_exceedances: totalExceedances,
          severity_score: severityScore,
          top_regime: severityScore > 60 ? "critical/alarm conditions detected" : severityScore > 30 ? "stressed operating conditions" : "normal operating conditions"
        }
      });
    }

    // ── get_exposure_summary ──
    if (action === "get_exposure_summary") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var query = supabase.from("process_exposure_summaries").select("*").eq("org_id", orgId).order("computed_at", { ascending: false });

      if (body.case_id) query = query.eq("case_id", body.case_id);
      if (body.asset_id) query = query.eq("asset_id", body.asset_id);
      if (body.summary_type) query = query.eq("summary_type", body.summary_type);

      var limit = body.limit || 50;
      query = query.limit(limit);

      var expResult = await query;
      if (expResult.error) return fail(500, expResult.error.message);

      return ok({ summaries: expResult.data, total: expResult.data.length });
    }

    // ── get_exceedance_history ──
    if (action === "get_exceedance_history") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var query = supabase.from("process_exceedance_events").select("*").eq("org_id", orgId).order("start_at", { ascending: false });

      if (body.source_id) query = query.eq("source_id", body.source_id);
      if (body.severity) query = query.eq("severity", body.severity);
      if (body.exceedance_type) query = query.eq("exceedance_type", body.exceedance_type);
      if (body.start_time) query = query.gte("start_at", body.start_time);
      if (body.end_time) query = query.lte("start_at", body.end_time);
      if (body.acknowledged !== undefined) query = query.eq("acknowledged", body.acknowledged);

      var limit = body.limit || 100;
      query = query.limit(limit);

      var excResult = await query;
      if (excResult.error) return fail(500, excResult.error.message);

      // Summary stats
      var bySeverity = { critical: 0, high: 0, medium: 0 };
      var byType = {};
      for (var ei = 0; ei < excResult.data.length; ei++) {
        var e = excResult.data[ei];
        bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
        byType[e.exceedance_type] = (byType[e.exceedance_type] || 0) + 1;
      }

      return ok({
        exceedances: excResult.data,
        total: excResult.data.length,
        by_severity: bySeverity,
        by_type: byType
      });
    }

    // ── get_case_correlations ──
    if (action === "get_case_correlations") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");
      if (!body.case_id) return fail(400, "case_id required");

      var corrResult = await supabase.from("process_case_correlations")
        .select("*")
        .eq("org_id", orgId)
        .eq("case_id", body.case_id)
        .order("correlation_score", { ascending: false });

      if (corrResult.error) return fail(500, corrResult.error.message);

      // Also get exposure summary
      var expResult = await supabase.from("process_exposure_summaries")
        .select("*")
        .eq("org_id", orgId)
        .eq("case_id", body.case_id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      var topCorrelation = null;
      if (corrResult.data && corrResult.data.length > 0) {
        var top = corrResult.data[0];
        topCorrelation = {
          source_id: top.source_id,
          correlation_type: top.correlation_type,
          score: top.correlation_score,
          operating_regime: top.operating_regime,
          exceedance_count: top.exceedance_count,
          detail: top.correlation_json
        };
      }

      return ok({
        case_id: body.case_id,
        correlations: corrResult.data,
        total_correlations: corrResult.data.length,
        top_correlation: topCorrelation,
        exposure_summary: expResult.data || null,
        assessment: corrResult.data.length > 0
          ? (topCorrelation && topCorrelation.score > 60
            ? "Strong process data correlation detected — operating conditions likely contributed to findings"
            : topCorrelation && topCorrelation.score > 30
            ? "Moderate process data correlation — operating conditions may have contributed"
            : "Low process data correlation — findings likely not driven by operating conditions")
          : "No process data correlations available for this case"
      });
    }

    return fail(400, "Unknown action: " + action + ". Valid actions: get_registry, register_source, ingest_readings, get_sources, get_readings, detect_exceedances, correlate_case, get_exposure_summary, get_exceedance_history, get_case_correlations");

  } catch (err) {
    return fail(500, String(err && err.message ? err.message : err));
  }
};
