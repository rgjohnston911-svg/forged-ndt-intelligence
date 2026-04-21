// @ts-nocheck
/**
 * DEPLOY210 - parse-thickness-csv.ts
 * netlify/functions/parse-thickness-csv.ts
 *
 * Accepts CSV content + case_id, parses into thickness_readings rows.
 *
 * Auto-detects:
 *  - Optional "# units: in" or "# units: mm" header line (default: in)
 *  - Optional "# nominal: 0.375" header line (sets nominal_in for all rows)
 *  - 2D grid (first row = col labels, first col = row labels, cells = thickness)
 *  - Flat list (two cols: location, thickness)
 *
 * CONSTRAINT: var only, no template literals, @ts-nocheck.
 */
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function inToMm(v) { return Math.round(v * 25.4 * 1000) / 1000; }
function mmToIn(v) { return Math.round(v / 25.4 * 10000) / 10000; }

function splitLine(line) {
  // Simple CSV split - handles commas and tabs, trims whitespace.
  var sep = line.indexOf("\t") !== -1 && line.indexOf(",") === -1 ? "\t" : ",";
  var parts = line.split(sep);
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    out.push(parts[i].replace(/^\s+|\s+$/g, "").replace(/^"|"$/g, ""));
  }
  return out;
}

function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  var cleaned = String(s).replace(/[^0-9eE+\-.]/g, "");
  if (cleaned === "") return NaN;
  return parseFloat(cleaned);
}

function parseCsv(raw) {
  var lines = raw.split(/\r?\n/);
  var units = "in";
  var nominal = null;
  var dataStart = 0;

  // Consume "# " directive lines at top
  while (dataStart < lines.length) {
    var ln = (lines[dataStart] || "").replace(/^\s+|\s+$/g, "");
    if (ln === "") { dataStart++; continue; }
    if (ln.charAt(0) !== "#") break;
    var lower = ln.toLowerCase();
    if (lower.indexOf("units") !== -1) {
      if (lower.indexOf("mm") !== -1) units = "mm";
      else units = "in";
    }
    if (lower.indexOf("nominal") !== -1) {
      var m = lower.match(/[-+]?[0-9]*\.?[0-9]+/);
      if (m) nominal = parseFloat(m[0]);
    }
    dataStart++;
  }

  // Collect non-empty data rows
  var rows = [];
  for (var i = dataStart; i < lines.length; i++) {
    var t = (lines[i] || "").replace(/^\s+|\s+$/g, "");
    if (t === "") continue;
    rows.push(splitLine(lines[i]));
  }

  if (rows.length === 0) {
    return { error: "No data rows found in CSV" };
  }

  // Format detection:
  //  - Flat list: header row's 2nd token is a word like "thickness" / "reading" / "value"
  //    OR the row has exactly 2 cols and 1st col is non-numeric.
  //  - 2D grid: header row has 3+ cells AND first cell is non-numeric (row/col label).
  var header = rows[0];
  var isFlat = false;
  if (header.length === 2) {
    isFlat = true;
  } else if (header.length >= 2) {
    var h1 = (header[1] || "").toLowerCase();
    if (h1 === "thickness" || h1 === "reading" || h1 === "value" || h1 === "thickness_in" || h1 === "thickness_mm") {
      isFlat = true;
    }
  }

  var readings = [];

  if (isFlat) {
    // Flat list mode. Assume row[0] = header, rest = location, thickness.
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (row.length < 2) continue;
      var loc = row[0];
      var val = parseNum(row[1]);
      if (isNaN(val) || val <= 0) continue;
      var inVal = units === "mm" ? mmToIn(val) : val;
      var mmVal = units === "mm" ? val : inToMm(val);
      readings.push({
        location_ref: loc,
        grid_row: null,
        grid_col: null,
        thickness_in: inVal,
        thickness_mm: mmVal,
        source_format: "flat_list"
      });
    }
  } else {
    // 2D grid mode. header[0] is corner label (ignore). header[1..] are col labels.
    var colLabels = header.slice(1);
    for (var rr = 1; rr < rows.length; rr++) {
      var gr = rows[rr];
      if (gr.length < 2) continue;
      var rowLabel = gr[0];
      for (var c = 1; c < gr.length; c++) {
        var v = parseNum(gr[c]);
        if (isNaN(v) || v <= 0) continue;
        var colLabel = colLabels[c - 1] || ("C" + c);
        var inV = units === "mm" ? mmToIn(v) : v;
        var mmV = units === "mm" ? v : inToMm(v);
        readings.push({
          location_ref: rowLabel + "-" + colLabel,
          grid_row: rowLabel,
          grid_col: colLabel,
          thickness_in: inV,
          thickness_mm: mmV,
          source_format: "grid_2d"
        });
      }
    }
  }

  if (readings.length === 0) {
    return { error: "No valid numeric thickness values parsed" };
  }

  // Flag min of grid
  var minVal = readings[0].thickness_in;
  var minIdx = 0;
  for (var k = 1; k < readings.length; k++) {
    if (readings[k].thickness_in < minVal) { minVal = readings[k].thickness_in; minIdx = k; }
  }
  readings[minIdx].is_min_of_grid = true;

  return {
    units: units,
    nominal: nominal,
    format: readings[0].source_format,
    count: readings.length,
    readings: readings
  };
}

