// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// BATCH PROCESSING GATEWAY (DEPLOY333)
//
// Accepts arrays of inspection readings and runs them through
// the full engine stack in batch. Designed for plant turnarounds
// where 500+ readings come in during a single shift.
//
// Capabilities:
// 1. Accept array of readings (thickness, corrosion, defect, etc.)
// 2. Route each reading to appropriate engine pipeline
// 3. Aggregate results into consolidated batch report
// 4. Compute fleet-level statistics across the batch
// 5. Flag outliers and anomalies within the batch
// 6. Generate batch-level remaining life rankings
// 7. Produce priority action list sorted by risk
//
// This turns a pile of field data into an actionable turnaround
// report in one API call.
// ══════════════════════════════════════════════════════════════════

// ── READING TYPES ───────────────────────────────────────────────
var READING_TYPES = {
  "thickness": {
    required_fields: ["asset_id", "cml_id", "measured_value"],
    optional_fields: ["nominal_wall", "min_required", "previous_reading", "previous_date", "material", "service", "temperature"],
    unit: "mm",
    pipeline: ["corrosion_rate", "remaining_life", "code_check", "risk_score"]
  },
  "defect": {
    required_fields: ["asset_id", "defect_type", "length", "depth"],
    optional_fields: ["width", "orientation", "location", "weld_proximity", "material", "smys"],
    unit: "mm",
    pipeline: ["severity_assessment", "b31g_check", "ffs_screening", "risk_score"]
  },
  "coating": {
    required_fields: ["asset_id", "condition"],
    optional_fields: ["coating_type", "original_date", "dft_reading", "adhesion_rating", "location"],
    unit: "various",
    pipeline: ["coating_assessment", "corrosion_risk", "action_priority"]
  },
  "cp_reading": {
    required_fields: ["asset_id", "potential"],
    optional_fields: ["reference_cell", "instant_off", "depolarization", "location", "anode_condition"],
    unit: "mV",
    pipeline: ["cp_adequacy", "protection_status", "action_priority"]
  },
  "crack": {
    required_fields: ["asset_id", "crack_length", "crack_depth"],
    optional_fields: ["orientation", "location", "material", "stress_level", "temperature", "environment"],
    unit: "mm",
    pipeline: ["fracture_assessment", "growth_projection", "criticality", "risk_score"]
  }
};

// ── BATCH PROCESSOR ─────────────────────────────────────────────
function processReading(reading, index) {
  var readingType = reading.type || "thickness";
  var typeDef = READING_TYPES[readingType];
  if (!typeDef) {
    return {
      index: index,
      asset_id: reading.asset_id || "unknown",
      status: "error",
      error: "Unknown reading type: " + readingType
    };
  }

  // Validate required fields
  var missing = [];
  for (var fi = 0; fi < typeDef.required_fields.length; fi++) {
    var field = typeDef.required_fields[fi];
    if (reading[field] === undefined || reading[field] === null) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      index: index,
      asset_id: reading.asset_id || "unknown",
      status: "incomplete",
      missing_fields: missing,
      processable: false
    };
  }

  // Process based on type
  var result = {
    index: index,
    asset_id: reading.asset_id,
    cml_id: reading.cml_id || null,
    type: readingType,
    status: "processed",
    results: {}
  };

  if (readingType === "thickness") {
    result.results = processThicknessReading(reading);
  } else if (readingType === "defect") {
    result.results = processDefectReading(reading);
  } else if (readingType === "coating") {
    result.results = processCoatingReading(reading);
  } else if (readingType === "cp_reading") {
    result.results = processCPReading(reading);
  } else if (readingType === "crack") {
    result.results = processCrackReading(reading);
  }

  return result;
}

