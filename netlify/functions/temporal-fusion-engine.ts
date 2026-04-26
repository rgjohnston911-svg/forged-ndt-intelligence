// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// TEMPORAL FUSION ENGINE (DEPLOY329)
//
// Fuses multiple time-series data streams into a unified
// degradation state with attention-weighted temporal context.
//
// Inputs: vibration monitoring, corrosion probes, CP readings,
// temperature logs, process data, inspection measurements.
//
// Approach:
// 1. Multi-scale temporal encoding (hours, days, weeks, months)
// 2. Cross-stream attention — which streams correlate at which lags
// 3. Degradation state vector — unified asset health representation
// 4. Change-point detection — identify regime shifts
// 5. Trend decomposition — separate signal from noise
// 6. Predictive state projection — where is health heading
//
// This bridges the gap between the World Model (forward projection)
// and the Digital Twin (calibration) by providing real-time fusion
// of heterogeneous sensor streams into a single degradation picture.
// ══════════════════════════════════════════════════════════════════

// ── STREAM TYPES ────────────────────────────────────────────────
var STREAM_TYPES = {
  "ut_thickness": {
    name: "Ultrasonic Thickness",
    unit: "mm",
    typical_interval_hours: 2160, // ~90 days
    noise_floor: 0.05,
    trend_direction: "decreasing",
    weight: 0.25
  },
  "corrosion_probe": {
    name: "Corrosion Probe (ER/LPR)",
    unit: "mm/yr",
    typical_interval_hours: 24,
    noise_floor: 0.01,
    trend_direction: "variable",
    weight: 0.20
  },
  "cp_potential": {
    name: "Cathodic Protection Potential",
    unit: "mV vs Ag/AgCl",
    typical_interval_hours: 168, // weekly
    noise_floor: 10,
    trend_direction: "maintaining",
    weight: 0.10
  },
  "vibration_rms": {
    name: "Vibration RMS",
    unit: "mm/s",
    typical_interval_hours: 1,
    noise_floor: 0.05,
    trend_direction: "variable",
    weight: 0.10
  },
  "temperature": {
    name: "Process Temperature",
    unit: "C",
    typical_interval_hours: 1,
    noise_floor: 0.5,
    trend_direction: "variable",
    weight: 0.10
  },
  "pressure": {
    name: "Process Pressure",
    unit: "bar",
    typical_interval_hours: 1,
    noise_floor: 0.1,
    trend_direction: "variable",
    weight: 0.08
  },
  "strain_gauge": {
    name: "Strain Gauge",
    unit: "microstrain",
    typical_interval_hours: 1,
    noise_floor: 5,
    trend_direction: "variable",
    weight: 0.07
  },
  "acoustic_emission": {
    name: "Acoustic Emission",
    unit: "hits/hr",
    typical_interval_hours: 1,
    noise_floor: 2,
    trend_direction: "increasing_alarm",
    weight: 0.10
  }
};

// ── TEMPORAL SCALES ─────────────────────────────────────────────
var TEMPORAL_SCALES = [
  { name: "hourly", window_hours: 24, description: "Short-term fluctuations" },
  { name: "daily", window_hours: 168, description: "Daily patterns and cycles" },
  { name: "weekly", window_hours: 720, description: "Weekly operational cycles" },
  { name: "monthly", window_hours: 4380, description: "Monthly/seasonal trends" },
  { name: "quarterly", window_hours: 13140, description: "Long-term degradation trajectory" }
];