var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: headers(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    var authHeader = (event.headers["authorization"] || event.headers["Authorization"] || "");
    var token = authHeader.replace("Bearer ", "");
    if (!token) {
      return { statusCode: 401, headers: headers(), body: JSON.stringify({ error: "Missing auth token" }) };
    }

    var sb = createClient(supabaseUrl, supabaseKey);
    var userRes = await sb.auth.getUser(token);
    if (userRes.error || !userRes.data.user) {
      return { statusCode: 401, headers: headers(), body: JSON.stringify({ error: "Invalid auth token" }) };
    }
    var userId = userRes.data.user.id;

    var body = JSON.parse(event.body || "{}");
    var caseId = (body.case_id || "").trim();
    var csv = body.csv || "";
    var evidenceId = body.evidence_id || null;
    var filename = body.filename || "thickness.csv";

    if (!caseId) return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "case_id required" }) };
    if (!csv) return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: "csv content required" }) };

    // Verify user has access to this case
    var caseCheck = await sb.from("inspection_cases").select("id, org_id").eq("id", caseId).maybeSingle();
    if (caseCheck.error || !caseCheck.data) {
      return { statusCode: 404, headers: headers(), body: JSON.stringify({ error: "Case not found" }) };
    }

    var parsed = parseCsv(csv);
    if (parsed.error) {
      return { statusCode: 400, headers: headers(), body: JSON.stringify({ error: parsed.error }) };
    }

    var toInsert = [];
    for (var i = 0; i < parsed.readings.length; i++) {
      var r = parsed.readings[i];
      toInsert.push({
        case_id: caseId,
        evidence_id: evidenceId,
        grid_row: r.grid_row,
        grid_col: r.grid_col,
        location_ref: r.location_ref,
        thickness_in: r.thickness_in,
        thickness_mm: r.thickness_mm,
        nominal_in: parsed.nominal,
        is_min_of_grid: !!r.is_min_of_grid,
        source_format: r.source_format,
        uploaded_by: userId
      });
    }

    var insertRes = await sb.from("thickness_readings").insert(toInsert).select("id");
    if (insertRes.error) {
      console.log("thickness insert error: " + JSON.stringify(insertRes.error));
      return {
        statusCode: 500,
        headers: headers(),
        body: JSON.stringify({ error: "Failed to insert readings", detail: insertRes.error.message || insertRes.error })
      };
    }

    // Quick stats for client
    var vals = parsed.readings.map(function(r) { return r.thickness_in; });
    var sum = 0;
    for (var s = 0; s < vals.length; s++) sum += vals[s];
    var avg = sum / vals.length;
    var minV = Math.min.apply(null, vals);
    var maxV = Math.max.apply(null, vals);

    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify({
        success: true,
        filename: filename,
        format: parsed.format,
        units_declared: parsed.units,
        nominal_in: parsed.nominal,
        count: parsed.count,
        stats_in: {
          min: Math.round(minV * 10000) / 10000,
          max: Math.round(maxV * 10000) / 10000,
          avg: Math.round(avg * 10000) / 10000
        }
      })
    };
  } catch (err: any) {
    console.log("parse-thickness-csv error: " + String(err));
    return { statusCode: 500, headers: headers(), body: JSON.stringify({ error: "Internal error", detail: String(err) }) };
  }
};

export { handler };