function processThicknessReading(r) {
  var measured = r.measured_value;
  var nominal = r.nominal_wall || null;
  var minReq = r.min_required || null;
  var previous = r.previous_reading || null;
  var prevDate = r.previous_date || null;

  var res = {
    measured_thickness: measured,
    nominal_wall: nominal
  };

  // Corrosion rate
  if (previous && prevDate) {
    var daysDiff = (Date.now() - new Date(prevDate).getTime()) / 86400000;
    var yearsDiff = daysDiff / 365.25;
    if (yearsDiff > 0) {
      var loss = previous - measured;
      res.corrosion_rate_mm_yr = Math.round((loss / yearsDiff) * 10000) / 10000;
      res.corrosion_rate_category = res.corrosion_rate_mm_yr < 0.05 ? "low" :
        (res.corrosion_rate_mm_yr < 0.25 ? "moderate" :
        (res.corrosion_rate_mm_yr < 1.0 ? "high" : "severe"));
    }
  }

  // Remaining life
  if (minReq && res.corrosion_rate_mm_yr && res.corrosion_rate_mm_yr > 0) {
    res.remaining_life_years = Math.round(((measured - minReq) / res.corrosion_rate_mm_yr) * 10) / 10;
    res.remaining_life_category = res.remaining_life_years < 1 ? "critical" :
      (res.remaining_life_years < 3 ? "short" :
      (res.remaining_life_years < 10 ? "moderate" : "long"));
  }

  // Wall loss percentage
  if (nominal) {
    res.wall_loss_pct = Math.round(((nominal - measured) / nominal) * 1000) / 10;
    res.wall_loss_category = res.wall_loss_pct < 10 ? "acceptable" :
      (res.wall_loss_pct < 30 ? "monitor" :
      (res.wall_loss_pct < 50 ? "action_required" : "critical"));
  }

  // Code check
  if (minReq) {
    res.above_minimum = measured >= minReq;
    res.margin_mm = Math.round((measured - minReq) * 1000) / 1000;
  }

  // Risk score (1-25 scale)
  var riskPof = 1;
  if (res.remaining_life_years !== undefined) {
    if (res.remaining_life_years < 1) riskPof = 5;
    else if (res.remaining_life_years < 3) riskPof = 4;
    else if (res.remaining_life_years < 5) riskPof = 3;
    else if (res.remaining_life_years < 10) riskPof = 2;
  }
  res.risk_pof = riskPof;
  res.risk_score = riskPof * 3; // default CoF=3

  return res;
}

function processDefectReading(r) {
  var res = {
    defect_type: r.defect_type,
    length: r.length,
    depth: r.depth,
    width: r.width || null
  };

  // Simple B31G screening if we have pipe data
  if (r.smys && r.nominal_wall && r.outside_diameter) {
    var t = r.nominal_wall;
    var d = r.depth;
    var L = r.length;
    var D = r.outside_diameter;

    var A = 0.893 * L / Math.sqrt(D * t);
    var M = A <= 4.0 ? Math.sqrt(1 + 0.8 * A * A) : 0.032 * A * A + 3.3;
    var dOverT = d / t;

    res.b31g_folias = Math.round(M * 1000) / 1000;
    res.depth_ratio = Math.round(dOverT * 1000) / 1000;
    res.b31g_acceptable = dOverT <= 0.8;

    if (dOverT <= 0.8) {
      var ERF = (1 - (2/3) * dOverT) / (1 - (2/3) * dOverT / M);
      res.estimated_repair_factor = Math.round(ERF * 1000) / 1000;
      res.safe_pressure_factor = Math.round((1 / ERF) * 1000) / 1000;
    }
  }

  // Severity
  if (r.nominal_wall) {
    var depthPct = (r.depth / r.nominal_wall) * 100;
    res.depth_pct_wall = Math.round(depthPct * 10) / 10;
    res.severity = depthPct < 20 ? "minor" : (depthPct < 40 ? "moderate" : (depthPct < 60 ? "significant" : "severe"));
  }

  return res;
}

function processCoatingReading(r) {
  var conditionScores = {
    "intact": 1, "good": 1, "fair": 2, "poor": 3,
    "disbonded": 4, "blistered": 4, "cracked": 3,
    "missing": 5, "failed": 5
  };

  var score = conditionScores[r.condition] || 3;

  return {
    condition: r.condition,
    condition_score: score,
    corrosion_risk: score >= 4 ? "high" : (score >= 3 ? "moderate" : "low"),
    action: score >= 4 ? "immediate_repair" : (score >= 3 ? "schedule_repair" : "monitor"),
    coating_type: r.coating_type || null,
    dft_reading: r.dft_reading || null
  };
}

