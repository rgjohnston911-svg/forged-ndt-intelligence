// @ts-nocheck
/**
 * DEPLOY216 - decision-spine.ts
 * netlify/functions/decision-spine.ts
 *
 * THE SPINE.
 *
 * Note: this is intentionally NOT decision-core.ts (which is the legacy
 * DEPLOY109 consequence-escalation engine). The "spine" composes every
 * existing engine (run-authority, decision-core, similar-cases) into a
 * single signed audit bundle.
 *
 * Inputs gathered for a case_id:
 *   - case row + findings + measurements + thickness_readings + rules
 *   - top-K similar prior cases via find_similar_cases RPC
 *
 * Computes:
 *   - OOD scoring (top-neighbor cosine similarity threshold)
 *   - Physics sufficiency (which API 579 / fatigue / creep / thickness
 *     checks apply, which have inputs, which are missing data)
 *   - Synthesis narrative combining authority disposition + OOD +
 *     physics coverage + neighbor precedent
 *
 * Emits:
 *   - signed, hash-verifiable decision_bundle JSON
 *   - persists to inspection_cases (decision_bundle, decision_bundle_hash,
 *     decision_bundle_version, decision_bundle_signed_at, ood_score,
 *     ood_flag, physics_coverage)
 *
 * Does NOT replace run-authority.ts. Runs ALONGSIDE. Future engines
 * (planner, FFS solvers, multi-case reasoning) plug into the spine
 * by extending assessPhysicsCoverage() or feeding additional inputs
 * into the bundle.
 *
 * POST { case_id: string }
 *
 * CRITICAL: String concatenation only. No backtick template literals.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var SPINE_VERSION = "decision-spine/1.0.0";

var OOD_IN_DISTRIBUTION = 0.82;
var OOD_MARGINAL = 0.72;

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function safe(v) {
  if (v === null || v === undefined) return null;
  return v;
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = Number(v);
  if (isNaN(n)) return null;
  return n;
}

// ================================================================
// OOD SCORING
// ================================================================
function scoreOOD(neighbors) {
  if (!neighbors || neighbors.length === 0) {
    return { ood_score: null, ood_flag: "unknown", top_similarity: null,
      rationale: "No prior cases available to compare against." };
  }
  var top = num(neighbors[0].similarity);
  if (top === null) return { ood_score: null, ood_flag: "unknown", top_similarity: null,
    rationale: "Neighbor returned with no similarity score." };
  var flag = "out_of_distribution";
  var rationale = "";
  if (top >= OOD_IN_DISTRIBUTION) {
    flag = "in_distribution";
    rationale = "Top neighbor similarity " + top.toFixed(3) + " >= " + OOD_IN_DISTRIBUTION +
      ". Case fits prior patterns; disposition confidence preserved.";
  } else if (top >= OOD_MARGINAL) {
    flag = "marginal";
    rationale = "Top neighbor similarity " + top.toFixed(3) + " in marginal band [" +
      OOD_MARGINAL + ", " + OOD_IN_DISTRIBUTION +
      "). Disposition should be reviewed against neighbors before final sign-off.";
  } else {
    flag = "out_of_distribution";
    rationale = "Top neighbor similarity " + top.toFixed(3) + " < " + OOD_MARGINAL +
      ". No close prior. Escalate to human review; machine confidence should be discounted.";
  }
  return { ood_score: top, ood_flag: flag, top_similarity: top, rationale: rationale };
}

// ================================================================
// PHYSICS SUFFICIENCY
// For each applicable check: required, runnable, missing_inputs[], result
// Solver slots are stubs; real FFS solvers slot in DEPLOY220+.
// ================================================================
function assessPhysicsCoverage(caseRow, findings, thickness) {
  var checks = [];

  // ---- Wall thickness / general corrosion (API 510/570) ----
  var hasThickness = thickness && thickness.length > 0;
  var thkRequired = caseRow.method === "ut" || caseRow.method === "UT" || hasThickness ||
    (caseRow.component_name && /pipe|vessel|tank|shell|header/i.test(caseRow.component_name));
  var thkCheck = {
    check_id: "wall_thickness_vs_nominal",
    code_ref: "API 510 / API 570",
    required: !!thkRequired,
    runnable: hasThickness,
    missing_inputs: [],
    result: null
  };
  if (thkRequired && !hasThickness) {
    thkCheck.missing_inputs.push("thickness_readings (upload UT grid or CML CSV on Evidence tab)");
  }
  if (hasThickness) {
    var vals = [];
    var nominal = null;
    for (var i = 0; i < thickness.length; i++) {
      var tv = num(thickness[i].thickness_in);
      if (tv !== null && tv > 0) vals.push(tv);
      if (!nominal) {
        var nv = num(thickness[i].nominal_in);
        if (nv !== null && nv > 0) nominal = nv;
      }
    }
    if (vals.length > 0) {
      var minT = Math.min.apply(null, vals);
      var pct = nominal ? minT / nominal : null;
      thkCheck.result = {
        reading_count: vals.length,
        min_in: minT,
        nominal_in: nominal,
        pct_of_nominal: pct,
        verdict: pct === null ? "informational" :
          (pct < 0.50 ? "reject" : (pct < 0.80 ? "ffs_review" : "pass"))
      };
    }
    if (!nominal) thkCheck.missing_inputs.push("nominal thickness (add '# nominal: 0.375' line to CSV or set case.thickness_mm)");
  }
  checks.push(thkCheck);

  // ---- Crack-like flaw FFS (API 579 Part 9) ----
  var hasCrack = false;
  if (findings && findings.length > 0) {
    for (var j = 0; j < findings.length; j++) {
      var ft = (findings[j].finding_type || findings[j].label || "").toLowerCase();
      if (ft.indexOf("crack") >= 0) hasCrack = true;
    }
  }
  var crackCheck = {
    check_id: "crack_like_flaw_ffs",
    code_ref: "API 579 Part 9",
    required: hasCrack,
    runnable: false,
    missing_inputs: [],
    result: null
  };
  if (hasCrack) {
    var haveLen = false, haveDepth = false;
    if (findings) {
      for (var k = 0; k < findings.length; k++) {
        var f = findings[k];
        if ((f.finding_type || "").toLowerCase().indexOf("crack") >= 0) {
          if (f.length_in || f.length_mm) haveLen = true;
          if (f.depth_in || f.depth_mm) haveDepth = true;
        }
      }
    }
    if (!haveLen) crackCheck.missing_inputs.push("crack length measurement");
    if (!haveDepth) crackCheck.missing_inputs.push("crack depth measurement");
    if (!caseRow.load_condition) crackCheck.missing_inputs.push("operating stress / load condition");
    crackCheck.missing_inputs.push("material fracture toughness (KIC or CVN -> KIC)");
    crackCheck.runnable = false;
    crackCheck.result = { solver: "stub", note: "Solver slot reserved for DEPLOY220 FFS integration." };
  }
  checks.push(crackCheck);

  // ---- Fatigue (BS 7910 / ASME Sec VIII Div 2) ----
  var fatigueRequired = caseRow.load_condition &&
    /cyclic|fatigue|pulsat|vibration/i.test(String(caseRow.load_condition));
  var fatigueCheck = {
    check_id: "fatigue_life",
    code_ref: "BS 7910 / ASME Sec VIII Div 2",
    required: !!fatigueRequired,
    runnable: false,
    missing_inputs: [],
    result: null
  };
  if (fatigueRequired) {
    fatigueCheck.missing_inputs.push("cycle count history");
    fatigueCheck.missing_inputs.push("stress range per cycle");
    fatigueCheck.missing_inputs.push("SN curve class / material fatigue properties");
    fatigueCheck.result = { solver: "stub", note: "Solver slot reserved for DEPLOY221 fatigue integration." };
  }
  checks.push(fatigueCheck);

  // ---- Creep (API 579 Part 10) ----
  var creepRequired = caseRow.service_temperature_c && num(caseRow.service_temperature_c) > 370;
  var creepCheck = {
    check_id: "creep_damage",
    code_ref: "API 579 Part 10",
    required: !!creepRequired,
    runnable: false,
    missing_inputs: [],
    result: null
  };
  if (creepRequired) {
    creepCheck.missing_inputs.push("service temperature history");
    creepCheck.missing_inputs.push("stress history");
    creepCheck.missing_inputs.push("material creep rupture data (Larson-Miller constants)");
    creepCheck.result = { solver: "stub", note: "Solver slot reserved for DEPLOY222 creep integration." };
  }
  checks.push(creepCheck);

  // Coverage summary
  var required = 0, runnable = 0;
  for (var c = 0; c < checks.length; c++) {
    if (checks[c].required) {
      required++;
      if (checks[c].runnable) runnable++;
    }
  }
  var coveragePct = required === 0 ? 1.0 : runnable / required;

  return {
    checks: checks,
    required_count: required,
    runnable_count: runnable,
    coverage_pct: coveragePct,
    summary: required === 0
      ? "No physics checks required for this case type."
      : (runnable + " of " + required + " required checks runnable with current data (" +
         Math.round(coveragePct * 100) + "% coverage).")
  };
}

// ================================================================
// BUNDLE HASHING (deterministic JSON for reproducible hash)
// ================================================================
function stableStringify(obj) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    var parts0 = [];
    for (var a = 0; a < obj.length; a++) parts0.push(stableStringify(obj[a]));
    return "[" + parts0.join(",") + "]";
  }
  var keys = Object.keys(obj).sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(JSON.stringify(keys[i]) + ":" + stableStringify(obj[keys[i]]));
  }
  return "{" + parts.join(",") + "}";
}

function hashBundle(bundle) {
  var canonical = stableStringify(bundle);
  return createHash("sha256").update(canonical).digest("hex");
}

// ================================================================
// SYNTHESIS NARRATIVE
// ================================================================
function synthesize(caseRow, ood, physics, neighbors) {
  var parts = [];
  var disp = caseRow.final_disposition || "not_yet_locked";
  var conf = caseRow.final_confidence != null
    ? Math.round(Number(caseRow.final_confidence) * 100) + "%" : "n/a";
  parts.push("Authority disposition: " + String(disp).toUpperCase().replace(/_/g, " ") +
    " (confidence " + conf + ").");

  if (ood.ood_flag === "in_distribution") {
    parts.push("Case is in-distribution (top neighbor " +
      (ood.top_similarity != null ? ood.top_similarity.toFixed(3) : "n/a") +
      " similar). Prior pattern supports the disposition.");
  } else if (ood.ood_flag === "marginal") {
    parts.push("Case is marginal (top neighbor " +
      (ood.top_similarity != null ? ood.top_similarity.toFixed(3) : "n/a") +
      "). Reviewer should compare against retrieved neighbors before sign-off.");
  } else if (ood.ood_flag === "out_of_distribution") {
    parts.push("Case is OUT-OF-DISTRIBUTION (no close prior). Machine confidence discounted; human authority review required.");
  } else {
    parts.push("Case library too small to compute distribution fit; no OOD judgment possible yet.");
  }

  if (physics.required_count === 0) {
    parts.push("No physics checks apply to this case type.");
  } else {
    parts.push("Physics coverage: " + physics.runnable_count + "/" +
      physics.required_count + " required checks runnable (" +
      Math.round(physics.coverage_pct * 100) + "%).");
    if (physics.coverage_pct < 1) {
      var missing = [];
      for (var i = 0; i < physics.checks.length; i++) {
        if (physics.checks[i].required && physics.checks[i].missing_inputs.length > 0) {
          missing.push(physics.checks[i].check_id);
        }
      }
      if (missing.length > 0) parts.push("Gather inputs to close: " + missing.join(", ") + ".");
    }
  }

  if (neighbors && neighbors.length > 0) {
    var dispCounts = {};
    for (var n = 0; n < Math.min(5, neighbors.length); n++) {
      var d = neighbors[n].final_disposition || "unknown";
      dispCounts[d] = (dispCounts[d] || 0) + 1;
    }
    var parts2 = [];
    var keys = Object.keys(dispCounts);
    for (var k = 0; k < keys.length; k++) parts2.push(dispCounts[keys[k]] + " " + keys[k]);
    parts.push("Neighbor precedent among top " + Math.min(5, neighbors.length) + ": " +
      parts2.join(", ") + ".");
  }

  return parts.join(" ");
}

// ================================================================
// HANDLER
// ================================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var caseId = body.case_id;
    if (!caseId) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };

    var sb = createClient(supabaseUrl, supabaseKey);

    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }
    var caseRow = caseRes.data;

    var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
    var measRes = await sb.from("measurements").select("*").eq("case_id", caseId);
    var thkRes = await sb.from("thickness_readings").select("*").eq("case_id", caseId);
    var rulesRes = await sb.from("rules").select("*").eq("case_id", caseId);

    // Retrieve neighbors via the DEPLOY215 RPC (skips silently if no embedding yet)
    var neighbors = [];
    if (caseRow.case_embedding) {
      var rpc = await sb.rpc("find_similar_cases", {
        query_embedding: caseRow.case_embedding,
        query_org_id: caseRow.org_id,
        exclude_case_id: caseId,
        match_count: 5
      });
      if (!rpc.error && rpc.data) neighbors = rpc.data;
    }

    var oodResult = scoreOOD(neighbors);
    var physics = assessPhysicsCoverage(caseRow, findingsRes.data || [], thkRes.data || []);
    var synthesis = synthesize(caseRow, oodResult, physics, neighbors);

    var bundle = {
      bundle_version: SPINE_VERSION,
      case_id: caseId,
      case_number: caseRow.case_number,
      generated_at: new Date().toISOString(),
      case_snapshot: {
        title: caseRow.title,
        component_name: caseRow.component_name,
        method: caseRow.method,
        material_class: caseRow.material_class,
        load_condition: caseRow.load_condition,
        code_family: caseRow.code_family,
        code_edition: caseRow.code_edition,
        code_section: caseRow.code_section,
        thickness_mm: num(caseRow.thickness_mm)
      },
      inputs_digest: {
        findings_count: (findingsRes.data || []).length,
        measurements_count: (measRes.data || []).length,
        thickness_readings_count: (thkRes.data || []).length,
        rules_count: (rulesRes.data || []).length,
        neighbors_count: neighbors.length
      },
      findings: (findingsRes.data || []).map(function(f) {
        return {
          finding_type: f.finding_type,
          label: f.label,
          severity: f.severity,
          confidence: num(f.confidence),
          source: f.source
        };
      }),
      thickness_summary: physics.checks[0] && physics.checks[0].result ? physics.checks[0].result : null,
      physics_coverage: physics,
      similar_cases: neighbors.map(function(n) {
        return {
          id: n.id,
          case_number: n.case_number,
          similarity: num(n.similarity),
          disposition: n.final_disposition,
          confidence: num(n.final_confidence)
        };
      }),
      ood: oodResult,
      authority: {
        disposition: safe(caseRow.final_disposition),
        confidence: num(caseRow.final_confidence),
        locked: !!caseRow.authority_locked,
        reason: safe(caseRow.final_decision_reason)
      },
      authority_evidence: caseRow.authority_evidence || null,
      synthesis: synthesis
    };

    var bundleHash = hashBundle(bundle);
    var signedAt = new Date().toISOString();

    var upd = await sb.from("inspection_cases").update({
      decision_bundle: bundle,
      decision_bundle_hash: bundleHash,
      decision_bundle_version: SPINE_VERSION,
      decision_bundle_signed_at: signedAt,
      ood_score: oodResult.ood_score,
      ood_flag: oodResult.ood_flag,
      physics_coverage: physics
    }).eq("id", caseId);

    if (upd.error) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "persist failed", detail: upd.error.message }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        bundle_version: SPINE_VERSION,
        bundle_hash: bundleHash,
        signed_at: signedAt,
        ood_flag: oodResult.ood_flag,
        ood_score: oodResult.ood_score,
        physics_coverage_pct: physics.coverage_pct,
        physics_summary: physics.summary,
        neighbors_count: neighbors.length,
        synthesis: synthesis
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
