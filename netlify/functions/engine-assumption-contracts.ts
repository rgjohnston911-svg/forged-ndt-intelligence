// @ts-nocheck
/**
 * DEPLOY279 - engine-assumption-contracts.ts
 * netlify/functions/engine-assumption-contracts.ts
 *
 * ENGINE ASSUMPTION CONTRACTS — ENGINE 102
 *
 * Formalizes what each APMM sub-engine assumes about its inputs.
 * Before an engine result is accepted, this function validates
 * whether the inputs satisfied the engine's declared contracts.
 * Violated contracts flag results for review and can adjust severity.
 *
 * Actions:
 *   validate_inputs    - check inputs against engine contracts
 *   validate_batch     - check inputs for multiple engines at once
 *   get_contracts      - list contracts for an engine
 *   get_all_contracts  - list all contracts grouped by engine
 *   add_contract       - add a new contract definition
 *   get_registry       - standard registry response
 *
 * POST /api/engine-assumption-contracts
 *
 * var only. String concatenation only. No backticks.
 */
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "engine-assumption-contracts";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY279";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

function num(v, fallback) { var n = Number(v); if (v === undefined || v === null || v === "" || isNaN(n)) return fallback !== undefined ? fallback : null; return n; }

// ============================================================
// SEVERITY ESCALATION RULES
// ============================================================
// When contracts are violated, the original engine severity may
// need adjustment. These rules govern escalation.

var SEVERITY_RANK = { "info": 1, "low": 2, "medium": 3, "high": 4, "critical": 5 };

function escalateSeverity(originalSeverity, violations) {
  var origRank = SEVERITY_RANK[originalSeverity] || 3;
  var maxViolationRank = 0;
  for (var i = 0; i < violations.length; i++) {
    var vRank = SEVERITY_RANK[violations[i].violation_severity] || 3;
    if (vRank > maxViolationRank) maxViolationRank = vRank;
  }
  // If any violation is critical, result must be flagged critical
  if (maxViolationRank >= 5) return "critical";
  // If violation rank exceeds original severity, escalate
  if (maxViolationRank > origRank) {
    var ranks = ["info", "low", "medium", "high", "critical"];
    return ranks[maxViolationRank - 1] || originalSeverity;
  }
  return originalSeverity;
}

// ============================================================
// CONTRACT VALIDATION LOGIC
// ============================================================

function validateContract(contract, inputValue) {
  var result = {
    assumption_key: contract.assumption_key,
    input_field: contract.input_field,
    description: contract.description,
    status: "pass",
    detail: null,
    violation_severity: contract.violation_severity,
    violation_message: contract.violation_message
  };

  // If input is missing
  if (inputValue === undefined || inputValue === null || inputValue === "") {
    if (contract.required) {
      result.status = "violated";
      result.detail = "Required input '" + contract.input_field + "' is missing";
      return result;
    } else {
      result.status = "skipped";
      result.detail = "Optional input not provided";
      return result;
    }
  }

  // Type-based validation
  if (contract.assumption_type === "range") {
    var val = Number(inputValue);
    if (isNaN(val)) {
      result.status = "violated";
      result.detail = "Input '" + contract.input_field + "' must be numeric, got: " + String(inputValue);
      return result;
    }
    if (contract.min_value !== null && contract.min_value !== undefined && val < contract.min_value) {
      result.status = "violated";
      result.detail = "Input '" + contract.input_field + "' = " + val + " is below minimum " + contract.min_value + " " + (contract.unit || "");
      return result;
    }
    if (contract.max_value !== null && contract.max_value !== undefined && val > contract.max_value) {
      result.status = "violated";
      result.detail = "Input '" + contract.input_field + "' = " + val + " exceeds maximum " + contract.max_value + " " + (contract.unit || "");
      return result;
    }
    result.detail = "Value " + val + " within range [" + (contract.min_value || "-inf") + ", " + (contract.max_value || "inf") + "]";
    return result;
  }

  if (contract.assumption_type === "enum") {
    var allowed = contract.allowed_values || [];
    var strVal = String(inputValue);
    var found = false;
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === strVal) { found = true; break; }
    }
    if (!found) {
      result.status = "violated";
      result.detail = "Input '" + contract.input_field + "' = '" + strVal + "' not in allowed values: [" + allowed.join(", ") + "]";
      return result;
    }
    result.detail = "Value '" + strVal + "' is in allowed set";
    return result;
  }

  if (contract.assumption_type === "type") {
    // Type checks — ensure the value exists and is non-trivial
    if (contract.input_field === "stress_tensor") {
      if (!Array.isArray(inputValue) || inputValue.length !== 3) {
        result.status = "violated";
        result.detail = "Stress tensor must be a 3x3 array";
        return result;
      }
      for (var r = 0; r < 3; r++) {
        if (!Array.isArray(inputValue[r]) || inputValue[r].length !== 3) {
          result.status = "violated";
          result.detail = "Stress tensor row " + r + " must have 3 elements";
          return result;
        }
      }
      result.detail = "Valid 3x3 tensor provided";
      return result;
    }
    if (contract.input_field === "cash_flows") {
      if (!Array.isArray(inputValue) || inputValue.length === 0) {
        result.status = "violated";
        result.detail = "Cash flows must be a non-empty array";
        return result;
      }
      result.detail = "Cash flows array with " + inputValue.length + " entries";
      return result;
    }
    // Generic type check — just ensure it exists
    result.detail = "Input present and non-null";
    return result;
  }

  // Unknown contract type — pass by default
  result.status = "skipped";
  result.detail = "Unknown assumption_type: " + contract.assumption_type;
  return result;
}

