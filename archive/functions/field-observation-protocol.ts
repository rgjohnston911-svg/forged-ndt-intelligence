// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// FIELD OBSERVATION PROTOCOL ENGINE (DEPLOY332)
//
// Structured measurement ingestion with physics validation,
// readback confirmation, amendment tracking, and evidence chain.
//
// Complements the Voice Grammar Bridge (DEPLOY159) by adding:
// 1. Physics-bounded validation on every measurement
// 2. Cross-measurement consistency checks
// 3. Historical comparison (is this reading plausible given prior?)
// 4. Structured readback with delta-from-previous
// 5. Amendment log with full before/after audit trail
// 6. Evidence packaging for downstream engine consumption
//
// The demo moment: inspector enters a reading, system immediately
// says "12.3mm at CML-7, down 0.4mm from last reading 14 months
// ago, corrosion rate 0.34 mm/yr, 8.2 years remaining life.
// Confirm?" Inspector confirms or corrects. Every step logged.
// ══════════════════════════════════════════════════════════════════

// ── MEASUREMENT TYPES ──────────────────────────────────────────
var MEASUREMENT_TYPES = {
  "ut_thickness": {
    name: "Ultrasonic Thickness",
    unit: "mm",
    bounds: { min: 0.5, max: 300 },
    precision: 0.1,
    physics_checks: ["positive", "less_than_nominal", "rate_plausible"],
    typical_range: { min: 2.0, max: 50.0 }
  },
  "pit_depth": {
    name: "Pit Depth",
    unit: "mm",
    bounds: { min: 0.0, max: 100 },
    precision: 0.1,
    physics_checks: ["positive", "less_than_wall"],
    typical_range: { min: 0.1, max: 15.0 }
  },
  "crack_length": {
    name: "Crack Length",
    unit: "mm",
    bounds: { min: 0.1, max: 5000 },
    precision: 1.0,
    physics_checks: ["positive"],
    typical_range: { min: 1.0, max: 500.0 }
  },
  "crack_depth": {
    name: "Crack Depth",
    unit: "mm",
    bounds: { min: 0.1, max: 200 },
    precision: 0.1,
    physics_checks: ["positive", "less_than_wall"],
    typical_range: { min: 0.5, max: 25.0 }
  },
  "dft_coating": {
    name: "Dry Film Thickness (Coating)",
    unit: "microns",
    bounds: { min: 0, max: 5000 },
    precision: 1.0,
    physics_checks: ["positive"],
    typical_range: { min: 50, max: 1500 }
  },
  "cp_potential": {
    name: "Cathodic Protection Potential",
    unit: "mV",
    bounds: { min: -2000, max: 0 },
    precision: 1.0,
    physics_checks: [],
    typical_range: { min: -1200, max: -700 }
  },
  "hardness": {
    name: "Hardness",
    unit: "HB",
    bounds: { min: 50, max: 700 },
    precision: 1.0,
    physics_checks: ["positive"],
    typical_range: { min: 120, max: 350 }
  },
  "temperature": {
    name: "Surface Temperature",
    unit: "C",
    bounds: { min: -50, max: 1200 },
    precision: 0.1,
    physics_checks: [],
    typical_range: { min: -20, max: 600 }
  }
};