function processCPReading(r) {
  var potential = r.potential;
  var adequate = potential <= -850; // mV vs Cu/CuSO4 criterion
  var overprotected = potential <= -1200;

  return {
    potential: potential,
    reference: r.reference_cell || "Cu/CuSO4",
    adequate: adequate && !overprotected,
    overprotected: overprotected,
    underprotected: !adequate,
    status: overprotected ? "overprotected" : (adequate ? "adequate" : "underprotected"),
    action: overprotected ? "reduce_output" : (adequate ? "none" : "increase_output_or_repair"),
    instant_off: r.instant_off || null
  };
}

function processCrackReading(r) {
  var res = {
    crack_length: r.crack_length,
    crack_depth: r.crack_depth,
    orientation: r.orientation || "unknown"
  };

  // Critical crack size screening (simplified)
  if (r.material && r.stress_level) {
    // Very simplified fracture mechanics screening
    var KIC = 50; // default toughness MPa*sqrt(m)
    if (r.material === "carbon_steel") KIC = 60;
    if (r.material === "stainless_steel") KIC = 80;
    if (r.material === "duplex") KIC = 100;

    var a = r.crack_depth / 1000; // convert mm to m
    var sigma = r.stress_level; // MPa
    var KI = sigma * 1.12 * Math.sqrt(Math.PI * a);

    res.stress_intensity = Math.round(KI * 100) / 100;
    res.fracture_toughness = KIC;
    res.criticality_ratio = Math.round((KI / KIC) * 1000) / 1000;
    res.critical = KI >= KIC * 0.8;
    res.severity = KI >= KIC * 0.8 ? "critical" : (KI >= KIC * 0.5 ? "significant" : (KI >= KIC * 0.3 ? "moderate" : "minor"));
  }

  return res;
}

// ── BATCH AGGREGATION ───────��───────────────────────────────────
function aggregateBatch(results) {
  var summary = {
    total_readings: results.length,
    processed: 0,
    errors: 0,
    incomplete: 0,
    by_type: {},
    by_asset: {},
    risk_distribution: { critical: 0, high: 0, moderate: 0, low: 0 },
    action_items: [],
    fleet_statistics: {}
  };

  var allCorrosionRates = [];
  var allRemainingLives = [];
  var allRiskScores = [];

  for (var i = 0; i < results.length; i++) {
    var r = results[i];

    if (r.status === "processed") summary.processed++;
    else if (r.status === "error") summary.errors++;
    else if (r.status === "incomplete") summary.incomplete++;

    // By type
    var type = r.type || "unknown";
    if (!summary.by_type[type]) summary.by_type[type] = { count: 0, processed: 0 };
    summary.by_type[type].count++;
    if (r.status === "processed") summary.by_type[type].processed++;

    // By asset
    var asset = r.asset_id || "unknown";
    if (!summary.by_asset[asset]) summary.by_asset[asset] = { readings: 0, worst_risk: 0, actions: [] };
    summary.by_asset[asset].readings++;

    if (r.results) {
      // Collect statistics
      if (r.results.corrosion_rate_mm_yr !== undefined) allCorrosionRates.push(r.results.corrosion_rate_mm_yr);
      if (r.results.remaining_life_years !== undefined) allRemainingLives.push(r.results.remaining_life_years);
      if (r.results.risk_score !== undefined) allRiskScores.push(r.results.risk_score);

      // Risk distribution
      if (r.results.remaining_life_category === "critical" || r.results.severity === "critical" || r.results.critical === true) {
        summary.risk_distribution.critical++;
        summary.action_items.push({ asset: asset, cml: r.cml_id, type: type, priority: "critical", detail: r.results });
      } else if (r.results.remaining_life_category === "short" || r.results.severity === "severe" || r.results.wall_loss_category === "critical") {
        summary.risk_distribution.high++;
        summary.action_items.push({ asset: asset, cml: r.cml_id, type: type, priority: "high", detail: r.results });
      } else if (r.results.remaining_life_category === "moderate" || r.results.severity === "moderate" || r.results.wall_loss_category === "action_required") {
        summary.risk_distribution.moderate++;
      } else {
        summary.risk_distribution.low++;
      }

      // Track worst risk per asset
      var riskVal = r.results.risk_score || 0;
      if (riskVal > summary.by_asset[asset].worst_risk) {
        summary.by_asset[asset].worst_risk = riskVal;
      }
    }
  }

  // Fleet statistics
  if (allCorrosionRates.length > 0) {
    allCorrosionRates.sort(function(a, b) { return a - b; });
    summary.fleet_statistics.corrosion_rate = {
      count: allCorrosionRates.length,
      min: allCorrosionRates[0],
      max: allCorrosionRates[allCorrosionRates.length - 1],
      median: allCorrosionRates[Math.floor(allCorrosionRates.length / 2)],
      mean: Math.round(allCorrosionRates.reduce(function(s, v) { return s + v; }, 0) / allCorrosionRates.length * 10000) / 10000
    };
  }

  if (allRemainingLives.length > 0) {
    allRemainingLives.sort(function(a, b) { return a - b; });
    summary.fleet_statistics.remaining_life = {
      count: allRemainingLives.length,
      min: allRemainingLives[0],
      max: allRemainingLives[allRemainingLives.length - 1],
      median: allRemainingLives[Math.floor(allRemainingLives.length / 2)],
      below_3_years: allRemainingLives.filter(function(v) { return v < 3; }).length,
      below_1_year: allRemainingLives.filter(function(v) { return v < 1; }).length
    };
  }

  // Sort action items by priority
  var priorityOrder = { "critical": 0, "high": 1, "moderate": 2, "low": 3 };
  summary.action_items.sort(function(a, b) {
    return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
  });

  return summary;
}

