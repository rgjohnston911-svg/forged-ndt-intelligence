// @ts-nocheck
/**
 * DEPLOY227 - case-search.ts
 * netlify/functions/case-search.ts
 *
 * CASE SEARCH & ANALYTICS ENGINE
 *
 * POST /api/case-search { action: "search", filters, sort, page, page_size }
 *   -> Returns matching cases with pagination
 *
 * POST /api/case-search { action: "analytics", filters }
 *   -> Returns aggregate stats across matching cases
 *
 * POST /api/case-search { action: "filter_options" }
 *   -> Returns distinct values for each filterable field (for dropdowns)
 *
 * FILTERS (all optional, combined with AND):
 *   date_from, date_to          — created_at range (ISO strings)
 *   status                      — case status (open, closed, in_progress, etc.)
 *   disposition                 — disposition value
 *   state                       — system state/decision
 *   material                    — material type
 *   material_family             — material family (ferrous, non-ferrous, composite, etc.)
 *   asset_type                  — type of asset/component
 *   component                   — component name
 *   inspection_method           — NDT method used (UT, RT, MT, PT, VT, ET, etc.)
 *   damage_type                 — type of damage/mechanism
 *   severity                    — severity level
 *   confidence_min              — minimum confidence score (0-1)
 *   confidence_max              — maximum confidence score (0-1)
 *   inspector_override          — true = only overridden, false = only non-overridden
 *   has_adjudication            — true = has inspector review, false = no review
 *   search_text                 — free text search across case number, component, notes
 *
 * SORT: { field, direction } — field = any case column, direction = "asc" or "desc"
 * PAGE: page number (1-based), PAGE_SIZE: results per page (default 25, max 100)
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var DEFAULT_PAGE_SIZE = 25;
var MAX_PAGE_SIZE = 100;

var VALID_SORT_FIELDS = [
  "created_at", "updated_at", "status", "disposition", "state",
  "confidence", "material", "component_name", "inspection_method",
  "damage_type", "asset_type", "adjudication_count", "case_number"
];

function applyFilters(query, filters) {
  if (!filters) return query;

  // Date range
  if (filters.date_from) {
    query = query.gte("created_at", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  // Exact match filters
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.disposition) {
    query = query.eq("disposition", filters.disposition);
  }
  if (filters.state) {
    query = query.eq("state", filters.state);
  }

  // Material filters
  if (filters.material) {
    query = query.ilike("material", "%" + filters.material + "%");
  }
  if (filters.material_family) {
    query = query.ilike("material_family", "%" + filters.material_family + "%");
  }

  // Asset and component
  if (filters.asset_type) {
    query = query.ilike("asset_type", "%" + filters.asset_type + "%");
  }
  if (filters.component) {
    query = query.ilike("component_name", "%" + filters.component + "%");
  }

  // Inspection method
  if (filters.inspection_method) {
    query = query.ilike("inspection_method", "%" + filters.inspection_method + "%");
  }

  // Damage type
  if (filters.damage_type) {
    query = query.ilike("damage_type", "%" + filters.damage_type + "%");
  }

  // Severity
  if (filters.severity) {
    query = query.ilike("severity", "%" + filters.severity + "%");
  }

  // Confidence range
  if (filters.confidence_min !== undefined && filters.confidence_min !== null) {
    query = query.gte("confidence", filters.confidence_min);
  }
  if (filters.confidence_max !== undefined && filters.confidence_max !== null) {
    query = query.lte("confidence", filters.confidence_max);
  }

  // Inspector override filter
  if (filters.inspector_override === true) {
    query = query.eq("inspector_override_active", true);
  } else if (filters.inspector_override === false) {
    query = query.eq("inspector_override_active", false);
  }

  // Has adjudication filter
  if (filters.has_adjudication === true) {
    query = query.gt("adjudication_count", 0);
  } else if (filters.has_adjudication === false) {
    query = query.eq("adjudication_count", 0);
  }

  // Free text search — searches case_number, component_name, notes, material
  if (filters.search_text) {
    var searchTerm = "%" + filters.search_text + "%";
    query = query.or(
      "case_number.ilike." + searchTerm +
      ",component_name.ilike." + searchTerm +
      ",notes.ilike." + searchTerm +
      ",material.ilike." + searchTerm +
      ",asset_type.ilike." + searchTerm +
      ",damage_type.ilike." + searchTerm
    );
  }

  return query;
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "search";
    var filters = body.filters || {};
    var startTime = Date.now();

    var sb = createClient(supabaseUrl, supabaseKey);

    // ── ACTION: filter_options ──
    // Returns distinct values for each filterable field (for building dropdowns)
    if (action === "filter_options") {
      var options = {};

      // Get distinct statuses
      var statusResult = await sb.from("inspection_cases").select("status").not("status", "is", null);
      var statusSet = {};
      if (statusResult.data) {
        for (var si = 0; si < statusResult.data.length; si++) {
          var sv = statusResult.data[si].status;
          if (sv && !statusSet[sv]) statusSet[sv] = true;
        }
      }
      options.statuses = Object.keys(statusSet).sort();

      // Get distinct dispositions
      var dispResult = await sb.from("inspection_cases").select("disposition").not("disposition", "is", null);
      var dispSet = {};
      if (dispResult.data) {
        for (var di = 0; di < dispResult.data.length; di++) {
          var dv = dispResult.data[di].disposition;
          if (dv && !dispSet[dv]) dispSet[dv] = true;
        }
      }
      options.dispositions = Object.keys(dispSet).sort();

      // Get distinct states
      var stateResult = await sb.from("inspection_cases").select("state").not("state", "is", null);
      var stateSet = {};
      if (stateResult.data) {
        for (var sti = 0; sti < stateResult.data.length; sti++) {
          var stv = stateResult.data[sti].state;
          if (stv && !stateSet[stv]) stateSet[stv] = true;
        }
      }
      options.states = Object.keys(stateSet).sort();

      // Get distinct materials
      var matResult = await sb.from("inspection_cases").select("material").not("material", "is", null);
      var matSet = {};
      if (matResult.data) {
        for (var mi = 0; mi < matResult.data.length; mi++) {
          var mv = matResult.data[mi].material;
          if (mv && !matSet[mv]) matSet[mv] = true;
        }
      }
      options.materials = Object.keys(matSet).sort();

      // Get distinct asset types
      var assetResult = await sb.from("inspection_cases").select("asset_type").not("asset_type", "is", null);
      var assetSet = {};
      if (assetResult.data) {
        for (var ai = 0; ai < assetResult.data.length; ai++) {
          var av = assetResult.data[ai].asset_type;
          if (av && !assetSet[av]) assetSet[av] = true;
        }
      }
      options.asset_types = Object.keys(assetSet).sort();

      // Get distinct inspection methods
      var methodResult = await sb.from("inspection_cases").select("inspection_method").not("inspection_method", "is", null);
      var methodSet = {};
      if (methodResult.data) {
        for (var mei = 0; mei < methodResult.data.length; mei++) {
          var mev = methodResult.data[mei].inspection_method;
          if (mev && !methodSet[mev]) methodSet[mev] = true;
        }
      }
      options.inspection_methods = Object.keys(methodSet).sort();

      // Get distinct damage types
      var dmgResult = await sb.from("inspection_cases").select("damage_type").not("damage_type", "is", null);
      var dmgSet = {};
      if (dmgResult.data) {
        for (var dmi = 0; dmi < dmgResult.data.length; dmi++) {
          var dmv = dmgResult.data[dmi].damage_type;
          if (dmv && !dmgSet[dmv]) dmgSet[dmv] = true;
        }
      }
      options.damage_types = Object.keys(dmgSet).sort();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ filter_options: options, response_ms: Date.now() - startTime })
      };
    }

    // ── ACTION: analytics ──
    // Returns aggregate statistics across matching cases
    if (action === "analytics") {
      var analyticsQuery = sb.from("inspection_cases").select("*");
      analyticsQuery = applyFilters(analyticsQuery, filters);
      var analyticsResult = await analyticsQuery;

      if (analyticsResult.error) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: analyticsResult.error.message }) };
      }

      var cases = analyticsResult.data || [];
      var totalCases = cases.length;

      // Disposition breakdown
      var dispositionCounts = {};
      var stateCounts = {};
      var materialCounts = {};
      var methodCounts = {};
      var assetTypeCounts = {};
      var damageTypeCounts = {};
      var overrideCount = 0;
      var adjudicatedCount = 0;
      var confidenceSum = 0;
      var confidenceCount = 0;
      var confidenceMin = null;
      var confidenceMax = null;

      // Time-based tracking
      var monthCounts = {};

      for (var ci = 0; ci < cases.length; ci++) {
        var cc = cases[ci];

        // Disposition
        var disp = cc.disposition || "unknown";
        dispositionCounts[disp] = (dispositionCounts[disp] || 0) + 1;

        // State
        var st = cc.state || "unknown";
        stateCounts[st] = (stateCounts[st] || 0) + 1;

        // Material
        var mat = cc.material || "unknown";
        materialCounts[mat] = (materialCounts[mat] || 0) + 1;

        // Method
        var meth = cc.inspection_method || "unknown";
        methodCounts[meth] = (methodCounts[meth] || 0) + 1;

        // Asset type
        var at = cc.asset_type || "unknown";
        assetTypeCounts[at] = (assetTypeCounts[at] || 0) + 1;

        // Damage type
        var dt = cc.damage_type || "unknown";
        damageTypeCounts[dt] = (damageTypeCounts[dt] || 0) + 1;

        // Overrides
        if (cc.inspector_override_active) overrideCount++;

        // Adjudications
        if (cc.adjudication_count && cc.adjudication_count > 0) adjudicatedCount++;

        // Confidence
        if (cc.confidence !== null && cc.confidence !== undefined) {
          confidenceSum += cc.confidence;
          confidenceCount++;
          if (confidenceMin === null || cc.confidence < confidenceMin) confidenceMin = cc.confidence;
          if (confidenceMax === null || cc.confidence > confidenceMax) confidenceMax = cc.confidence;
        }

        // Monthly trend
        if (cc.created_at) {
          var monthKey = cc.created_at.substring(0, 7); // YYYY-MM
          monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        }
      }

      // Build monthly trend sorted by date
      var monthKeys = Object.keys(monthCounts).sort();
      var monthlyTrend = [];
      for (var mki = 0; mki < monthKeys.length; mki++) {
        monthlyTrend.push({ month: monthKeys[mki], count: monthCounts[monthKeys[mki]] });
      }

      // Sort breakdowns by count (descending)
      function sortBreakdown(counts) {
        var keys = Object.keys(counts);
        var arr = [];
        for (var ki = 0; ki < keys.length; ki++) {
          arr.push({ value: keys[ki], count: counts[keys[ki]] });
        }
        arr.sort(function(a, b) { return b.count - a.count; });
        return arr;
      }

      var analytics = {
        total_cases: totalCases,
        filters_applied: filters,
        confidence: {
          average: confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 1000) / 1000 : null,
          min: confidenceMin,
          max: confidenceMax,
          cases_with_confidence: confidenceCount
        },
        override_rate: {
          overridden: overrideCount,
          total: totalCases,
          percentage: totalCases > 0 ? Math.round((overrideCount / totalCases) * 1000) / 10 : 0
        },
        adjudication_rate: {
          adjudicated: adjudicatedCount,
          total: totalCases,
          percentage: totalCases > 0 ? Math.round((adjudicatedCount / totalCases) * 1000) / 10 : 0
        },
        breakdowns: {
          by_disposition: sortBreakdown(dispositionCounts),
          by_state: sortBreakdown(stateCounts),
          by_material: sortBreakdown(materialCounts),
          by_inspection_method: sortBreakdown(methodCounts),
          by_asset_type: sortBreakdown(assetTypeCounts),
          by_damage_type: sortBreakdown(damageTypeCounts)
        },
        monthly_trend: monthlyTrend,
        response_ms: Date.now() - startTime
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(analytics, null, 2)
      };
    }

    // ── ACTION: search ──
    if (action !== "search") return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };

    var page = body.page || 1;
    var pageSize = body.page_size || DEFAULT_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;
    if (page < 1) page = 1;

    var sortField = "created_at";
    var sortDir = "desc";
    if (body.sort && body.sort.field) {
      var isValid = false;
      for (var vsi = 0; vsi < VALID_SORT_FIELDS.length; vsi++) {
        if (VALID_SORT_FIELDS[vsi] === body.sort.field) { isValid = true; break; }
      }
      if (isValid) sortField = body.sort.field;
    }
    if (body.sort && body.sort.direction === "asc") sortDir = "asc";

    var offset = (page - 1) * pageSize;

    // Count total matching records
    var countQuery = sb.from("inspection_cases").select("id", { count: "exact", head: true });
    countQuery = applyFilters(countQuery, filters);
    var countResult = await countQuery;
    var totalCount = countResult.count || 0;

    // Fetch page of results
    var searchQuery = sb.from("inspection_cases").select("id, case_number, status, state, disposition, confidence, material, material_family, asset_type, component_name, inspection_method, damage_type, severity, inspector_override_active, inspector_final_decision, adjudication_count, last_adjudication_type, audit_bundle_count, audit_chain_valid, created_at, updated_at");
    searchQuery = applyFilters(searchQuery, filters);
    searchQuery = searchQuery.order(sortField, { ascending: sortDir === "asc" });
    searchQuery = searchQuery.range(offset, offset + pageSize - 1);

    var searchResult = await searchQuery;
    if (searchResult.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: searchResult.error.message }) };
    }

    var totalPages = Math.ceil(totalCount / pageSize);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        results: searchResult.data || [],
        pagination: {
          page: page,
          page_size: pageSize,
          total_results: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        },
        sort: { field: sortField, direction: sortDir },
        filters_applied: filters,
        response_ms: Date.now() - startTime
      }, null, 2)
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