// ── MULTI-SCALE TEMPORAL ENCODING ───────────────────────────────
function encodeTemporalFeatures(readings) {
  if (!readings || readings.length === 0) return { scales: {}, overall_trend: 0 };

  var encoded = { scales: {}, overall_trend: 0 };

  for (var si = 0; si < TEMPORAL_SCALES.length; si++) {
    var scale = TEMPORAL_SCALES[si];
    var windowMs = scale.window_hours * 3600000;
    var now = Date.now();
    var cutoff = now - windowMs;

    // Filter readings within this window
    var windowReadings = [];
    for (var ri = 0; ri < readings.length; ri++) {
      var ts = typeof readings[ri].timestamp === "number" ? readings[ri].timestamp : new Date(readings[ri].timestamp).getTime();
      if (ts >= cutoff) {
        windowReadings.push({ t: ts, v: readings[ri].value });
      }
    }

    if (windowReadings.length < 2) {
      encoded.scales[scale.name] = { n: windowReadings.length, trend: 0, mean: windowReadings.length > 0 ? windowReadings[0].v : 0, std: 0, slope: 0 };
      continue;
    }

    // Compute statistics
    var sum = 0;
    for (var i = 0; i < windowReadings.length; i++) sum = sum + windowReadings[i].v;
    var mean = sum / windowReadings.length;

    var variance = 0;
    for (var i = 0; i < windowReadings.length; i++) {
      var diff = windowReadings[i].v - mean;
      variance = variance + diff * diff;
    }
    variance = variance / windowReadings.length;
    var std = Math.sqrt(variance);

    // Linear regression for trend
    var tMean = 0;
    for (var i = 0; i < windowReadings.length; i++) tMean = tMean + windowReadings[i].t;
    tMean = tMean / windowReadings.length;

    var num = 0;
    var den = 0;
    for (var i = 0; i < windowReadings.length; i++) {
      var tDiff = windowReadings[i].t - tMean;
      var vDiff = windowReadings[i].v - mean;
      num = num + tDiff * vDiff;
      den = den + tDiff * tDiff;
    }
    var slope = den !== 0 ? num / den : 0;
    // Normalize slope to per-hour
    var slopePerHour = slope * 3600000;

    encoded.scales[scale.name] = {
      n: windowReadings.length,
      trend: slopePerHour > 0 ? "increasing" : (slopePerHour < 0 ? "decreasing" : "stable"),
      mean: Math.round(mean * 10000) / 10000,
      std: Math.round(std * 10000) / 10000,
      slope_per_hour: Math.round(slopePerHour * 1e8) / 1e8,
      latest: windowReadings[windowReadings.length - 1].v,
      cv: mean !== 0 ? Math.round((std / Math.abs(mean)) * 1000) / 1000 : 0
    };
  }

  // Overall trend from longest available scale
  var longestScale = null;
  for (var sk in encoded.scales) {
    if (encoded.scales[sk].n >= 2) longestScale = encoded.scales[sk];
  }
  if (longestScale) encoded.overall_trend = longestScale.slope_per_hour;

  return encoded;
}

// ── CROSS-STREAM ATTENTION ──────────────────────────────────────
function computeCrossStreamAttention(streams) {
  var streamKeys = Object.keys(streams);
  var attention = {};

  for (var i = 0; i < streamKeys.length; i++) {
    for (var j = i + 1; j < streamKeys.length; j++) {
      var keyA = streamKeys[i];
      var keyB = streamKeys[j];
      var seriesA = streams[keyA];
      var seriesB = streams[keyB];

      if (!seriesA || !seriesB || seriesA.length < 3 || seriesB.length < 3) continue;

      // Align time series by nearest timestamp
      var aligned = alignTimeSeries(seriesA, seriesB);
      if (aligned.length < 3) continue;

      // Pearson correlation
      var corr = pearsonCorrelation(
        aligned.map(function(p) { return p.a; }),
        aligned.map(function(p) { return p.b; })
      );

      var pairKey = keyA + " <-> " + keyB;
      attention[pairKey] = {
        correlation: Math.round(corr * 1000) / 1000,
        strength: Math.abs(corr) > 0.7 ? "strong" : (Math.abs(corr) > 0.4 ? "moderate" : "weak"),
        direction: corr > 0 ? "positive" : "negative",
        aligned_points: aligned.length
      };
    }
  }

  return attention;
}