function validateInputsAgainstContracts(contracts, inputs) {
  var results = [];
  var passed = 0;
  var violated = 0;
  var skipped = 0;
  var violations = [];

  for (var i = 0; i < contracts.length; i++) {
    var contract = contracts[i];
    if (!contract.is_active) { skipped++; continue; }
    var inputValue = inputs[contract.input_field];
    var check = validateContract(contract, inputValue);
    results.push(check);
    if (check.status === "pass") passed++;
    else if (check.status === "violated") { violated++; violations.push(check); }
    else skipped++;
  }

  var overallStatus = "pass";
  if (violated > 0) overallStatus = "violated";
  else if (skipped > 0 && passed === 0) overallStatus = "unchecked";

  return {
    total_contracts: contracts.length,
    contracts_passed: passed,
    contracts_violated: violated,
    contracts_skipped: skipped,
    overall_status: overallStatus,
    violations: violations,
    checks: results
  };
}

// ============================================================
// IN-MEMORY CONTRACT CACHE (fallback if DB unavailable)
// ============================================================

var BUILTIN_CONTRACTS = {
  "201": [
    { assumption_key: "prior_range", assumption_type: "range", input_field: "prior", min_value: 0, max_value: 1, required: true, unit: "probability", violation_severity: "high", violation_message: "Prior probability out of valid range [0,1]", description: "Prior probability must be between 0 and 1", is_active: true },
    { assumption_key: "likelihood_range", assumption_type: "range", input_field: "likelihood", min_value: 0, max_value: 1, required: true, unit: "probability", violation_severity: "high", violation_message: "Likelihood out of valid range [0,1]", description: "Likelihood must be between 0 and 1", is_active: true }
  ],
  "211": [
    { assumption_key: "shape_positive", assumption_type: "range", input_field: "shape", min_value: 0.01, max_value: 50, required: true, unit: "dimensionless", violation_severity: "critical", violation_message: "Shape parameter must be positive", description: "Weibull shape parameter must be positive", is_active: true },
    { assumption_key: "scale_positive", assumption_type: "range", input_field: "scale", min_value: 0.001, max_value: 1000000, required: true, unit: "time_unit", violation_severity: "critical", violation_message: "Scale parameter must be positive", description: "Weibull scale parameter must be positive", is_active: true },
    { assumption_key: "time_positive", assumption_type: "range", input_field: "time", min_value: 0, max_value: 1000000, required: true, unit: "time_unit", violation_severity: "high", violation_message: "Operating time cannot be negative", description: "Operating time must be non-negative", is_active: true }
  ],
  "216": [
    { assumption_key: "youngs_modulus_range", assumption_type: "range", input_field: "youngs_modulus", min_value: 0.001, max_value: 1500, required: true, unit: "GPa", violation_severity: "critical", violation_message: "Youngs modulus outside known material range", description: "Youngs modulus must be in realistic material range", is_active: true },
    { assumption_key: "load_nonzero", assumption_type: "range", input_field: "load", min_value: 0.001, max_value: 1000000000, required: true, unit: "N", violation_severity: "medium", violation_message: "Zero load produces trivial results", description: "Applied load must be nonzero", is_active: true }
  ],
  "225": [
    { assumption_key: "conductivity_positive", assumption_type: "range", input_field: "conductivity", min_value: 0.001, max_value: 5000, required: true, unit: "W/mK", violation_severity: "critical", violation_message: "Non-physical thermal conductivity", description: "Thermal conductivity must be positive", is_active: true },
    { assumption_key: "thickness_positive", assumption_type: "range", input_field: "thickness", min_value: 0.0001, max_value: 100, required: true, unit: "m", violation_severity: "high", violation_message: "Non-physical wall thickness", description: "Wall thickness must be positive", is_active: true }
  ],
  "236": [
    { assumption_key: "limit_positive", assumption_type: "range", input_field: "code_limit", min_value: 0.001, max_value: 1000000000, required: true, unit: "varies", violation_severity: "critical", violation_message: "Code limit must be positive", description: "Code limit must be positive", is_active: true },
    { assumption_key: "safety_factor_range", assumption_type: "range", input_field: "safety_factor", min_value: 1, max_value: 100, required: false, unit: "dimensionless", violation_severity: "medium", violation_message: "Safety factor below 1 is non-conservative", description: "Safety factor must be >= 1", is_active: true }
  ]
};

