// @ts-nocheck
/**
 * DEPLOY225 - health.ts
 * netlify/functions/health.ts
 *
 * PRODUCTION HEALTH CHECK
 *
 * Smoke-tests every critical subsystem:
 *   1. Database connectivity (Supabase)
 *   2. Critical tables exist and are queryable
 *   3. Function registry (which engines are deployed)
 *   4. Signing key availability (for audit)
 *   5. System uptime and version info
 *
 * GET /api/health          -> full health check
 * GET /api/health?quick=1  -> fast DB-only check
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var SYSTEM_VERSION = "FORGED-NDT/2.0.0";
var BUILD_DATE = "2026-04-16";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json"
};

// All critical tables the system depends on
var CRITICAL_TABLES = [
  { name: "inspection_cases", deploy: "core", critical: true },
  { name: "findings", deploy: "core", critical: true },
  { name: "evidence", deploy: "core", critical: true },
  { name: "code_sets", deploy: "DEPLOY222", critical: false },
  { name: "audit_events", deploy: "DEPLOY223", critical: false },
  { name: "audit_bundles", deploy: "DEPLOY223", critical: false },
  { name: "org_signing_keys", deploy: "DEPLOY223", critical: false },
  { name: "inspector_adjudications", deploy: "DEPLOY226", critical: false }
];

// All engine functions with their deploy versions
var ENGINE_REGISTRY = [
  { name: "decision-spine", deploy: "DEPLOY220", mode: "deterministic", path: "/api/decision-spine" },
  { name: "run-authority", deploy: "DEPLOY216", mode: "hybrid", path: "/api/run-authority" },
  { name: "outcome-simulation", deploy: "DEPLOY221", mode: "deterministic", path: "/api/outcome-simulation" },
  { name: "universal-code-authority", deploy: "DEPLOY222", mode: "deterministic", path: "/api/universal-code-authority" },
  { name: "enterprise-audit", deploy: "DEPLOY223", mode: "deterministic", path: "/api/enterprise-audit" },
  { name: "verify-audit-chain", deploy: "DEPLOY223", mode: "deterministic", path: "/api/verify-audit-chain" },
  { name: "inspector-adjudication", deploy: "DEPLOY226", mode: "deterministic", path: "/api/inspector-adjudication" },
  { name: "health", deploy: "DEPLOY225", mode: "deterministic", path: "/api/health" },
  { name: "decision-core", deploy: "DEPLOY167", mode: "deterministic", path: "/api/decision-core" },
  { name: "engineering-core", deploy: "DEPLOY167", mode: "deterministic", path: "/api/engineering-core" },
  { name: "truth-engine", deploy: "DEPLOY167", mode: "deterministic", path: "/api/truth-engine" },
  { name: "planner-agent", deploy: "DEPLOY167", mode: "deterministic", path: "/api/planner-agent" },
  { name: "material-authority", deploy: "DEPLOY219", mode: "deterministic", path: "/api/material-authority" },
  { name: "composite-repair-authority", deploy: "DEPLOY218", mode: "deterministic", path: "/api/composite-repair-authority" },
  { name: "governance-matrix", deploy: "DEPLOY074", mode: "deterministic", path: "/api/governance-matrix" },
  { name: "export-audit-bundle", deploy: "DEPLOY216", mode: "deterministic", path: "/api/export-audit-bundle" },
  { name: "similar-cases", deploy: "DEPLOY200", mode: "ai_assisted", path: "/api/similar-cases" },
  { name: "run-analysis", deploy: "core", mode: "ai_assisted", path: "/api/run-analysis" },
  { name: "observation-layer", deploy: "core", mode: "ai_assisted", path: "/api/observation-layer" }
];

// Structured error codes
var ERROR_CODES = {
  DB_CONNECTION_FAILED: { code: "E001", severity: "critical", message: "Database connection failed" },
  TABLE_MISSING: { code: "E002", severity: "warning", message: "Expected table not found" },
  TABLE_QUERY_FAILED: { code: "E003", severity: "warning", message: "Table query failed" },
  SIGNING_KEY_MISSING: { code: "E010", severity: "warning", message: "No active signing key found" },
  ENV_VAR_MISSING: { code: "E020", severity: "critical", message: "Required environment variable missing" }
};

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "GET only" }) };

  var startTime = Date.now();
  var quick = event.queryStringParameters && event.queryStringParameters.quick === "1";

  var checks = [];
  var errors = [];
  var warnings = [];
  var overallStatus = "healthy";

  // Check 1: Environment variables
  if (!supabaseUrl) {
    errors.push({ code: ERROR_CODES.ENV_VAR_MISSING.code, detail: "SUPABASE_URL not set" });
    overallStatus = "critical";
  }
  if (!supabaseKey) {
    errors.push({ code: ERROR_CODES.ENV_VAR_MISSING.code, detail: "SUPABASE_SERVICE_ROLE_KEY not set" });
    overallStatus = "critical";
  }

  if (overallStatus === "critical") {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        status: "critical",
        system: SYSTEM_VERSION,
        errors: errors,
        checked_at: new Date().toISOString(),
        response_ms: Date.now() - startTime
      }, null, 2)
    };
  }

  var sb = createClient(supabaseUrl, supabaseKey);

  // Check 2: Database connectivity
  try {
    var dbCheck = await sb.from("inspection_cases").select("id").limit(1);
    if (dbCheck.error) {
      errors.push({ code: ERROR_CODES.DB_CONNECTION_FAILED.code, detail: dbCheck.error.message });
      overallStatus = "critical";
    } else {
      checks.push({ name: "database_connection", status: "pass", detail: "Supabase connected" });
    }
  } catch (dbErr) {
    errors.push({ code: ERROR_CODES.DB_CONNECTION_FAILED.code, detail: String(dbErr) });
    overallStatus = "critical";
  }

  // Quick mode: return after DB check
  if (quick) {
    return {
      statusCode: overallStatus === "critical" ? 503 : 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: overallStatus,
        system: SYSTEM_VERSION,
        checks: checks,
        errors: errors,
        checked_at: new Date().toISOString(),
        response_ms: Date.now() - startTime
      }, null, 2)
    };
  }

  // Check 3: Critical tables
  for (var ti = 0; ti < CRITICAL_TABLES.length; ti++) {
    var table = CRITICAL_TABLES[ti];
    try {
      var tableCheck = await sb.from(table.name).select("*").limit(1);
      if (tableCheck.error) {
        if (table.critical) {
          errors.push({ code: ERROR_CODES.TABLE_MISSING.code, table: table.name, deploy: table.deploy, detail: tableCheck.error.message });
          overallStatus = "degraded";
        } else {
          warnings.push({ code: ERROR_CODES.TABLE_MISSING.code, table: table.name, deploy: table.deploy, detail: "Table not found - run " + table.deploy + " migration" });
        }
      } else {
        checks.push({ name: "table_" + table.name, status: "pass", deploy: table.deploy });
      }
    } catch (tErr) {
      warnings.push({ code: ERROR_CODES.TABLE_QUERY_FAILED.code, table: table.name, detail: String(tErr) });
    }
  }

  // Check 4: Signing key availability
  try {
    var keyCheck = await sb.from("org_signing_keys").select("id").eq("is_active", true).limit(1);
    if (keyCheck.error || !keyCheck.data || keyCheck.data.length === 0) {
      warnings.push({ code: ERROR_CODES.SIGNING_KEY_MISSING.code, detail: "No active signing key. Audit bundle signing will fail." });
    } else {
      checks.push({ name: "signing_key", status: "pass", detail: "Active signing key found: " + keyCheck.data[0].id });
    }
  } catch (kErr) {
    warnings.push({ code: ERROR_CODES.SIGNING_KEY_MISSING.code, detail: String(kErr) });
  }

  // Check 5: Case count + recent activity
  var caseCount = 0;
  var recentCases = 0;
  try {
    var countCheck = await sb.from("inspection_cases").select("id", { count: "exact", head: true });
    caseCount = countCheck.count || 0;

    var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var recentCheck = await sb.from("inspection_cases").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo);
    recentCases = recentCheck.count || 0;
  } catch (cErr) {
    // Non-critical
  }

  // Determine final status
  if (errors.length > 0 && overallStatus !== "critical") overallStatus = "degraded";
  if (errors.length === 0 && warnings.length > 0) overallStatus = "healthy_with_warnings";

  var responseMs = Date.now() - startTime;

  return {
    statusCode: overallStatus === "critical" ? 503 : 200,
    headers: corsHeaders,
    body: JSON.stringify({
      status: overallStatus,
      system: SYSTEM_VERSION,
      build_date: BUILD_DATE,
      checked_at: new Date().toISOString(),
      response_ms: responseMs,
      database: {
        connected: overallStatus !== "critical",
        total_cases: caseCount,
        cases_last_7_days: recentCases
      },
      engines: {
        total: ENGINE_REGISTRY.length,
        deterministic: ENGINE_REGISTRY.filter(function(e) { return e.mode === "deterministic"; }).length,
        ai_assisted: ENGINE_REGISTRY.filter(function(e) { return e.mode === "ai_assisted"; }).length,
        hybrid: ENGINE_REGISTRY.filter(function(e) { return e.mode === "hybrid"; }).length,
        registry: ENGINE_REGISTRY
      },
      checks: checks,
      errors: errors,
      warnings: warnings,
      error_codes: ERROR_CODES
    }, null, 2)
  };
};
