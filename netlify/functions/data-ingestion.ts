// @ts-nocheck
/**
 * DEPLOY236 - data-ingestion.ts
 * netlify/functions/data-ingestion.ts
 *
 * DATA INGESTION ENGINE
 *
 * Imports external inspection data into the system.
 * Supports structured data from UT thickness grids, inspection
 * spreadsheets, and generic case imports.
 *
 * POST /api/data-ingestion { action: "import_thickness_grid", data[] }
 *   -> Imports UT thickness readings and creates/updates cases
 *
 * POST /api/data-ingestion { action: "import_case", case_data }
 *   -> Creates a case from external system data
 *
 * POST /api/data-ingestion { action: "import_batch", cases[] }
 *   -> Bulk import multiple cases
 *
 * POST /api/data-ingestion { action: "get_import_history", limit }
 *   -> Returns recent import operations
 *
 * POST /api/data-ingestion { action: "get_field_map" }
 *   -> Returns expected field mappings for import
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "data-ingestion/1.0.0";
var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// FIELD MAPPINGS — What the system expects
// ================================================================
var CASE_FIELD_MAP = {
  required: [
    { field: "component_name", type: "string", description: "Name or ID of the component inspected" },
    { field: "inspection_method", type: "string", description: "NDT method: UT, RT, MT, PT, VT, ET, PAUT, TOFD, AE, etc." }
  ],
  recommended: [
    { field: "asset_type", type: "string", description: "Type of asset: pressure_vessel, piping, tank, structural, heat_exchanger, etc." },
    { field: "material", type: "string", description: "Material specification: carbon_steel, stainless_316, inconel_625, etc." },
    { field: "material_family", type: "string", description: "Material family: ferrous, non_ferrous, composite, polymer, etc." },
    { field: "damage_type", type: "string", description: "Damage mechanism: corrosion, pitting, scc, fatigue, erosion, hydrogen, etc." },
    { field: "severity", type: "string", description: "Severity level: critical, major, moderate, minor, acceptable" }
  ],
  optional: [
    { field: "case_number", type: "string", description: "External case/work order number" },
    { field: "notes", type: "string", description: "Free text notes" },
    { field: "nominal_thickness", type: "number", description: "Original wall thickness (inches or mm)" },
    { field: "measured_thickness", type: "number", description: "Measured wall thickness" },
    { field: "code_minimum", type: "number", description: "Code-required minimum wall thickness" },
    { field: "corrosion_rate", type: "number", description: "Corrosion rate (mpy or mm/yr)" },
    { field: "operating_pressure", type: "number", description: "Operating pressure (psi or MPa)" },
    { field: "operating_temperature", type: "number", description: "Operating temperature (F or C)" },
    { field: "inspection_date", type: "string", description: "Date of inspection (ISO format)" },
    { field: "inspector_name", type: "string", description: "Name of inspector" },
    { field: "inspector_id", type: "string", description: "Inspector user ID" },
    { field: "location", type: "string", description: "Physical location / grid reference" },
    { field: "org_id", type: "string", description: "Organization ID for tenant isolation" }
  ]
};

var THICKNESS_GRID_FIELD_MAP = {
  required: [
    { field: "component_name", type: "string", description: "Component being measured" },
    { field: "readings", type: "array", description: "Array of { location, thickness } readings" }
  ],
  reading_fields: [
    { field: "location", type: "string", description: "Grid point reference (e.g., A1, B3, TML-5)" },
    { field: "thickness", type: "number", description: "Measured thickness value" }
  ],
  optional: [
    { field: "nominal_thickness", type: "number", description: "Original wall thickness" },
    { field: "code_minimum", type: "number", description: "Minimum allowable thickness" },
    { field: "units", type: "string", description: "Measurement units: inches or mm (default: inches)" },
    { field: "asset_type", type: "string", description: "Asset type" },
    { field: "material", type: "string", description: "Material" },
    { field: "inspection_date", type: "string", description: "Date of readings" },
    { field: "inspector_name", type: "string", description: "Inspector name" }
  ]
};

// ================================================================
// THICKNESS GRID ANALYSIS
// ================================================================
function analyzeThicknessGrid(gridData) {
  var readings = gridData.readings || [];
  if (readings.length === 0) return { error: "No readings provided" };

  var nominal = gridData.nominal_thickness || null;
  var codeMin = gridData.code_minimum || null;
  var values = [];
  var belowNominal = 0;
  var belowCodeMin = 0;
  var locations = [];

  for (var i = 0; i < readings.length; i++) {
    var r = readings[i];
    var t = Number(r.thickness);
    if (isNaN(t)) continue;
    values.push(t);
    locations.push({ location: r.location || "Point " + (i + 1), thickness: t });

    if (nominal && t < nominal) belowNominal++;
    if (codeMin && t < codeMin) belowCodeMin++;
  }

  if (values.length === 0) return { error: "No valid thickness readings" };

  // Statistics
  values.sort(function(a, b) { return a - b; });
  var sum = 0;
  for (var si = 0; si < values.length; si++) sum += values[si];
  var avg = sum / values.length;
  var min = values[0];
  var max = values[values.length - 1];
  var range = max - min;

  // Standard deviation
  var sqDiffSum = 0;
  for (var sd = 0; sd < values.length; sd++) {
    sqDiffSum += (values[sd] - avg) * (values[sd] - avg);
  }
  var stdDev = Math.sqrt(sqDiffSum / values.length);

  // Determine severity
  var severity = "acceptable";
  var damageType = "general corrosion";
  var disposition = "acceptable";

  if (codeMin && min < codeMin) {
    severity = "critical";
    disposition = "repair_immediate";
  } else if (nominal && (nominal - min) / nominal > 0.40) {
    severity = "major";
    disposition = "repair";
  } else if (nominal && (nominal - min) / nominal > 0.25) {
    severity = "moderate";
    disposition = "monitor_closely";
  } else if (nominal && (nominal - min) / nominal > 0.10) {
    severity = "minor";
    disposition = "monitor";
  }

  // Detect pitting vs general corrosion
  if (stdDev > 0 && (max - min) > avg * 0.20) {
    damageType = "pitting";
  }

  // Corrosion rate estimate (if we have inspection date and nominal)
  var corrosionRate = null;
  if (nominal && gridData.inspection_date) {
    var wallLoss = nominal - avg;
    if (wallLoss > 0) {
      // Estimate assuming 1 year since installation (placeholder)
      corrosionRate = Math.round(wallLoss * 1000) / 1000;
    }
  }

  return {
    total_readings: values.length,
    min_thickness: Math.round(min * 10000) / 10000,
    max_thickness: Math.round(max * 10000) / 10000,
    avg_thickness: Math.round(avg * 10000) / 10000,
    range: Math.round(range * 10000) / 10000,
    std_deviation: Math.round(stdDev * 10000) / 10000,
    nominal_thickness: nominal,
    code_minimum: codeMin,
    readings_below_nominal: belowNominal,
    readings_below_code_min: belowCodeMin,
    wall_loss_pct: nominal ? Math.round(((nominal - min) / nominal) * 1000) / 10 + "%" : null,
    avg_wall_loss_pct: nominal ? Math.round(((nominal - avg) / nominal) * 1000) / 10 + "%" : null,
    estimated_corrosion_rate: corrosionRate,
    detected_damage_type: damageType,
    auto_severity: severity,
    auto_disposition: disposition,
    locations: locations,
    units: gridData.units || "inches"
  };
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action;
    var sb = createClient(supabaseUrl, supabaseKey);
    var startTime = Date.now();

    // ── ACTION: get_field_map ──
    if (action === "get_field_map") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_import: CASE_FIELD_MAP,
          thickness_grid: THICKNESS_GRID_FIELD_MAP,
          engine_version: ENGINE_VERSION,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: import_thickness_grid ──
    if (action === "import_thickness_grid") {
      if (!body.data) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "data object required with component_name and readings[]" }) };

      var gridData = body.data;
      if (!gridData.component_name) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "component_name required" }) };
      if (!gridData.readings || !gridData.readings.length) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "readings array required with at least one { location, thickness } entry" }) };

      var analysis = analyzeThicknessGrid(gridData);
      if (analysis.error) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: analysis.error }) };

      // Create case with the analyzed data
      var caseInsert = await sb.from("inspection_cases").insert({
        component_name: gridData.component_name,
        asset_type: gridData.asset_type || "general",
        material: gridData.material || null,
        material_family: gridData.material_family || null,
        inspection_method: "UT",
        damage_type: analysis.detected_damage_type,
        severity: analysis.auto_severity,
        status: "open",
        state: analysis.auto_severity === "critical" ? "critical" : analysis.auto_severity === "major" ? "major" : "pending_review",
        disposition: analysis.auto_disposition,
        confidence: 0.70, // UT grid = decent confidence, needs engineering review
        notes: "Imported from UT thickness grid. " + analysis.total_readings + " readings. Min: " + analysis.min_thickness + " " + analysis.units + ". Wall loss: " + (analysis.wall_loss_pct || "N/A"),
        org_id: gridData.org_id || null,
        case_number: gridData.case_number || null
      }).select().single();

      if (caseInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to create case: " + caseInsert.error.message }) };
      }

      // Create finding for the thickness grid
      var findingInsert = await sb.from("findings").insert({
        case_id: caseInsert.data.id,
        finding_type: "thickness_grid",
        description: "UT thickness grid with " + analysis.total_readings + " readings",
        severity: analysis.auto_severity,
        location: gridData.component_name,
        measurements: analysis,
        org_id: gridData.org_id || null
      }).select().single();

      // Log audit event
      await sb.from("audit_events").insert({
        case_id: caseInsert.data.id,
        event_type: "data_imported",
        user_id: body.user_id || null,
        detail: "UT thickness grid imported: " + analysis.total_readings + " readings for " + gridData.component_name,
        metadata: { source: "thickness_grid", reading_count: analysis.total_readings }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: caseInsert.data.id,
          case_created: true,
          analysis: analysis,
          auto_severity: analysis.auto_severity,
          auto_disposition: analysis.auto_disposition,
          finding_id: findingInsert.data ? findingInsert.data.id : null,
          message: "Thickness grid imported. Case created with " + analysis.total_readings + " readings. Auto-severity: " + analysis.auto_severity,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: import_case ──
    if (action === "import_case") {
      if (!body.case_data) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_data object required" }) };
      var cd = body.case_data;
      if (!cd.component_name) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "component_name required" }) };
      if (!cd.inspection_method) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "inspection_method required" }) };

      var caseData = {
        component_name: cd.component_name,
        inspection_method: cd.inspection_method,
        asset_type: cd.asset_type || "general",
        material: cd.material || null,
        material_family: cd.material_family || null,
        damage_type: cd.damage_type || null,
        severity: cd.severity || null,
        status: cd.status || "open",
        state: cd.state || "pending_review",
        disposition: cd.disposition || null,
        confidence: cd.confidence || null,
        notes: cd.notes || null,
        case_number: cd.case_number || null,
        org_id: cd.org_id || null
      };

      var importInsert = await sb.from("inspection_cases").insert(caseData).select().single();
      if (importInsert.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Failed to import case: " + importInsert.error.message }) };
      }

      // Log audit event
      await sb.from("audit_events").insert({
        case_id: importInsert.data.id,
        event_type: "data_imported",
        user_id: body.user_id || null,
        detail: "Case imported for " + cd.component_name + " via " + cd.inspection_method,
        metadata: { source: "manual_import" }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          case_id: importInsert.data.id,
          case_created: true,
          message: "Case imported successfully",
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: import_batch ──
    if (action === "import_batch") {
      var cases = body.cases;
      if (!cases || !cases.length) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "cases array required" }) };
      if (cases.length > 100) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Maximum 100 cases per batch" }) };

      var imported = [];
      var errors = [];

      for (var bi = 0; bi < cases.length; bi++) {
        var bc = cases[bi];
        if (!bc.component_name || !bc.inspection_method) {
          errors.push({ index: bi, error: "Missing component_name or inspection_method" });
          continue;
        }

        var batchInsert = await sb.from("inspection_cases").insert({
          component_name: bc.component_name,
          inspection_method: bc.inspection_method,
          asset_type: bc.asset_type || "general",
          material: bc.material || null,
          material_family: bc.material_family || null,
          damage_type: bc.damage_type || null,
          severity: bc.severity || null,
          status: bc.status || "open",
          state: bc.state || "pending_review",
          disposition: bc.disposition || null,
          confidence: bc.confidence || null,
          notes: bc.notes || null,
          case_number: bc.case_number || null,
          org_id: bc.org_id || null
        }).select().single();

        if (batchInsert.error) {
          errors.push({ index: bi, component: bc.component_name, error: batchInsert.error.message });
        } else {
          imported.push({ index: bi, case_id: batchInsert.data.id, component: bc.component_name });
        }
      }

      // Log audit event
      await sb.from("audit_events").insert({
        event_type: "batch_import",
        user_id: body.user_id || null,
        detail: "Batch import: " + imported.length + " created, " + errors.length + " failed",
        metadata: { total: cases.length, imported: imported.length, errors: errors.length }
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          imported: imported.length,
          errors: errors.length,
          total: cases.length,
          imported_cases: imported,
          import_errors: errors,
          message: imported.length + " cases imported, " + errors.length + " errors",
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    // ── ACTION: get_import_history ──
    if (action === "get_import_history") {
      var limit = body.limit || 20;
      var history = await sb.from("audit_events").select("*").in("event_type", ["data_imported", "batch_import"]).order("created_at", { ascending: false }).limit(limit);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          imports: history.data || [],
          total: (history.data || []).length,
          response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: import_thickness_grid, import_case, import_batch, get_import_history, get_field_map" }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