// ============================================================
// DB HELPERS
// ============================================================

async function getContractsFromDB(engineNumber) {
  try {
    var sb = createClient(supabaseUrl, supabaseKey);
    var res = await sb.from("engine_assumption_contracts").select("*").eq("engine_number", engineNumber).eq("is_active", true);
    if (res.error || !res.data || res.data.length === 0) {
      // Fallback to built-in
      return BUILTIN_CONTRACTS[String(engineNumber)] || [];
    }
    return res.data;
  } catch (e) {
    return BUILTIN_CONTRACTS[String(engineNumber)] || [];
  }
}

async function logValidation(validationResult, engineNumber, engineCode, caseId, assetId, runId, originalSeverity, adjustedSeverity) {
  try {
    var sb = createClient(supabaseUrl, supabaseKey);
    sb.from("contract_validation_results").insert({
      run_id: runId || null,
      engine_number: engineNumber,
      engine_code: engineCode || null,
      case_id: caseId || null,
      asset_id: assetId || null,
      total_contracts: validationResult.total_contracts,
      contracts_passed: validationResult.contracts_passed,
      contracts_violated: validationResult.contracts_violated,
      contracts_skipped: validationResult.contracts_skipped,
      violations: validationResult.violations,
      overall_status: validationResult.overall_status,
      result_accepted: validationResult.contracts_violated === 0,
      original_severity: originalSeverity || null,
      adjusted_severity: adjustedSeverity || null
    });
  } catch (e) {}
}

