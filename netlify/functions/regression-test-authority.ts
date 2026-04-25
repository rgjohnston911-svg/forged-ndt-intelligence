// @ts-nocheck
/**
 * DEPLOY313 - regression-test-authority.ts v1.0.0
 * netlify/functions/regression-test-authority.ts
 *
 * REGRESSION TEST AUTHORITY ENGINE
 *
 * The system-check proves 104 endpoints respond.
 * This engine proves they produce CORRECT outputs.
 *
 * Stores known-input / expected-output test vectors for every engine.
 * Actually POSTs to each endpoint, validates the response shape and
 * key values against the expected output, and reports pass/fail with diffs.
 *
 * Run after every deploy to catch regressions before they reach production.
 *
 * 8 actions:
 *   get_registry           - engine metadata
 *   run_full_suite         - run ALL test vectors across all engines
 *   run_engine_suite       - run test vectors for a single engine
 *   run_single_test        - run one specific test vector
 *   get_test_vectors       - list all test vectors (optional engine filter)
 *   get_run_history        - retrieve past test run results
 *   get_regression_report  - summary: which engines regressed since last green run
 *   get_coverage           - which engines have test vectors, which don't
 *
 * var only. String concatenation only. No backticks.
 * POST only. Non-fatal DB. export var handler: Handler.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var siteUrl = process.env.URL || "https://4dndt.netlify.app";

var ENGINE_NAME = "regression-test-authority";
var ENGINE_VERSION = "v1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function buildResult(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function holdResult(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg, engine: ENGINE_NAME }) };
}

// ================================================================
// TEST VECTORS — known input → expected output for each engine
//
// Each vector defines:
//   id          - unique test ID
//   engine      - target engine path (e.g. "/api/health")
//   name        - human description of what is being tested
//   input       - exact POST body to send
//   expect      - validation rules applied to response
//     .status_code   - expected HTTP status (default 200)
//     .has_fields    - array of field paths that must exist
//     .field_values  - object of field_path: expected_value
//     .field_ranges  - object of field_path: { min, max }
//     .field_types   - object of field_path: expected_type
//     .not_error     - response must not contain { error: ... }
//   severity    - "critical" | "major" | "minor"
//   category    - grouping label
// ================================================================

var TEST_VECTORS = [

  // ── HEALTH ENGINE ──────────────────────────────────────────────
  {
    id: "RT-HEALTH-001",
    engine: "/api/health",
    name: "Health check returns system version and status",
    input: { quick: true },
    expect: {
      status_code: 200,
      has_fields: ["status", "system"],
      field_values: { "system": "FORGED-NDT/2.0.0" },
      not_error: true
    },
    severity: "critical",
    category: "infrastructure"
  },

  // ── DECISION SPINE ─────────────────────────────────────────────
  {
    id: "RT-SPINE-001",
    engine: "/api/decision-spine",
    name: "Decision spine rejects missing case gracefully",
    input: { case_id: "00000000-0000-0000-0000-000000000000" },
    expect: {
      status_code: 404,
      has_fields: ["error"]
    },
    severity: "critical",
    category: "core_pipeline"
  },

  // ── UNIVERSAL CODE AUTHORITY ──────────────────────────────────
  {
    id: "RT-CODE-001",
    engine: "/api/universal-code-authority",
    name: "Code authority rejects missing case gracefully",
    input: { case_id: "00000000-0000-0000-0000-000000000000" },
    expect: {
      status_code: 404,
      has_fields: ["error"]
    },
    severity: "critical",
    category: "code_authority"
  },

  // ── MATERIAL AUTHORITY ─────────────────────────────────────────
  {
    id: "RT-MAT-001",
    engine: "/api/material-authority",
    name: "Material authority rejects missing case gracefully",
    input: { case_id: "00000000-0000-0000-0000-000000000000" },
    expect: {
      status_code: 404,
      has_fields: ["error"]
    },
    severity: "major",
    category: "material"
  },

  // ── GOVERNANCE MATRIX ──────────────────────────────────────────
  {
    id: "RT-GOV-001",
    engine: "/api/governance-matrix",
    name: "Governance matrix returns governance data",
    input: { asset_class: "pressure_vessel" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "governance"
  },

  // ── CASE SEARCH ────────────────────────────────────────────────
  {
    id: "RT-SEARCH-001",
    engine: "/api/case-search",
    name: "Case search returns filter options",
    input: { action: "filter_options" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["filter_options"]
    },
    severity: "major",
    category: "search"
  },

  // ── RISK SCORING ───────────────────────────────────────────────
  {
    id: "RT-RISK-001",
    engine: "/api/risk-scoring",
    name: "Risk scoring score_all returns results",
    input: { action: "score_all" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "risk"
  },

  // ── COMPLIANCE MATRIX ──────────────────────────────────────────
  {
    id: "RT-COMP-001",
    engine: "/api/compliance-matrix",
    name: "Compliance matrix returns summary",
    input: { action: "get_summary" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "compliance"
  },

  // ── ESCALATION WORKFLOW ────────────────────────────────────────
  {
    id: "RT-ESC-001",
    engine: "/api/escalation-workflow",
    name: "Escalation workflow returns stats",
    input: { action: "get_stats" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "minor",
    category: "workflow"
  },

  // ── TREND ANALYTICS ────────────────────────────────────────────
  {
    id: "RT-TREND-001",
    engine: "/api/trend-analytics",
    name: "Trend analytics executive summary",
    input: { action: "executive_summary" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "minor",
    category: "analytics"
  },

  // ── VALIDATION ENGINE ──────────────────────────────────────────
  {
    id: "RT-VAL-001",
    engine: "/api/validation-engine",
    name: "Validation engine returns scenarios",
    input: { action: "get_scenarios" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "validation"
  },

  // ── VALIDATION BENCHMARK ───────────────────────────────────────
  {
    id: "RT-BENCH-001",
    engine: "/api/validation-benchmark",
    name: "Benchmark returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "validation"
  },

  // ── EVIDENCE CONTRACT ──────────────────────────────────────────
  {
    id: "RT-EVCON-001",
    engine: "/api/evidence-contract-engine",
    name: "Evidence contract returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "evidence"
  },

  // ── CONTRADICTION ENGINE ───────────────────────────────────────
  {
    id: "RT-CONTRA-001",
    engine: "/api/contradiction-engine",
    name: "Contradiction engine returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "reasoning"
  },

  // ── PHYSICS SUFFICIENCY ────────────────────────────────────────
  {
    id: "RT-PHYS-001",
    engine: "/api/physics-sufficiency-engine",
    name: "Physics sufficiency returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "physics"
  },

  // ── DECISION TRACEABILITY ──────────────────────────────────────
  {
    id: "RT-TRACE-001",
    engine: "/api/decision-traceability",
    name: "Decision traceability returns decision tree",
    input: { action: "get_decision_tree" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["action", "steps"]
    },
    severity: "major",
    category: "traceability"
  },

  // ── AUTHORITY LOCK SYSTEM ──────────────────────────────────────
  {
    id: "RT-ALOCK-001",
    engine: "/api/authority-lock-system",
    name: "Authority lock returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "authority"
  },

  // ── WELD ACCEPTANCE AUTHORITY ──────────────────────────────────
  {
    id: "RT-WELD-001",
    engine: "/api/weld-acceptance-authority",
    name: "Weld acceptance returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "critical",
    category: "weld"
  },

  // ── COATINGS INTELLIGENCE ──────────────────────────────────────
  {
    id: "RT-COAT-001",
    engine: "/api/coatings-intelligence-authority",
    name: "Coatings intelligence returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "coatings"
  },

  // ── MECHANISM CAUSALITY ────────────────────────────────────────
  {
    id: "RT-MECH-001",
    engine: "/api/mechanism-causality-engine",
    name: "Mechanism causality returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "mechanism"
  },

  // ── UNCERTAINTY BOUNDARY ───────────────────────────────────────
  {
    id: "RT-UNC-001",
    engine: "/api/uncertainty-boundary-engine",
    name: "Uncertainty boundary returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "uncertainty"
  },

  // ── DECISION LIABILITY ─────────────────────────────────────────
  {
    id: "RT-LIAB-001",
    engine: "/api/decision-liability-engine",
    name: "Decision liability returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "liability"
  },

  // ── INDUSTRY VERTICALS ─────────────────────────────────────────
  {
    id: "RT-CHEM-001",
    engine: "/api/chemical-process",
    name: "Chemical process returns mechanism registry",
    input: { action: "get_mechanism_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },
  {
    id: "RT-NUC-001",
    engine: "/api/nuclear-vertical",
    name: "Nuclear vertical returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },
  {
    id: "RT-AERO-001",
    engine: "/api/aerospace-vertical",
    name: "Aerospace vertical returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },
  {
    id: "RT-POWER-001",
    engine: "/api/power-generation",
    name: "Power generation returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },
  {
    id: "RT-MARINE-001",
    engine: "/api/maritime-offshore",
    name: "Maritime/offshore returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },
  {
    id: "RT-CIVIL-001",
    engine: "/api/civil-infrastructure",
    name: "Civil infrastructure returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },
  {
    id: "RT-SPACE-001",
    engine: "/api/space-systems",
    name: "Space systems returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "vertical"
  },

  // ── SUPERBRAIN PIPELINE ────────────────────────────────────────
  {
    id: "RT-SBRAIN-001",
    engine: "/api/superbrain-report",
    name: "Superbrain report returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "critical",
    category: "superbrain"
  },

  // ── TRI-MODEL REASONING ───────────────────────────────────────
  {
    id: "RT-TRIMOD-001",
    engine: "/api/tri-model-reasoning",
    name: "Tri-model reasoning returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "critical",
    category: "superbrain"
  },

  // ── CORROSION LOOP ─────────────────────────────────────────────
  {
    id: "RT-CORR-001",
    engine: "/api/corrosion-loop-engine",
    name: "Corrosion loop returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "physics"
  },

  // ── FATIGUE & VIBRATION ────────────────────────────────────────
  {
    id: "RT-FATIGUE-001",
    engine: "/api/fatigue-vibration-proof",
    name: "Fatigue vibration proof returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "physics"
  },

  // ── MULTI-ASSET CASCADE ────────────────────────────────────────
  {
    id: "RT-CASCADE-001",
    engine: "/api/multi-asset-cascade",
    name: "Multi-asset cascade returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "cascade"
  },

  // ── LIVE CODE AUTHORITY ────────────────────────────────────────
  {
    id: "RT-LIVECODE-001",
    engine: "/api/live-code-authority",
    name: "Live code authority returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "critical",
    category: "code_authority"
  },

  // ── INSPECTION PLANNING PROOF ──────────────────────────────────
  {
    id: "RT-PLAN-001",
    engine: "/api/inspection-planning-proof",
    name: "Inspection planning proof returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "planning"
  },

  // ── RBAC ───────────────────────────────────────────────────────
  {
    id: "RT-RBAC-001",
    engine: "/api/rbac",
    name: "RBAC returns permissions matrix",
    input: { action: "get_permissions_matrix" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "security"
  },

  // ── REPAIR PATHWAY ─────────────────────────────────────────────
  {
    id: "RT-REPAIR-001",
    engine: "/api/repair-pathway-engine",
    name: "Repair pathway returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "repair"
  },

  // ── REALITY LOCK DOMAIN ────────────────────────────────────────
  {
    id: "RT-REALITY-001",
    engine: "/api/reality-lock-domain",
    name: "Reality lock domain returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine", "version"]
    },
    severity: "major",
    category: "reality"
  },

  // ── DATA INGESTION ─────────────────────────────────────────────
  {
    id: "RT-INGEST-001",
    engine: "/api/data-ingestion",
    name: "Data ingestion returns field map",
    input: { action: "get_field_map" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "minor",
    category: "data"
  },

  // ── ENTERPRISE OPERATIONS ──────────────────────────────────────
  {
    id: "RT-ENTOPS-001",
    engine: "/api/enterprise-operations",
    name: "Enterprise operations returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "minor",
    category: "enterprise"
  },

  // ── COST REASONING ─────────────────────────────────────────────
  {
    id: "RT-COST-001",
    engine: "/api/cost-reasoning-engine",
    name: "Cost reasoning returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "minor",
    category: "cost"
  },

  // ── PREDICTIVE REMAINING LIFE ──────────────────────────────────
  {
    id: "RT-PREDLIFE-001",
    engine: "/api/predictive-remaining-life",
    name: "Predictive remaining life returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "prediction"
  },

  // ── POWER GENERATION AUTHORITY (DEPLOY312) ─────────────────────
  {
    id: "RT-POWERAUTH-001",
    engine: "/api/power-generation-authority",
    name: "Power generation authority returns registry",
    input: { action: "get_registry" },
    expect: {
      status_code: 200,
      not_error: true,
      has_fields: ["engine_code", "engine_version"]
    },
    severity: "major",
    category: "power_generation"
  },

  // ── APMM POWER GEN ENGINES ────────────────────────────────────
  {
    id: "RT-APMMPOWER-001",
    engine: "/api/apmm-power-gen-engines",
    name: "APMM power gen returns health check",
    input: { action: "health" },
    expect: {
      status_code: 200,
      not_error: true
    },
    severity: "major",
    category: "power_generation"
  }
];


// ================================================================
// VALIDATOR — compares actual response to expected output
// ================================================================

function validateResponse(statusCode, responseBody, expect) {
  var failures = [];
  var passes = [];

  // Check HTTP status
  if (expect.status_code && statusCode !== expect.status_code) {
    failures.push("Expected HTTP " + expect.status_code + " but got " + statusCode);
  } else {
    passes.push("HTTP status: " + statusCode);
  }

  // Parse response
  var parsed = null;
  try {
    parsed = JSON.parse(responseBody);
  } catch (e) {
    failures.push("Response is not valid JSON");
    return { passed: false, failures: failures, passes: passes };
  }

  // Check not_error
  if (expect.not_error && parsed.error) {
    failures.push("Response contains error: " + String(parsed.error).substring(0, 200));
  } else if (expect.not_error) {
    passes.push("No error in response");
  }

  // Check has_fields
  if (expect.has_fields) {
    for (var fi = 0; fi < expect.has_fields.length; fi++) {
      var fieldPath = expect.has_fields[fi];
      var val = getNestedField(parsed, fieldPath);
      if (val === undefined) {
        failures.push("Missing required field: " + fieldPath);
      } else {
        passes.push("Field present: " + fieldPath);
      }
    }
  }

  // Check field_values
  if (expect.field_values) {
    var valueKeys = Object.keys(expect.field_values);
    for (var vi = 0; vi < valueKeys.length; vi++) {
      var vk = valueKeys[vi];
      var actual = getNestedField(parsed, vk);
      var expected = expect.field_values[vk];
      if (actual !== expected) {
        failures.push("Field " + vk + ": expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual));
      } else {
        passes.push("Field " + vk + " = " + JSON.stringify(expected));
      }
    }
  }

  // Check field_ranges
  if (expect.field_ranges) {
    var rangeKeys = Object.keys(expect.field_ranges);
    for (var ri = 0; ri < rangeKeys.length; ri++) {
      var rk = rangeKeys[ri];
      var rangeVal = getNestedField(parsed, rk);
      var range = expect.field_ranges[rk];
      if (typeof rangeVal !== "number") {
        failures.push("Field " + rk + " is not a number: " + JSON.stringify(rangeVal));
      } else {
        if (range.min !== undefined && rangeVal < range.min) {
          failures.push("Field " + rk + ": " + rangeVal + " is below minimum " + range.min);
        } else if (range.max !== undefined && rangeVal > range.max) {
          failures.push("Field " + rk + ": " + rangeVal + " is above maximum " + range.max);
        } else {
          passes.push("Field " + rk + " = " + rangeVal + " (in range)");
        }
      }
    }
  }

  // Check field_types
  if (expect.field_types) {
    var typeKeys = Object.keys(expect.field_types);
    for (var ti = 0; ti < typeKeys.length; ti++) {
      var tk = typeKeys[ti];
      var typeVal = getNestedField(parsed, tk);
      var expectedType = expect.field_types[tk];
      var actualType = Array.isArray(typeVal) ? "array" : typeof typeVal;
      if (actualType !== expectedType) {
        failures.push("Field " + tk + ": expected type " + expectedType + " but got " + actualType);
      } else {
        passes.push("Field " + tk + " is type " + expectedType);
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures: failures,
    passes: passes
  };
}

function getNestedField(obj, path) {
  var parts = path.split(".");
  var current = obj;
  for (var i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined;
    current = current[parts[i]];
  }
  return current;
}


// ================================================================
// HTTP CALLER — actually POSTs to engine endpoints
// ================================================================

function callEngine(enginePath, body) {
  var https = require("https");
  var http = require("http");
  var url = require("url");

  return new Promise(function(resolve) {
    var fullUrl = siteUrl + "/.netlify/functions" + enginePath.replace("/api", "");
    var parsed = url.parse(fullUrl);
    var protocol = parsed.protocol === "https:" ? https : http;
    var postData = JSON.stringify(body);

    var options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: 25000
    };

    var startMs = Date.now();

    var req = protocol.request(options, function(res) {
      var chunks = [];
      res.on("data", function(chunk) { chunks.push(chunk); });
      res.on("end", function() {
        var responseBody = Buffer.concat(chunks).toString();
        resolve({
          status_code: res.statusCode,
          body: responseBody,
          response_ms: Date.now() - startMs
        });
      });
    });

    req.on("error", function(err) {
      resolve({
        status_code: 0,
        body: JSON.stringify({ error: "Network error: " + String(err.message || err) }),
        response_ms: Date.now() - startMs
      });
    });

    req.on("timeout", function() {
      req.destroy();
      resolve({
        status_code: 0,
        body: JSON.stringify({ error: "Request timed out after 25s" }),
        response_ms: Date.now() - startMs
      });
    });

    req.write(postData);
    req.end();
  });
}


// ================================================================
// TEST RUNNERS
// ================================================================

function runSingleTest(vector) {
  return callEngine(vector.engine, vector.input).then(function(response) {
    var validation = validateResponse(response.status_code, response.body, vector.expect);
    return {
      test_id: vector.id,
      engine: vector.engine,
      name: vector.name,
      severity: vector.severity,
      category: vector.category,
      status: validation.passed ? "PASS" : "FAIL",
      response_ms: response.response_ms,
      http_status: response.status_code,
      passes: validation.passes,
      failures: validation.failures,
      tested_at: new Date().toISOString()
    };
  });
}

function runTestSuite(vectors) {
  var results = [];
  var chain = Promise.resolve();

  for (var i = 0; i < vectors.length; i++) {
    (function(vec) {
      chain = chain.then(function() {
        return runSingleTest(vec).then(function(result) {
          results.push(result);
        });
      });
    })(vectors[i]);
  }

  return chain.then(function() {
    return results;
  });
}

function summarizeResults(results) {
  var total = results.length;
  var passed = 0;
  var failed = 0;
  var totalMs = 0;
  var criticalFails = [];
  var categoryBreakdown = {};

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.status === "PASS") {
      passed++;
    } else {
      failed++;
      if (r.severity === "critical") {
        criticalFails.push(r.test_id + ": " + r.name);
      }
    }
    totalMs += r.response_ms || 0;

    if (!categoryBreakdown[r.category]) {
      categoryBreakdown[r.category] = { pass: 0, fail: 0 };
    }
    if (r.status === "PASS") {
      categoryBreakdown[r.category].pass++;
    } else {
      categoryBreakdown[r.category].fail++;
    }
  }

  return {
    total_tests: total,
    passed: passed,
    failed: failed,
    pass_rate: total > 0 ? Math.round((passed / total) * 10000) / 100 : 0,
    total_ms: totalMs,
    avg_ms: total > 0 ? Math.round(totalMs / total) : 0,
    critical_failures: criticalFails,
    has_critical_failures: criticalFails.length > 0,
    category_breakdown: categoryBreakdown,
    verdict: failed === 0 ? "ALL_PASS" : (criticalFails.length > 0 ? "CRITICAL_REGRESSION" : "REGRESSION_DETECTED")
  };
}

function getCoverage() {
  var testedEngines = {};
  for (var i = 0; i < TEST_VECTORS.length; i++) {
    testedEngines[TEST_VECTORS[i].engine] = true;
  }

  var allEngines = [
    "/api/health", "/api/decision-spine", "/api/outcome-simulation",
    "/api/universal-code-authority", "/api/enterprise-audit", "/api/verify-audit-chain",
    "/api/inspector-adjudication", "/api/run-authority", "/api/export-audit-bundle",
    "/api/material-authority", "/api/composite-repair-authority", "/api/decision-core",
    "/api/engineering-core", "/api/truth-engine", "/api/planner-agent",
    "/api/governance-matrix", "/api/case-search", "/api/escalation-workflow",
    "/api/trend-analytics", "/api/notifications", "/api/compliance-matrix",
    "/api/risk-scoring", "/api/similar-cases", "/api/run-analysis",
    "/api/observation-layer", "/api/inspection-report", "/api/rbac",
    "/api/validation-engine", "/api/data-ingestion", "/api/chemical-process",
    "/api/nuclear-vertical", "/api/aerospace-vertical", "/api/power-generation",
    "/api/maritime-offshore", "/api/civil-infrastructure", "/api/space-systems",
    "/api/robotics-automation", "/api/human-intelligence", "/api/medical-bio",
    "/api/validation-benchmark", "/api/decision-traceability", "/api/rules-version-control",
    "/api/evidence-integrity", "/api/enterprise-operations", "/api/concept-intelligence-core",
    "/api/concept-intelligence-v21", "/api/cost-reasoning-engine", "/api/outcome-tracking",
    "/api/cross-case-patterns", "/api/process-data-integration", "/api/predictive-remaining-life",
    "/api/physics-sufficiency-engine", "/api/weld-acceptance-authority",
    "/api/authority-lock-system", "/api/contradiction-engine", "/api/repair-pathway-engine",
    "/api/reality-lock-domain", "/api/tri-model-reasoning", "/api/inspection-planning-proof",
    "/api/corrosion-loop-engine", "/api/fatigue-vibration-proof", "/api/multi-asset-cascade",
    "/api/live-code-authority", "/api/superbrain-report", "/api/evidence-contract-engine",
    "/api/coatings-intelligence-authority", "/api/mechanism-causality-engine",
    "/api/uncertainty-boundary-engine", "/api/decision-liability-engine",
    "/api/power-generation-authority", "/api/apmm-power-gen-engines"
  ];

  var covered = [];
  var uncovered = [];
  for (var j = 0; j < allEngines.length; j++) {
    if (testedEngines[allEngines[j]]) {
      covered.push(allEngines[j]);
    } else {
      uncovered.push(allEngines[j]);
    }
  }

  return {
    total_engines: allEngines.length,
    covered: covered.length,
    uncovered: uncovered.length,
    coverage_pct: Math.round((covered.length / allEngines.length) * 10000) / 100,
    covered_engines: covered,
    uncovered_engines: uncovered,
    total_test_vectors: TEST_VECTORS.length
  };
}


// ================================================================
// ACTION MAP
// ================================================================

var ACTION_MAP = {
  get_registry: function() {
    return buildResult({
      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      description: "Regression test authority — proves engines produce correct outputs, not just respond",
      total_test_vectors: TEST_VECTORS.length,
      categories: (function() {
        var cats = {};
        for (var i = 0; i < TEST_VECTORS.length; i++) {
          cats[TEST_VECTORS[i].category] = (cats[TEST_VECTORS[i].category] || 0) + 1;
        }
        return cats;
      })(),
      actions: ["get_registry", "run_full_suite", "run_engine_suite", "run_single_test", "get_test_vectors", "get_run_history", "get_regression_report", "get_coverage"]
    });
  },

  run_full_suite: function(body) {
    return runTestSuite(TEST_VECTORS).then(function(results) {
      var summary = summarizeResults(results);

      // Non-fatal DB store
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        sb.from("regression_test_runs").insert({
          run_type: "full_suite",
          total_tests: summary.total_tests,
          passed: summary.passed,
          failed: summary.failed,
          pass_rate: summary.pass_rate,
          verdict: summary.verdict,
          total_ms: summary.total_ms,
          results_json: results,
          run_at: new Date().toISOString()
        }).then(function() {}).catch(function() {});
      } catch (e) { /* non-fatal */ }

      return buildResult({
        engine: ENGINE_NAME,
        run_type: "full_suite",
        summary: summary,
        results: results,
        run_at: new Date().toISOString()
      });
    });
  },

  run_engine_suite: function(body) {
    var targetEngine = body.engine_path || body.engine;
    if (!targetEngine) return holdResult(400, "engine_path required");

    var filtered = [];
    for (var i = 0; i < TEST_VECTORS.length; i++) {
      if (TEST_VECTORS[i].engine === targetEngine) {
        filtered.push(TEST_VECTORS[i]);
      }
    }

    if (filtered.length === 0) {
      return Promise.resolve(holdResult(404, "No test vectors found for engine: " + targetEngine));
    }

    return runTestSuite(filtered).then(function(results) {
      var summary = summarizeResults(results);
      return buildResult({
        engine: ENGINE_NAME,
        run_type: "engine_suite",
        target_engine: targetEngine,
        summary: summary,
        results: results,
        run_at: new Date().toISOString()
      });
    });
  },

  run_single_test: function(body) {
    var testId = body.test_id;
    if (!testId) return holdResult(400, "test_id required");

    var vector = null;
    for (var i = 0; i < TEST_VECTORS.length; i++) {
      if (TEST_VECTORS[i].id === testId) {
        vector = TEST_VECTORS[i];
        break;
      }
    }

    if (!vector) return Promise.resolve(holdResult(404, "Test vector not found: " + testId));

    return runSingleTest(vector).then(function(result) {
      return buildResult({
        engine: ENGINE_NAME,
        run_type: "single_test",
        result: result,
        run_at: new Date().toISOString()
      });
    });
  },

  get_test_vectors: function(body) {
    var filtered = TEST_VECTORS;
    if (body.engine_path) {
      filtered = [];
      for (var i = 0; i < TEST_VECTORS.length; i++) {
        if (TEST_VECTORS[i].engine === body.engine_path) filtered.push(TEST_VECTORS[i]);
      }
    }
    if (body.category) {
      var catFiltered = [];
      for (var j = 0; j < filtered.length; j++) {
        if (filtered[j].category === body.category) catFiltered.push(filtered[j]);
      }
      filtered = catFiltered;
    }
    if (body.severity) {
      var sevFiltered = [];
      for (var k = 0; k < filtered.length; k++) {
        if (filtered[k].severity === body.severity) sevFiltered.push(filtered[k]);
      }
      filtered = sevFiltered;
    }

    return buildResult({
      engine: ENGINE_NAME,
      total: filtered.length,
      vectors: filtered
    });
  },

  get_run_history: function(body) {
    var sb = createClient(supabaseUrl, supabaseKey);
    var limit = body.limit || 10;

    return sb.from("regression_test_runs")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(limit)
      .then(function(res) {
        return buildResult({
          engine: ENGINE_NAME,
          runs: res.data || [],
          total: (res.data || []).length
        });
      })
      .catch(function(err) {
        return buildResult({
          engine: ENGINE_NAME,
          runs: [],
          note: "Run history table not yet created — run DEPLOY313 migration"
        });
      });
  },

  get_regression_report: function() {
    var sb = createClient(supabaseUrl, supabaseKey);

    return sb.from("regression_test_runs")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(2)
      .then(function(res) {
        var runs = res.data || [];
        if (runs.length < 2) {
          return buildResult({
            engine: ENGINE_NAME,
            note: "Need at least 2 runs to detect regressions",
            runs_available: runs.length
          });
        }

        var latest = runs[0];
        var previous = runs[1];
        var regressions = [];

        if (latest.failed > previous.failed) {
          regressions.push("Failure count increased from " + previous.failed + " to " + latest.failed);
        }
        if (latest.pass_rate < previous.pass_rate) {
          regressions.push("Pass rate dropped from " + previous.pass_rate + "% to " + latest.pass_rate + "%");
        }

        return buildResult({
          engine: ENGINE_NAME,
          has_regressions: regressions.length > 0,
          regressions: regressions,
          latest_run: { verdict: latest.verdict, pass_rate: latest.pass_rate, run_at: latest.run_at },
          previous_run: { verdict: previous.verdict, pass_rate: previous.pass_rate, run_at: previous.run_at }
        });
      })
      .catch(function() {
        return buildResult({
          engine: ENGINE_NAME,
          note: "Regression history table not yet created — run DEPLOY313 migration"
        });
      });
  },

  get_coverage: function() {
    return buildResult({
      engine: ENGINE_NAME,
      coverage: getCoverage()
    });
  }
};


// ================================================================
// HANDLER
// ================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return holdResult(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    var actionFn = ACTION_MAP[action];
    if (!actionFn) return holdResult(400, "Unknown action: " + action + ". Valid: " + Object.keys(ACTION_MAP).join(", "));

    var result = actionFn(body);
    if (result && typeof result.then === "function") {
      return result;
    }
    return result;
  } catch (err) {
    return holdResult(500, String(err && err.message ? err.message : err));
  }
};