// ── PHYSICS VALIDATION ─────────────────────────────────────────
function validateMeasurement(value, measurementType, context) {
  var typeDef = MEASUREMENT_TYPES[measurementType];
  if (!typeDef) return { valid: true, warnings: [], errors: [] };

  var warnings = [];
  var errors = [];

  // Hard bounds
  if (value < typeDef.bounds.min) {
    errors.push("Value " + value + " " + typeDef.unit + " is below minimum bound (" + typeDef.bounds.min + ")");
  }
  if (value > typeDef.bounds.max) {
    errors.push("Value " + value + " " + typeDef.unit + " is above maximum bound (" + typeDef.bounds.max + ")");
  }

  // Typical range
  if (value < typeDef.typical_range.min) {
    warnings.push("Value " + value + " " + typeDef.unit + " is below typical range (" + typeDef.typical_range.min + "-" + typeDef.typical_range.max + ")");
  }
  if (value > typeDef.typical_range.max) {
    warnings.push("Value " + value + " " + typeDef.unit + " is above typical range (" + typeDef.typical_range.min + "-" + typeDef.typical_range.max + ")");
  }

  // Physics checks
  for (var ci = 0; ci < typeDef.physics_checks.length; ci++) {
    var check = typeDef.physics_checks[ci];

    if (check === "positive" && value < 0) {
      errors.push(typeDef.name + " cannot be negative");
    }

    if (check === "less_than_nominal" && context && context.nominal_wall) {
      if (value > context.nominal_wall * 1.05) { // 5% tolerance for measurement error
        warnings.push("Reading " + value + " mm exceeds nominal wall " + context.nominal_wall + " mm by more than 5%");
      }
    }

    if (check === "less_than_wall" && context && context.wall_thickness) {
      if (value > context.wall_thickness) {
        errors.push("Depth " + value + " mm exceeds wall thickness " + context.wall_thickness + " mm");
      }
    }

    if (check === "rate_plausible" && context && context.previous_reading && context.previous_date) {
      var daysDiff = (Date.now() - new Date(context.previous_date).getTime()) / 86400000;
      var yearsDiff = daysDiff / 365.25;
      if (yearsDiff > 0.01) { // at least ~4 days between readings
        var loss = context.previous_reading - value;
        var rate = loss / yearsDiff;

        if (rate < -0.5) { // thickness increased significantly
          warnings.push("Wall appears to have GAINED " + Math.abs(Math.round(loss * 100) / 100) + " mm — possible measurement location variance or probe coupling issue");
        }
        if (rate > 5.0) {
          warnings.push("Implied corrosion rate of " + Math.round(rate * 100) / 100 + " mm/yr is unusually high — verify reading and location");
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings: warnings,
    errors: errors
  };
}

// ── HISTORICAL COMPARISON ──────────────────────────────────────
function compareToHistory(value, measurementType, context) {
  var comparison = {
    has_history: false,
    previous_reading: null,
    previous_date: null,
    delta: null,
    rate: null,
    remaining_life: null,
    trend: null
  };

  if (!context || !context.previous_reading || !context.previous_date) return comparison;

  comparison.has_history = true;
  comparison.previous_reading = context.previous_reading;
  comparison.previous_date = context.previous_date;

  var delta = value - context.previous_reading;
  comparison.delta = Math.round(delta * 1000) / 1000;

  var daysDiff = (Date.now() - new Date(context.previous_date).getTime()) / 86400000;
  var yearsDiff = daysDiff / 365.25;

  if (yearsDiff > 0.01) {
    var rate = -delta / yearsDiff; // positive rate = wall loss
    comparison.rate = Math.round(rate * 10000) / 10000;
    comparison.rate_unit = "mm/yr";
    comparison.interval_days = Math.round(daysDiff);
    comparison.interval_months = Math.round(daysDiff / 30.44 * 10) / 10;

    // Remaining life
    if (rate > 0 && context.min_required) {
      var rl = (value - context.min_required) / rate;
      comparison.remaining_life = Math.round(rl * 10) / 10;
      comparison.remaining_life_unit = "years";
    }

    // Trend
    if (Math.abs(rate) < 0.02) comparison.trend = "stable";
    else if (rate > 0) comparison.trend = "thinning";
    else comparison.trend = "gaining"; // unusual but possible with measurement variance
  }

  return comparison;
}

// ── READBACK GENERATOR ─────────────────────────────────────────
function generateReadback(measurement, validation, comparison) {
  var parts = [];

  // Main reading
  var typeDef = MEASUREMENT_TYPES[measurement.type] || {};
  parts.push((typeDef.name || measurement.type) + ": " + measurement.value + " " + (typeDef.unit || ""));

  // Location
  if (measurement.cml_id) parts.push("at CML " + measurement.cml_id);
  if (measurement.location) parts.push("location: " + measurement.location);

  // Historical comparison
  if (comparison.has_history) {
    var deltaStr = comparison.delta > 0 ? "up " + comparison.delta : "down " + Math.abs(comparison.delta);
    parts.push(deltaStr + " " + (typeDef.unit || "mm") + " from last reading " + comparison.interval_months + " months ago");

    if (comparison.rate !== null) {
      parts.push("rate: " + comparison.rate + " " + (comparison.rate_unit || "mm/yr"));
    }

    if (comparison.remaining_life !== null) {
      parts.push("remaining life: " + comparison.remaining_life + " years");
    }
  }

  // Warnings
  if (validation.warnings.length > 0) {
    parts.push("NOTE: " + validation.warnings[0]);
  }

  // Errors
  if (validation.errors.length > 0) {
    parts.push("WARNING: " + validation.errors[0]);
  }

  return {
    text: parts.join(". ") + ".",
    short: (typeDef.name || measurement.type) + ": " + measurement.value + (typeDef.unit || "") + (measurement.cml_id ? " at CML " + measurement.cml_id : ""),
    confirmation_prompt: "Confirm: " + parts.slice(0, 3).join(", ") + "?",
    has_warnings: validation.warnings.length > 0,
    has_errors: validation.errors.length > 0
  };
}

// ── AMENDMENT TRACKER ──────────────────────────────────────────
function trackAmendment(originalMeasurement, field, oldValue, newValue, reason) {
  return {
    timestamp: new Date().toISOString(),
    field: field,
    old_value: oldValue,
    new_value: newValue,
    reason: reason || "inspector_correction",
    measurement_id: originalMeasurement.id || null,
    asset_id: originalMeasurement.asset_id || null,
    cml_id: originalMeasurement.cml_id || null
  };
}

// ── EVIDENCE PACKAGER ──────────────────────────────────────────
function packageEvidence(measurement, validation, comparison, readback, amendments, confirmed) {
  return {
    evidence_type: "field_observation",
    measurement: {
      type: measurement.type,
      value: measurement.value,
      unit: (MEASUREMENT_TYPES[measurement.type] || {}).unit || "unknown",
      asset_id: measurement.asset_id,
      cml_id: measurement.cml_id || null,
      location: measurement.location || null,
      method: measurement.method || null,
      inspector_id: measurement.inspector_id || null,
      recorded_at: measurement.recorded_at || new Date().toISOString()
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    },
    history: comparison,
    readback: readback.text,
    amendments: amendments || [],
    amendment_count: amendments ? amendments.length : 0,
    confirmed: confirmed || false,
    confirmed_at: confirmed ? new Date().toISOString() : null,
    provenance: {
      engine: "field-observation-protocol",
      version: "1.0.0",
      processed_at: new Date().toISOString()
    }
  };
}

// ── CONSISTENCY CHECK ──────────────────────────────────────────
function crossCheckMeasurements(measurements) {
  var issues = [];

  // Group by asset
  var byAsset = {};
  for (var i = 0; i < measurements.length; i++) {
    var m = measurements[i];
    var aid = m.asset_id || "unknown";
    if (!byAsset[aid]) byAsset[aid] = [];
    byAsset[aid].push(m);
  }

  // Check each asset's readings for consistency
  for (var assetId in byAsset) {
    var assetReadings = byAsset[assetId];

    // Check for large variance in same-day thickness readings
    var thicknessReadings = assetReadings.filter(function(r) { return r.type === "ut_thickness"; });
    if (thicknessReadings.length >= 3) {
      var values = thicknessReadings.map(function(r) { return r.value; });
      var mean = values.reduce(function(s, v) { return s + v; }, 0) / values.length;
      var maxDev = 0;
      for (var vi = 0; vi < values.length; vi++) {
        var dev = Math.abs(values[vi] - mean);
        if (dev > maxDev) maxDev = dev;
      }
      if (maxDev > mean * 0.3) { // >30% deviation from mean
        issues.push({
          asset_id: assetId,
          type: "high_variance",
          message: "Thickness readings on " + assetId + " vary by more than 30% — check probe coupling and surface preparation",
          readings: thicknessReadings.length,
          max_deviation_mm: Math.round(maxDev * 100) / 100
        });
      }
    }

    // Check for thickness > nominal (possible wrong location or asset)
    for (var ri = 0; ri < assetReadings.length; ri++) {
      var reading = assetReadings[ri];
      if (reading.type === "ut_thickness" && reading.nominal_wall && reading.value > reading.nominal_wall * 1.1) {
        issues.push({
          asset_id: assetId,
          type: "exceeds_nominal",
          message: "Reading " + reading.value + " mm at CML " + (reading.cml_id || "?") + " exceeds nominal wall " + reading.nominal_wall + " mm — verify asset and CML",
          cml_id: reading.cml_id
        });
      }
    }
  }

  return issues;
}

// ── SAVE FUNCTIONS ─────────────────────────────────────────────
async function saveObservation(sb, evidence) {
  try {
    await sb.from("field_observations").insert([{
      asset_id: evidence.measurement.asset_id,
      cml_id: evidence.measurement.cml_id,
      measurement_type: evidence.measurement.type,
      measured_value: evidence.measurement.value,
      unit: evidence.measurement.unit,
      inspector_id: evidence.measurement.inspector_id,
      validation_valid: evidence.validation.valid,
      warning_count: evidence.validation.warnings.length,
      has_history: evidence.history.has_history,
      corrosion_rate: evidence.history.rate,
      remaining_life: evidence.history.remaining_life,
      amendment_count: evidence.amendment_count,
      confirmed: evidence.confirmed,
      full_evidence: evidence
    }]);
  } catch (e) {
    // non-fatal
  }
}

async function getObservationHistory(sb, assetId, cmlId, limit) {
  try {
    var q = sb.from("field_observations").select("*").order("created_at", { ascending: false }).limit(limit || 50);
    if (assetId) q = q.eq("asset_id", assetId);
    if (cmlId) q = q.eq("cml_id", cmlId);
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

// ── HANDLER ────────────────────────────────────────────────────
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

    // ── GET REGISTRY ─────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          deploy: "DEPLOY332",
          version: "1.0.0",
          description: "Field Observation Protocol — structured measurement ingestion with physics validation, readback, amendment tracking, and evidence chain",
          measurement_types: Object.keys(MEASUREMENT_TYPES).length,
          capabilities: [
            "physics_validation",
            "historical_comparison",
            "structured_readback",
            "amendment_tracking",
            "evidence_packaging",
            "cross_measurement_consistency",
            "remaining_life_instant"
          ],
          actions: ["get_registry", "record", "validate", "readback", "amend", "confirm", "cross_check", "get_measurement_types", "get_history"]
        })
      };
    }

    // ── RECORD ───────────────────────────────────────────────
    if (action === "record") {
      var measurement = {
        type: body.measurement_type || "ut_thickness",
        value: body.value,
        asset_id: body.asset_id,
        cml_id: body.cml_id || null,
        location: body.location || null,
        method: body.method || null,
        inspector_id: body.inspector_id || null,
        recorded_at: body.recorded_at || new Date().toISOString()
      };

      var context = {
        nominal_wall: body.nominal_wall || null,
        wall_thickness: body.wall_thickness || null,
        previous_reading: body.previous_reading || null,
        previous_date: body.previous_date || null,
        min_required: body.min_required || null
      };

      var validation = validateMeasurement(measurement.value, measurement.type, context);
      var comparison = compareToHistory(measurement.value, measurement.type, context);
      var readback = generateReadback(measurement, validation, comparison);
      var evidence = packageEvidence(measurement, validation, comparison, readback, [], false);

      await saveObservation(sb, evidence);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "record",
          readback: readback,
          validation: validation,
          comparison: comparison,
          evidence: evidence
        })
      };
    }

    // ── VALIDATE ─────────────────────────────────────────────
    if (action === "validate") {
      var valResult = validateMeasurement(body.value, body.measurement_type || "ut_thickness", body.context || {});
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "validate",
          validation: valResult
        })
      };
    }

    // ── READBACK ─────────────────────────────────────────────
    if (action === "readback") {
      var rbMeasurement = body.measurement || {};
      var rbContext = body.context || {};
      var rbValidation = validateMeasurement(rbMeasurement.value, rbMeasurement.type, rbContext);
      var rbComparison = compareToHistory(rbMeasurement.value, rbMeasurement.type, rbContext);
      var rbReadback = generateReadback(rbMeasurement, rbValidation, rbComparison);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "readback",
          readback: rbReadback
        })
      };
    }

    // ── AMEND ────────────────────────────────────────────────
    if (action === "amend") {
      var amendment = trackAmendment(
        body.measurement || {},
        body.field,
        body.old_value,
        body.new_value,
        body.reason
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "amend",
          amendment: amendment
        })
      };
    }

    // ── CONFIRM ──────────────────────────────────────────────
    if (action === "confirm") {
      var cfEvidence = body.evidence || {};
      cfEvidence.confirmed = true;
      cfEvidence.confirmed_at = new Date().toISOString();

      if (cfEvidence.measurement && cfEvidence.measurement.asset_id) {
        await saveObservation(sb, cfEvidence);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "confirm",
          status: "confirmed",
          confirmed_at: cfEvidence.confirmed_at,
          evidence: cfEvidence
        })
      };
    }

    // ── CROSS CHECK ──────────────────────────────────────────
    if (action === "cross_check") {
      var measurements = body.measurements || [];
      var issues = crossCheckMeasurements(measurements);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "cross_check",
          issues: issues,
          measurements_checked: measurements.length,
          issues_found: issues.length
        })
      };
    }

    // ── GET MEASUREMENT TYPES ────────────────────────────────
    if (action === "get_measurement_types") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "get_measurement_types",
          measurement_types: MEASUREMENT_TYPES
        })
      };
    }

    // ── GET HISTORY ──────────────────────────────────────────
    if (action === "get_history") {
      var history = await getObservationHistory(sb, body.asset_id, body.cml_id, body.limit || 50);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "field-observation-protocol",
          action: "get_history",
          observations: history,
          count: history.length
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "field-observation-protocol", error: "Unknown action: " + action })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "field-observation-protocol", error: String(err && err.message ? err.message : err) })
    };
  }
};

export { handler };