// ============================================================
// HANDLER
// ============================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";

    // ---- GET REGISTRY ----
    if (action === "get_registry") {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY,
        mode: "deterministic",
        purpose: "Engine Assumption Contracts — validates that engine inputs satisfy declared physical and mathematical constraints before results are accepted",
        actions: ["validate_inputs", "validate_batch", "get_contracts", "get_all_contracts", "add_contract", "get_registry"],
        builtin_engines: Object.keys(BUILTIN_CONTRACTS).map(function(k) { return Number(k); })
      }) };
    }

    // ---- GET CONTRACTS FOR AN ENGINE ----
    if (action === "get_contracts") {
      var engineNum = num(body.engine_number, null);
      if (!engineNum) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "engine_number required" }) };
      var contracts = await getContractsFromDB(engineNum);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, action: action,
        engine_number: engineNum,
        contracts: contracts,
        total: contracts.length
      }, null, 2) };
    }

    // ---- GET ALL CONTRACTS ----
    if (action === "get_all_contracts") {
      try {
        var sb = createClient(supabaseUrl, supabaseKey);
        var allRes = await sb.from("engine_assumption_contracts").select("*").eq("is_active", true).order("engine_number");
        var allContracts = (allRes.data && allRes.data.length > 0) ? allRes.data : [];
        // Group by engine_number
        var grouped = {};
        for (var i = 0; i < allContracts.length; i++) {
          var key = String(allContracts[i].engine_number);
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(allContracts[i]);
        }
        // Merge with builtins for engines not in DB
        var builtinKeys = Object.keys(BUILTIN_CONTRACTS);
        for (var b = 0; b < builtinKeys.length; b++) {
          if (!grouped[builtinKeys[b]]) {
            grouped[builtinKeys[b]] = BUILTIN_CONTRACTS[builtinKeys[b]];
          }
        }
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          engines_with_contracts: Object.keys(grouped).length,
          contracts_by_engine: grouped
        }, null, 2) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          engines_with_contracts: Object.keys(BUILTIN_CONTRACTS).length,
          contracts_by_engine: BUILTIN_CONTRACTS,
          note: "Returned builtin contracts (DB unavailable)"
        }, null, 2) };
      }
    }

    // ---- VALIDATE INPUTS ----
    if (action === "validate_inputs") {
      var vEngineNum = num(body.engine_number, null);
      if (!vEngineNum) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "engine_number required" }) };
      var vInputs = body.inputs || {};
      var vContracts = await getContractsFromDB(vEngineNum);
      if (vContracts.length === 0) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          engine_number: vEngineNum,
          validation: { total_contracts: 0, overall_status: "no_contracts", note: "No contracts defined for engine " + vEngineNum }
        }, null, 2) };
      }
      var vResult = validateInputsAgainstContracts(vContracts, vInputs);

      // Severity adjustment
      var origSev = body.original_severity || null;
      var adjSev = origSev;
      if (origSev && vResult.violations.length > 0) {
        adjSev = escalateSeverity(origSev, vResult.violations);
      }

      // Log validation
      logValidation(vResult, vEngineNum, body.engine_code || null, body.case_id || null, body.asset_id || null, body.run_id || null, origSev, adjSev);

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, action: action,
        engine_number: vEngineNum,
        validation: vResult,
        severity_adjustment: origSev ? { original: origSev, adjusted: adjSev, escalated: origSev !== adjSev } : null,
        result_accepted: vResult.contracts_violated === 0
      }, null, 2) };
    }

    // ---- VALIDATE BATCH ----
    if (action === "validate_batch") {
      var batchItems = body.engines || [];
      if (!Array.isArray(batchItems) || batchItems.length === 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "engines array required with [{engine_number, inputs, original_severity?}]" }) };
      }
      var batchResults = [];
      var totalViolations = 0;
      var enginesChecked = 0;
      for (var bi = 0; bi < batchItems.length; bi++) {
        var item = batchItems[bi];
        var bEngineNum = num(item.engine_number, null);
        if (!bEngineNum) continue;
        var bContracts = await getContractsFromDB(bEngineNum);
        if (bContracts.length === 0) {
          batchResults.push({ engine_number: bEngineNum, validation: { total_contracts: 0, overall_status: "no_contracts" } });
          continue;
        }
        var bResult = validateInputsAgainstContracts(bContracts, item.inputs || {});
        var bOrigSev = item.original_severity || null;
        var bAdjSev = bOrigSev;
        if (bOrigSev && bResult.violations.length > 0) {
          bAdjSev = escalateSeverity(bOrigSev, bResult.violations);
        }
        totalViolations += bResult.contracts_violated;
        enginesChecked++;
        logValidation(bResult, bEngineNum, item.engine_code || null, body.case_id || null, body.asset_id || null, item.run_id || null, bOrigSev, bAdjSev);
        batchResults.push({
          engine_number: bEngineNum,
          validation: bResult,
          severity_adjustment: bOrigSev ? { original: bOrigSev, adjusted: bAdjSev, escalated: bOrigSev !== bAdjSev } : null,
          result_accepted: bResult.contracts_violated === 0
        });
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
        engine: ENGINE_ID, action: action,
        engines_checked: enginesChecked,
        total_violations: totalViolations,
        all_passed: totalViolations === 0,
        results: batchResults
      }, null, 2) };
    }

    // ---- ADD CONTRACT ----
    if (action === "add_contract") {
      var aEngineNum = num(body.engine_number, null);
      var aEngineCode = body.engine_code || "";
      var aKey = body.assumption_key || "";
      var aField = body.input_field || "";
      if (!aEngineNum || !aKey || !aField) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "engine_number, assumption_key, and input_field are required" }) };
      }
      try {
        var sb2 = createClient(supabaseUrl, supabaseKey);
        var insertRes = await sb2.from("engine_assumption_contracts").insert({
          engine_number: aEngineNum,
          engine_code: aEngineCode,
          assumption_key: aKey,
          assumption_type: body.assumption_type || "range",
          description: body.description || "",
          input_field: aField,
          min_value: body.min_value !== undefined ? body.min_value : null,
          max_value: body.max_value !== undefined ? body.max_value : null,
          allowed_values: body.allowed_values || null,
          required: body.required !== undefined ? body.required : true,
          unit: body.unit || "",
          violation_severity: body.violation_severity || "medium",
          violation_message: body.violation_message || "Contract violated for " + aField,
          is_active: true
        }).select();
        if (insertRes.error) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: insertRes.error.message }) };
        }
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({
          engine: ENGINE_ID, action: action,
          created: insertRes.data[0]
        }, null, 2) };
      } catch (e) {
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(e && e.message ? e.message : e) }) };
      }
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Available: validate_inputs, validate_batch, get_contracts, get_all_contracts, add_contract, get_registry" }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
