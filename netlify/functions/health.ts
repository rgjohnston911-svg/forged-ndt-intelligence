// @ts-nocheck
/**
 * DEPLOY225 - health.ts
 * netlify/functions/health.ts
 *
 * PRODUCTION HEALTH CHECK
 *
 * POST /api/health {}         -> full health check
 * POST /api/health {quick:true} -> fast DB-only check
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

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
  { name: "observation-layer", deploy: "core", mode: "ai_assisted", path: "/api/observation-layer" },
  { name: "case-search", deploy: "DEPLOY227", mode: "deterministic", path: "/api/case-search" },
  { name: "escalation-workflow", deploy: "DEPLOY228", mode: "deterministic", path: "/api/escalation-workflow" },
  { name: "trend-analytics", deploy: "DEPLOY229", mode: "deterministic", path: "/api/trend-analytics" },
  { name: "notifications", deploy: "DEPLOY230", mode: "deterministic", path: "/api/notifications" },
  { name: "compliance-matrix", deploy: "DEPLOY231", mode: "deterministic", path: "/api/compliance-matrix" },
  { name: "risk-scoring", deploy: "DEPLOY232", mode: "deterministic", path: "/api/risk-scoring" },
  { name: "inspection-report", deploy: "DEPLOY233", mode: "deterministic", path: "/api/inspection-report" },
  { name: "rbac", deploy: "DEPLOY234", mode: "deterministic", path: "/api/rbac" },
  { name: "validation-engine", deploy: "DEPLOY235", mode: "deterministic", path: "/api/validation-engine" },
  { name: "data-ingestion", deploy: "DEPLOY236", mode: "deterministic", path: "/api/data-ingestion" },
  { name: "chemical-process", deploy: "DEPLOY237", mode: "deterministic", path: "/api/chemical-process" },
  { name: "nuclear-vertical", deploy: "DEPLOY238", mode: "deterministic", path: "/api/nuclear-vertical" },
  { name: "aerospace-vertical", deploy: "DEPLOY239", mode: "deterministic", path: "/api/aerospace-vertical" },
  { name: "power-generation", deploy: "DEPLOY240", mode: "deterministic", path: "/api/power-generation" },
  { name: "maritime-offshore", deploy: "DEPLOY241", mode: "deterministic", path: "/api/maritime-offshore" },
  { name: "civil-infrastructure", deploy: "DEPLOY242", mode: "deterministic", path: "/api/civil-infrastructure" },
  { name: "space-systems", deploy: "DEPLOY243", mode: "deterministic", path: "/api/space-systems" },
  { name: "robotics-automation", deploy: "DEPLOY244", mode: "deterministic", path: "/api/robotics-automation" },
  { name: "human-intelligence", deploy: "DEPLOY245", mode: "deterministic", path: "/api/human-intelligence" },
  { name: "medical-bio", deploy: "DEPLOY246", mode: "deterministic", path: "/api/medical-bio" }
];

function countByMode(mode) {
  var c = 0;
  for (var i = 0; i < ENGINE_REGISTRY.length; i++) {
    if (ENGINE_REGISTRY[i].mode === mode) c++;
  }
  return c;
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var quick = body.quick === true;
    var startTime = Date.now();

    var checks = [];
    var errors = [];
    var warnings = [];
    var overallStatus = "healthy";

    // Check 1: Environment variables
    if (!supabaseUrl) {
      errors.push({ code: "E020", detail: "SUPABASE_URL not set" });
      overallStatus = "critical";
    }
    if (!supabaseKey) {
      errors.push({ code: "E020", detail: "SUPABASE_SERVICE_ROLE_KEY not set" });
      overallStatus = "critical";
    }

    if (overallStatus === "critical") {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({ status: "critical", system: SYSTEM_VERSION, errors: errors, checked_at: new Date().toISOString(), response_ms: Date.now() - startTime })
      };
    }

    var sb = createClient(supabaseUrl, supabaseKey);

    // Check 2: Database connectivity
    var dbCheck = await sb.from("inspection_cases").select("id").limit(1);
    if (dbCheck.error) {
      errors.push({ code: "E001", detail: dbCheck.error.message });
      overallStatus = "critical";
    } else {
      checks.push({ name: "database_connection", status: "pass", detail: "Supabase connected" });
    }

    // Quick mode: return after DB check
    if (quick) {
      return {
        statusCode: overallStatus === "critical" ? 503 : 200,
        headers: corsHeaders,
        body: JSON.stringify({ status: overallStatus, system: SYSTEM_VERSION, checks: checks, errors: errors, checked_at: new Date().toISOString(), response_ms: Date.now() - startTime })
      };
    }

    // Check 3: Critical tables
    for (var ti = 0; ti < CRITICAL_TABLES.length; ti++) {
      var tbl = CRITICAL_TABLES[ti];
      var tblCheck = await sb.from(tbl.name).select("*").limit(1);
      if (tblCheck.error) {
        if (tbl.critical) {
          errors.push({ code: "E002", table: tbl.name, deploy: tbl.deploy, detail: tblCheck.error.message });
          if (overallStatus === "healthy") overallStatus = "degraded";
        } else {
          warnings.push({ code: "E002", table: tbl.name, deploy: tbl.deploy, detail: "Table not found - run " + tbl.deploy + " migration" });
        }
      } else {
        checks.push({ name: "table_" + tbl.name, status: "pass", deploy: tbl.deploy });
      }
    }

    // Check 4: Signing key
    var keyCheck = await sb.from("org_signing_keys").select("id").eq("is_active", true).limit(1);
    if (keyCheck.error || !keyCheck.data || keyCheck.data.length === 0) {
      warnings.push({ code: "E010", detail: "No active signing key" });
    } else {
      checks.push({ name: "signing_key", status: "pass", detail: "Active key: " + keyCheck.data[0].id });
    }

    // Check 5: Case count
    var caseCount = 0;
    var recentCases = 0;
    var countCheck = await sb.from("inspection_cases").select("id", { count: "exact", head: true });
    caseCount = countCheck.count || 0;
    var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var recentCheck = await sb.from("inspection_cases").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo);
    recentCases = recentCheck.count || 0;

    // Final status
    if (errors.length > 0 && overallStatus !== "critical") overallStatus = "degraded";
    if (errors.length === 0 && warnings.length > 0) overallStatus = "healthy_with_warnings";

    return {
      statusCode: overallStatus === "critical" ? 503 : 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: overallStatus,
        system: SYSTEM_VERSION,
        build_date: BUILD_DATE,
        checked_at: new Date().toISOString(),
        response_ms: Date.now() - startTime,
        database: { connected: true, total_cases: caseCount, cases_last_7_days: recentCases },
        engines: { total: ENGINE_REGISTRY.length, deterministic: countByMode("deterministic"), ai_assisted: countByMode("ai_assisted"), hybrid: countByMode("hybrid"), registry: ENGINE_REGISTRY },
        checks: checks,
        errors: errors,
        warnings: warnings
      }, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