function alignTimeSeries(seriesA, seriesB) {
  var aligned = [];
  var maxGapMs = 3600000; // 1 hour tolerance

  for (var ai = 0; ai < seriesA.length; ai++) {
    var tA = typeof seriesA[ai].timestamp === "number" ? seriesA[ai].timestamp : new Date(seriesA[ai].timestamp).getTime();
    var bestMatch = null;
    var bestGap = Infinity;

    for (var bi = 0; bi < seriesB.length; bi++) {
      var tB = typeof seriesB[bi].timestamp === "number" ? seriesB[bi].timestamp : new Date(seriesB[bi].timestamp).getTime();
      var gap = Math.abs(tA - tB);
      if (gap < bestGap) {
        bestGap = gap;
        bestMatch = seriesB[bi];
      }
    }

    if (bestMatch && bestGap <= maxGapMs) {
      aligned.push({ a: seriesA[ai].value, b: bestMatch.value });
    }
  }

  return aligned;
}

function pearsonCorrelation(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  var sumX = 0, sumY = 0;
  for (var i = 0; i < n; i++) { sumX = sumX + x[i]; sumY = sumY + y[i]; }
  var meanX = sumX / n;
  var meanY = sumY / n;

  var num = 0, denX = 0, denY = 0;
  for (var i = 0; i < n; i++) {
    var dx = x[i] - meanX;
    var dy = y[i] - meanY;
    num = num + dx * dy;
    denX = denX + dx * dx;
    denY = denY + dy * dy;
  }

  var den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

// ── CHANGE-POINT DETECTION ──────────────────────────────────────
function detectChangePoints(readings, windowSize) {
  if (!readings || readings.length < 10) return [];

  var ws = windowSize || 5;
  var changePoints = [];

  for (var i = ws; i < readings.length - ws; i++) {
    // Compute mean and variance before and after
    var beforeSum = 0, afterSum = 0;
    for (var j = i - ws; j < i; j++) beforeSum = beforeSum + readings[j].value;
    for (var j = i; j < Math.min(i + ws, readings.length); j++) afterSum = afterSum + readings[j].value;

    var beforeMean = beforeSum / ws;
    var afterN = Math.min(ws, readings.length - i);
    var afterMean = afterSum / afterN;

    var beforeVar = 0;
    for (var j = i - ws; j < i; j++) {
      var d = readings[j].value - beforeMean;
      beforeVar = beforeVar + d * d;
    }
    beforeVar = beforeVar / ws;

    var pooledStd = Math.sqrt(beforeVar);
    if (pooledStd < 1e-10) pooledStd = Math.abs(beforeMean) * 0.01 || 0.001;

    var shiftMagnitude = Math.abs(afterMean - beforeMean) / pooledStd;

    if (shiftMagnitude > 2.0) { // > 2 sigma shift
      changePoints.push({
        index: i,
        timestamp: readings[i].timestamp,
        before_mean: Math.round(beforeMean * 10000) / 10000,
        after_mean: Math.round(afterMean * 10000) / 10000,
        shift_sigma: Math.round(shiftMagnitude * 100) / 100,
        direction: afterMean > beforeMean ? "increase" : "decrease",
        severity: shiftMagnitude > 4 ? "major" : (shiftMagnitude > 3 ? "significant" : "moderate")
      });
    }
  }

  return changePoints;
}

// ── DEGRADATION STATE VECTOR ────────────────────────────────────
function computeDegradationState(allStreams) {
  var state = {
    timestamp: new Date().toISOString(),
    health_index: 1.0, // 1.0 = perfect, 0.0 = failed
    confidence: 0,
    stream_contributions: {},
    active_alarms: [],
    regime: "normal"
  };

  var totalWeight = 0;
  var weightedHealth = 0;
  var streamCount = 0;

  for (var streamType in allStreams) {
    var typeDef = STREAM_TYPES[streamType];
    if (!typeDef) continue;

    var readings = allStreams[streamType];
    if (!readings || readings.length === 0) continue;

    streamCount++;
    var encoded = encodeTemporalFeatures(readings);
    var changePoints = detectChangePoints(readings, 5);

    // Compute stream health
    var streamHealth = 1.0;
    var latestScale = null;
    for (var sk in encoded.scales) {
      if (encoded.scales[sk].n >= 2) latestScale = encoded.scales[sk];
    }

    if (latestScale) {
      // Penalize high variability
      if (latestScale.cv > 0.5) streamHealth = streamHealth - 0.1;
      if (latestScale.cv > 1.0) streamHealth = streamHealth - 0.2;

      // Penalize adverse trends
      if (typeDef.trend_direction === "decreasing" && latestScale.trend === "decreasing") {
        // Expected — wall loss etc. Penalize by rate
        var rateRatio = Math.abs(latestScale.slope_per_hour) / (typeDef.noise_floor || 0.001);
        if (rateRatio > 10) streamHealth = streamHealth - 0.3;
        else if (rateRatio > 5) streamHealth = streamHealth - 0.15;
      }

      if (typeDef.trend_direction === "increasing_alarm" && latestScale.trend === "increasing") {
        // AE hits increasing is bad
        streamHealth = streamHealth - 0.25;
        state.active_alarms.push({ stream: streamType, type: "increasing_trend", severity: "warning" });
      }
    }

    // Penalize recent change points
    if (changePoints.length > 0) {
      var recentCP = changePoints[changePoints.length - 1];
      if (recentCP.severity === "major") {
        streamHealth = streamHealth - 0.2;
        state.active_alarms.push({ stream: streamType, type: "change_point", severity: recentCP.severity, shift_sigma: recentCP.shift_sigma });
      } else if (recentCP.severity === "significant") {
        streamHealth = streamHealth - 0.1;
      }
    }

    streamHealth = Math.max(0, Math.min(1, streamHealth));

    state.stream_contributions[streamType] = {
      health: Math.round(streamHealth * 1000) / 1000,
      weight: typeDef.weight,
      n_readings: readings.length,
      change_points: changePoints.length,
      trend: latestScale ? latestScale.trend : "unknown"
    };

    weightedHealth = weightedHealth + streamHealth * typeDef.weight;
    totalWeight = totalWeight + typeDef.weight;
  }

  if (totalWeight > 0) {
    state.health_index = Math.round((weightedHealth / totalWeight) * 1000) / 1000;
  }

  state.confidence = Math.min(100, Math.round(streamCount / Object.keys(STREAM_TYPES).length * 100));

  // Determine regime
  if (state.health_index < 0.3) state.regime = "critical";
  else if (state.health_index < 0.5) state.regime = "degraded";
  else if (state.health_index < 0.7) state.regime = "caution";
  else if (state.active_alarms.length > 0) state.regime = "monitoring";
  else state.regime = "normal";

  return state;
}

// ── PREDICTIVE STATE PROJECTION ─────────────────────────────────
function projectState(allStreams, horizonHours) {
  var hz = horizonHours || 8760; // default 1 year
  var projections = {};

  for (var streamType in allStreams) {
    var typeDef = STREAM_TYPES[streamType];
    if (!typeDef) continue;

    var readings = allStreams[streamType];
    if (!readings || readings.length < 3) continue;

    var encoded = encodeTemporalFeatures(readings);
    var monthlyScale = encoded.scales["monthly"] || encoded.scales["weekly"];
    if (!monthlyScale || monthlyScale.n < 2) continue;

    var current = monthlyScale.latest;
    var rate = monthlyScale.slope_per_hour;

    // Project at multiple horizons
    var steps = [730, 2190, 4380, 8760]; // 1mo, 3mo, 6mo, 1yr
    var projected = [];
    for (var si = 0; si < steps.length; si++) {
      if (steps[si] > hz) break;
      var futureVal = current + rate * steps[si];
      projected.push({
        hours_ahead: steps[si],
        label: steps[si] === 730 ? "1 month" : (steps[si] === 2190 ? "3 months" : (steps[si] === 4380 ? "6 months" : "1 year")),
        projected_value: Math.round(futureVal * 10000) / 10000,
        uncertainty: Math.round(monthlyScale.std * Math.sqrt(steps[si] / 720) * 10000) / 10000
      });
    }

    projections[streamType] = {
      current_value: current,
      rate_per_hour: rate,
      rate_per_year: Math.round(rate * 8760 * 10000) / 10000,
      projections: projected,
      trend: monthlyScale.trend
    };
  }

  return projections;
}

// ── SAVE FUNCTIONS ──────────────────────────────────────────────
async function saveFusionState(sb, assetId, state, attention) {
  try {
    await sb.from("temporal_fusion_states").insert([{
      asset_id: assetId,
      health_index: state.health_index,
      confidence: state.confidence,
      regime: state.regime,
      active_alarms_count: state.active_alarms.length,
      stream_contributions: state.stream_contributions,
      cross_stream_attention: attention,
      full_state: state
    }]);
  } catch (e) {
    // non-fatal
  }
}

async function getFusionHistory(sb, assetId, limit) {
  try {
    var q = sb.from("temporal_fusion_states").select("*").order("created_at", { ascending: false }).limit(limit || 50);
    if (assetId) q = q.eq("asset_id", assetId);
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

// ── HANDLER ─────────────────────────────────────────────────────
var handler = async function(event) {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    var sb = createClient(supabaseUrl, supabaseKey);

    // ── GET REGISTRY ──────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "temporal-fusion-engine",
          deploy: "DEPLOY329",
          version: "1.0.0",
          description: "Temporal Fusion Engine — multi-stream time-series fusion with attention-weighted degradation state",
          stream_types: Object.keys(STREAM_TYPES).length,
          temporal_scales: TEMPORAL_SCALES.length,
          capabilities: [
            "temporal_encoding",
            "cross_stream_attention",
            "change_point_detection",
            "degradation_state_vector",
            "predictive_projection",
            "regime_classification"
          ],
          actions: ["get_registry", "fuse_streams", "detect_changes", "project_state", "get_stream_types", "get_history"]
        })
      };
    }

    // ── FUSE STREAMS ──────────────────────────────────────────
    if (action === "fuse_streams") {
      var assetId = body.asset_id || null;
      var streams = body.streams || {};

      var state = computeDegradationState(streams);
      var attention = computeCrossStreamAttention(streams);
      var projections = projectState(streams, body.horizon_hours || 8760);

      if (assetId) {
        await saveFusionState(sb, assetId, state, attention);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "temporal-fusion-engine",
          action: "fuse_streams",
          asset_id: assetId,
          degradation_state: state,
          cross_stream_attention: attention,
          projections: projections
        })
      };
    }

    // ── DETECT CHANGES ────────────────────────────────────────
    if (action === "detect_changes") {
      var dcStreams = body.streams || {};
      var allChanges = {};

      for (var streamType in dcStreams) {
        var readings = dcStreams[streamType];
        if (!readings || readings.length < 10) continue;
        var cps = detectChangePoints(readings, body.window_size || 5);
        if (cps.length > 0) allChanges[streamType] = cps;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "temporal-fusion-engine",
          action: "detect_changes",
          change_points: allChanges,
          total_changes: Object.keys(allChanges).reduce(function(s, k) { return s + allChanges[k].length; }, 0)
        })
      };
    }

    // ── PROJECT STATE ─────────────────────────────────────────
    if (action === "project_state") {
      var projStreams = body.streams || {};
      var projections = projectState(projStreams, body.horizon_hours || 8760);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "temporal-fusion-engine",
          action: "project_state",
          projections: projections,
          horizon_hours: body.horizon_hours || 8760
        })
      };
    }

    // ── GET STREAM TYPES ──────────────────────────────────────
    if (action === "get_stream_types") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "temporal-fusion-engine",
          action: "get_stream_types",
          stream_types: STREAM_TYPES
        })
      };
    }

    // ── GET HISTORY ───────────────────────────────────────────
    if (action === "get_history") {
      var history = await getFusionHistory(sb, body.asset_id, body.limit || 50);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "temporal-fusion-engine",
          action: "get_history",
          states: history,
          count: history.length
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "temporal-fusion-engine", error: "Unknown action: " + action })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "temporal-fusion-engine", error: String(err && err.message ? err.message : err) })
    };
  }
};

export { handler };