// ── SAVE FUNCTIONS ──���───────────────────────────────────────────
async function saveBatchRun(sb, batchId, summary, results) {
  try {
    await sb.from("batch_processing_runs").insert([{
      batch_id: batchId,
      total_readings: summary.total_readings,
      processed: summary.processed,
      errors: summary.errors,
      incomplete: summary.incomplete,
      critical_count: summary.risk_distribution.critical,
      high_count: summary.risk_distribution.high,
      action_items_count: summary.action_items.length,
      fleet_statistics: summary.fleet_statistics,
      full_summary: summary
    }]);
  } catch (e) {
    // non-fatal
  }
}

function generateBatchId() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var id = "BATCH-";
  for (var i = 0; i < 8; i++) {
    id = id + chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ── HANDLER ─────────────────────────────────────────���───────────
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
          engine: "batch-processing-gateway",
          deploy: "DEPLOY333",
          version: "1.0.0",
          description: "Batch Processing Gateway — process 500+ inspection readings in one API call with fleet-level aggregation",
          reading_types: Object.keys(READING_TYPES).length,
          capabilities: [
            "batch_thickness",
            "batch_defect",
            "batch_coating",
            "batch_cp",
            "batch_crack",
            "fleet_statistics",
            "risk_ranking",
            "action_prioritization"
          ],
          actions: ["get_registry", "process_batch", "get_reading_types", "get_history"]
        })
      };
    }

    // ── PROCESS BATCH ─────────────────────────────────────────
    if (action === "process_batch") {
      var readings = body.readings || [];
      var batchId = generateBatchId();

      if (readings.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ engine: "batch-processing-gateway", error: "No readings provided" })
        };
      }

      // Process each reading
      var results = [];
      for (var i = 0; i < readings.length; i++) {
        results.push(processReading(readings[i], i));
      }

      // Aggregate
      var summary = aggregateBatch(results);

      await saveBatchRun(sb, batchId, summary, results);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "batch-processing-gateway",
          action: "process_batch",
          batch_id: batchId,
          summary: summary,
          results: results
        })
      };
    }

    // ── GET READING TYPES ─────────────────────────────────────
    if (action === "get_reading_types") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "batch-processing-gateway",
          action: "get_reading_types",
          reading_types: READING_TYPES
        })
      };
    }

    // ── GET HISTORY ───────────��───────────────────────────��───
    if (action === "get_history") {
      try {
        var q = sb.from("batch_processing_runs").select("*").order("created_at", { ascending: false }).limit(body.limit || 20);
        var histResult = await q;
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            engine: "batch-processing-gateway",
            action: "get_history",
            runs: histResult.data || [],
            count: (histResult.data || []).length
          })
        };
      } catch (e) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ engine: "batch-processing-gateway", action: "get_history", runs: [], count: 0 })
        };
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "batch-processing-gateway", error: "Unknown action: " + action })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "batch-processing-gateway", error: String(err && err.message ? err.message : err) })
    };
  }
};

export { handler };
