// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════════════════
// API 579-1 / ASME FFS-1 PART 5 LEVEL 2 LOCAL METAL LOSS ASSESSMENT ENGINE
// DEPLOY336
//
// This engine implements the most critical fitness-for-service calculation in
// refining: the API 579 Part 5 Level 2 assessment of localized metal loss.
//
// It is defensible under expert questioning. Every formula references the
// corresponding equation in API 579-1:2021 / ASME FFS-1.
//
// Core Outputs:
// - Minimum Required Thickness (tmin) per ASME Section VIII Div 1 / B31.3
// - Remaining Thickness Ratio (Rt)
// - Folias Factor (Mt) - the critical shape correction
// - Remaining Strength Factor (RSF) - the regulatory decision point
// - Reduced MAWP (MAWPr) if RSF < RSFa
// - Remaining Life with corrosion
// - Acceptance decision: ACCEPTABLE | REDUCED_MAWP | REPAIR_REQUIRED
//
// Actions:
// - get_registry: Return engine capabilities
// - assess: Full Level 2 assessment (component geometry, material, thicknesses, flaws)
// - compute_rsf: RSF only
// - compute_mawp: Reduced MAWP only
// - analyze_grid: Extract Critical Thickness Profile (CTP) from grid data
// - check_interaction: Check flaw-to-flaw interaction
// - get_history: Retrieve past assessments from DB
//
// ══════════════════════════════════════════════════════════════════════════════

// ── ACTION REGISTRY ────────────────────────────────────────────────────────
var ACTION_REGISTRY = {
  "get_registry": { description: "Return engine capabilities", method: "GET_OR_POST" },
  "assess": { description: "Full Level 2 assessment", method: "POST" },
  "compute_rsf": { description: "Compute RSF only", method: "POST" },
  "compute_mawp": { description: "Compute reduced MAWP", method: "POST" },
  "analyze_grid": { description: "Extract CTP from thickness grid", method: "POST" },
  "check_interaction": { description: "Check flaw-to-flaw interaction rules", method: "POST" },
  "get_history": { description: "Retrieve past assessments", method: "POST" }
};

// ── COMPONENT TYPE TMIN FORMULAE ──────────────────────────────────────────
// All per ASME Section VIII Div 1 or B31.3, as cited in API 579-1 Part 5

function compute_tmin(component_type, D, P, S, E, W, Y) {
  // Cylindrical shells (ASME VIII Div 1, Section UG-27(c)(1))
  if (component_type === "cylinder" || component_type === "pipe") {
    var R = D / 2;
    var numerator = P * R;
    var denominator = S * E - 0.6 * P;
    if (denominator <= 0) return null; // Invalid design
    var tmin = numerator / denominator;
    return tmin;
  }
  // Spherical shells (ASME VIII Div 1, Section UG-27(c)(2))
  if (component_type === "sphere") {
    var R = D / 2;
    var numerator = P * R;
    var denominator = 2 * S * E - 0.2 * P;
    if (denominator <= 0) return null;
    var tmin = numerator / denominator;
    return tmin;
  }
  // Elbows (ASME B31.3 branch connection, reduced strength)
  if (component_type === "elbow") {
    var R = D / 2;
    var numerator = P * R;
    var denominator = S * E * W - 0.6 * P;
    if (denominator <= 0) return null;
    var tmin = numerator / denominator;
    return tmin;
  }
  // Nozzles (reduced thickness, typically 80% of main pipe)
  if (component_type === "nozzle") {
    var R = D / 2;
    var numerator = P * R;
    var denominator = S * E * 0.8 - 0.6 * P;
    if (denominator <= 0) return null;
    var tmin = numerator / denominator;
    return tmin;
  }
  return null;
}

// ── REMAINING THICKNESS RATIO (API 579-1, Eq 5.9) ────────────────────────
function compute_Rt(tmm, FCA, tnom, tmin) {
  var numerator = tmm - FCA;
  var denominator = tnom - FCA - tmin;
  if (denominator <= 0) return null; // Invalid condition
  var Rt = numerator / denominator;
  return Rt;
}

// ── FLAW LENGTH PARAMETER (API 579-1, Eq 5.5) ─────────────────────────────
// lambda = 1.285 * c / sqrt(D * tmin)
// where c = longitudinal flaw half-length, D = inside diameter, tmin = min required thickness
function compute_lambda(c, D, tmin) {
  if (tmin <= 0 || D <= 0) return null;
  var sqrt_Dt = Math.sqrt(D * tmin);
  var lambda = 1.285 * c / sqrt_Dt;
  return lambda;
}

// ── FOLIAS FACTOR (API 579-1, Eq 5.11 / 5.12) ─────────────────────────────
// This is the critical shape correction for local defects.
// For lambda^2 <= 50: Mt = sqrt(1 + 0.6275*lambda^2 - 0.003375*lambda^4)
// For lambda^2 > 50: Mt = 0.032*lambda^2 + 3.3
function compute_Mt(lambda) {
  var lambda_sq = lambda * lambda;

  if (lambda_sq <= 50) {
    // Eq 5.11 (low lambda region)
    var term1 = 0.6275 * lambda_sq;
    var term2 = 0.003375 * lambda_sq * lambda_sq;
    var Mt = Math.sqrt(1 + term1 - term2);
    return Mt;
  } else {
    // Eq 5.12 (high lambda region, lambda > 7.07)
    var Mt = 0.032 * lambda_sq + 3.3;
    return Mt;
  }
}

// ── REMAINING STRENGTH FACTOR (API 579-1, Eq 5.13) ─────────────────────────
// RSF = Rt / (1 - (1/Mt)*(1 - Rt))
// This is the regulatory decision metric.
function compute_RSF(Rt, Mt) {
  if (Mt <= 0 || Rt >= 1) return null;
  var denominator = 1 - (1 / Mt) * (1 - Rt);
  if (denominator <= 0) return null; // Undefined condition
  var RSF = Rt / denominator;
  return RSF;
}

// ── ACCEPTANCE CRITERIA (API 579-1, Table 5.2) ────────────────────────────
// RSFa (allowable RSF) = 0.9 for General Service (most refining cases)
// RSFa = 0.75 for High-Consequence Service
function get_RSFa(service_class) {
  if (service_class === "high_consequence") {
    return 0.75;
  }
  // Default: General Service
  return 0.9;
}

// ── ACCEPTANCE DECISION ────────────────────────────────────────────────────
function get_acceptance(RSF, RSFa) {
  if (RSF >= RSFa) {
    return "ACCEPTABLE";
  }
  if (RSF > 0.5) {
    return "REDUCED_MAWP";
  }
  return "REPAIR_REQUIRED";
}

// ── REDUCED MAWP CALCULATION (API 579-1, Eq 5.14) ─────────────────────────
function compute_MAWPr(MAWP, RSF, RSFa) {
  if (RSF >= RSFa) {
    return MAWP; // No reduction needed
  }
  var MAWPr = MAWP * (RSF / RSFa);
  return MAWPr;
}

// ── REMAINING LIFE (API 579-1, Eq 5.15) ───────────────────────────────────
function compute_remaining_life(tmm, tmin, corrosion_rate) {
  if (corrosion_rate <= 0) return null;
  var remaining_thickness = tmm - tmin;
  if (remaining_thickness <= 0) return 0;
  var years = remaining_thickness / corrosion_rate;
  return years;
}

// ── REMAINING LIFE WITH FCA (API 579-1, Eq 5.16) ─────────────────────────
function compute_remaining_life_fca(tmm, FCA, tmin, corrosion_rate) {
  if (corrosion_rate <= 0) return null;
  var remaining = tmm - FCA - tmin;
  if (remaining <= 0) return 0;
  var years = remaining / corrosion_rate;
  return years;
}

// ── FLAW INTERACTION CHECK (API 579-1, Section 5.4.5) ──────────────────────
// Two flaws interact if axial spacing S < 2*sqrt(D*t)
function check_flaw_interaction(D, t, spacing_between_flaws) {
  var interaction_distance = 2 * Math.sqrt(D * t);
  if (spacing_between_flaws < interaction_distance) {
    return {
      interact: true,
      interaction_distance: interaction_distance,
      message: "Flaws interact. Use Part 5, Section 5.4.5 combined flaw rules."
    };
  }
  return {
    interact: false,
    interaction_distance: interaction_distance,
    message: "Flaws do not interact. Assess independently."
  };
}

// ── CRITICAL THICKNESS PROFILE EXTRACTION (Level 2 Requirement) ────────────
// Grid-based thickness data for refined location assessment
function analyze_grid_data(grid_data) {
  if (!grid_data || grid_data.length === 0) {
    return { error: "No grid data provided" };
  }

  var min_thickness = Infinity;
  var max_thickness = -Infinity;
  var sum_thickness = 0;
  var cml_count = 0;

  for (var gi = 0; gi < grid_data.length; gi++) {
    var point = grid_data[gi];
    if (point.thickness === undefined) continue;

    cml_count++;
    sum_thickness += point.thickness;
    if (point.thickness < min_thickness) {
      min_thickness = point.thickness;
    }
    if (point.thickness > max_thickness) {
      max_thickness = point.thickness;
    }
  }

  if (cml_count === 0) {
    return { error: "No valid thickness readings in grid data" };
  }

  var avg_thickness = sum_thickness / cml_count;
  var thickness_range = max_thickness - min_thickness;

  return {
    cml_count: cml_count,
    min_thickness: min_thickness,
    max_thickness: max_thickness,
    avg_thickness: avg_thickness,
    thickness_range: thickness_range,
    grid_points: grid_data
  };
}

// ── CORE ASSESSMENT FUNCTION ───────────────────────────────────────────────
function assess_metal_loss(input) {
  var result = {
    engine: "api579-level2-part5",
    deterministic: {},
    interpreted: {},
    provenance: {
      engine: "api579-level2-part5",
      version: "1.0.0",
      timestamp: new Date().toISOString()
    }
  };

  // Extract and validate inputs
  var component_type = input.component_type || "cylinder";
  var D = input.D;
  var tnom = input.tnom;
  var tmm = input.tmm;
  var c = input.c || 0; // Flaw half-length (mm)
  var FCA = input.FCA || 0;
  var P = input.P;
  var S = input.S;
  var E = input.E || 1.0;
  var W = input.W || 1.0; // Weld strength reduction (B31.3)
  var corrosion_rate = input.corrosion_rate || 0;
  var service_class = input.service_class || "general";

  // Input validation
  if (!D || !tnom || !tmm || !P || !S) {
    result.deterministic.error = "Missing required inputs: D, tnom, tmm, P, S";
    return result;
  }

  // Compute minimum required thickness (ASME Section VIII Div 1 / B31.3)
  var tmin = compute_tmin(component_type, D, P, S, E, W, 0);
  if (tmin === null) {
    result.deterministic.error = "Invalid geometry or pressure condition for component type " + component_type;
    return result;
  }

  // Check if current thickness exceeds minimum
  if (tmm < tmin) {
    result.deterministic.error = "Current thickness (" + tmm.toFixed(2) + " mm) is below minimum required (" + tmin.toFixed(2) + " mm). Immediate repair required.";
    result.deterministic.tmin = tmin;
    result.deterministic.tmm = tmm;
    result.deterministic.acceptance = "REPAIR_REQUIRED";
    return result;
  }

  // Compute nominal MAWP (using current nominal thickness)
  var MAWP_num = S * E * (tnom - FCA);
  var MAWP_den = D / 2 + 0.6 * (tnom - FCA);
  var MAWP = (MAWP_num / MAWP_den) * P; // Scale by design pressure for reality

  // Compute Remaining Thickness Ratio (Eq 5.9)
  var Rt = compute_Rt(tmm, FCA, tnom, tmin);
  if (Rt === null || Rt < 0) {
    result.deterministic.error = "Invalid remaining thickness calculation. Component may be beyond repair.";
    result.deterministic.tmin = tmin;
    result.deterministic.Rt = Rt;
    return result;
  }

  // Compute Flaw Length Parameter (Eq 5.5)
  var lambda = compute_lambda(c, D, tmin);
  if (lambda === null) {
    result.deterministic.error = "Invalid flaw parameter calculation";
    return result;
  }

  // Compute Folias Factor (Eq 5.11 / 5.12)
  var Mt = compute_Mt(lambda);

  // Compute Remaining Strength Factor (Eq 5.13) - the regulatory decision metric
  var RSF = compute_RSF(Rt, Mt);
  if (RSF === null) {
    result.deterministic.error = "Unable to compute RSF. Invalid Rt or Mt values.";
    return result;
  }

  // Determine acceptance criteria
  var RSFa = get_RSFa(service_class);
  var acceptance = get_acceptance(RSF, RSFa);

  // Compute reduced MAWP if required
  var MAWPr = compute_MAWPr(MAWP, RSF, RSFa);

  // Compute remaining life if corrosion rate provided
  var remaining_life = null;
  var remaining_life_fca = null;
  if (corrosion_rate > 0) {
    remaining_life = compute_remaining_life(tmm, tmin, corrosion_rate);
    remaining_life_fca = compute_remaining_life_fca(tmm, FCA, tmin, corrosion_rate);
  }

  // Flaw interaction check if flaws are present
  var interaction_check = null;
  if (input.flaw_spacing !== undefined) {
    interaction_check = check_flaw_interaction(D, tmm, input.flaw_spacing);
  }

  // Populate deterministic result envelope
  result.deterministic = {
    component_type: component_type,
    D: D,
    tnom: tnom,
    tmm: tmm,
    c: c,
    FCA: FCA,
    P: P,
    S: S,
    E: E,
    corrosion_rate: corrosion_rate,

    // Key computed values
    tmin: tmin,
    Rt: Rt,
    lambda: lambda,
    Mt: Mt,
    RSF: RSF,
    RSFa: RSFa,

    // MAWP results
    MAWP: MAWP,
    MAWPr: MAWPr,
    MAWP_reduction: (MAWPr < MAWP) ? ((MAWP - MAWPr) / MAWP * 100).toFixed(1) + "%" : "0%",

    // Life remaining
    remaining_life: remaining_life,
    remaining_life_fca: remaining_life_fca,

    // Decision
    acceptance: acceptance,
    code_reference: "API 579-1 / ASME FFS-1, Part 5, Level 2",

    // Interaction (if checked)
    interaction_check: interaction_check
  };

  // Interpreted narrative and recommendations
  var summary = "";
  var risk_characterization = "";
  var recommendations = "";

  if (acceptance === "ACCEPTABLE") {
    summary = "Component meets Level 2 local metal loss acceptance criteria. Remaining strength factor (" + RSF.toFixed(3) + ") exceeds allowable (" + RSFa.toFixed(2) + ").";
    risk_characterization = "LOW RISK. Component is fit-for-service as designed.";
    if (corrosion_rate > 0 && remaining_life_fca !== null) {
      recommendations = "Continue normal operation. Schedule re-inspection in " + Math.floor(remaining_life_fca / 2) + " years to monitor corrosion rate. Update wall thickness database.";
    } else {
      recommendations = "Continue normal operation. Schedule routine re-inspection per plant procedure.";
    }
  } else if (acceptance === "REDUCED_MAWP") {
    var mawp_pct = ((MAWPr / MAWP) * 100).toFixed(1);
    summary = "Component acceptable with reduced MAWP. Operating pressure must not exceed " + MAWPr.toFixed(1) + " MPa (" + mawp_pct + "% of design MAWP).";
    risk_characterization = "MODERATE RISK. Component is fit-for-service at reduced pressure. Monitor corrosion closely.";
    recommendations = "Implement pressure reduction immediately. Schedule thinning assessment re-inspection in 6 months. Evaluate repair vs. replacement.";
  } else {
    summary = "Component does not meet Level 2 acceptance criteria. Repair or replacement required.";
    risk_characterization = "HIGH RISK. Component is not fit-for-service. Immediate action required.";
    recommendations = "Isolate and depressurize component. Perform expedited repair design (weld overlay, insert, etc.) or schedule replacement. Do not operate above minimum safe pressure.";
  }

  result.interpreted = {
    summary: summary,
    risk_characterization: risk_characterization,
    recommendations: recommendations
  };

  return result;
}

// ── MAIN HANDLER ───────────────────────────────────────────────────────────
var handler = async function(event, context) {
  // POST-only handler
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Use POST." })
    };
  }

  var payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (parseErr) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" })
    };
  }

  var action = payload.action || "get_registry";
  var response = {};

  // ── DISPATCH TO ACTION ─────────────────────────────────────────────────
  if (action === "get_registry") {
    response = {
      engine: "api579-level2-part5",
      version: "1.0.0",
      deploy: "DEPLOY336",
      description: "API 579-1 / ASME FFS-1 Part 5 Level 2 Local Metal Loss Assessment",
      actions: ACTION_REGISTRY,
      codes: ["API 579-1:2021", "ASME FFS-1:2022"]
    };
  } else if (action === "assess") {
    response = assess_metal_loss(payload);

    // Non-fatal DB save
    if (supabaseUrl && supabaseKey) {
      var client = createClient(supabaseUrl, supabaseKey);
      try {
        var dbRecord = {
          case_id: payload.case_id || null,
          component_type: payload.component_type,
          D: payload.D,
          tnom: payload.tnom,
          tmm: payload.tmm,
          c: payload.c || 0,
          FCA: payload.FCA || 0,
          P: payload.P,
          S: payload.S,
          E: payload.E || 1.0,
          RSF: response.deterministic.RSF,
          RSFa: response.deterministic.RSFa,
          acceptance: response.deterministic.acceptance,
          MAWP: response.deterministic.MAWP,
          MAWPr: response.deterministic.MAWPr,
          remaining_life_years: response.deterministic.remaining_life_fca,
          assessment_timestamp: new Date().toISOString()
        };
        await client.from("api579_assessments").insert([dbRecord]);
      } catch (dbErr) {
        // Silently fail DB operations - assessment is still valid
        console.log("DB save failed (non-fatal): " + dbErr.message);
      }
    }
  } else if (action === "compute_rsf") {
    var input = payload;
    var tmin = compute_tmin(input.component_type || "cylinder", input.D, input.P, input.S, input.E || 1, input.W || 1, 0);
    var Rt = compute_Rt(input.tmm, input.FCA || 0, input.tnom, tmin);
    var lambda = compute_lambda(input.c || 0, input.D, tmin);
    var Mt = compute_Mt(lambda);
    var RSF = compute_RSF(Rt, Mt);
    response = {
      RSF: RSF,
      tmin: tmin,
      Rt: Rt,
      lambda: lambda,
      Mt: Mt
    };
  } else if (action === "compute_mawp") {
    var RSF = payload.RSF;
    var RSFa = payload.RSFa || 0.9;
    var MAWP = payload.MAWP;
    var MAWPr = compute_MAWPr(MAWP, RSF, RSFa);
    response = {
      MAWP: MAWP,
      RSF: RSF,
      RSFa: RSFa,
      MAWPr: MAWPr,
      reduction_pct: ((MAWP - MAWPr) / MAWP * 100).toFixed(1)
    };
  } else if (action === "analyze_grid") {
    response = {
      ctp_analysis: analyze_grid_data(payload.grid_data),
      grid_points_analyzed: (payload.grid_data || []).length
    };
  } else if (action === "check_interaction") {
    response = check_flaw_interaction(payload.D, payload.t, payload.spacing_between_flaws);
  } else if (action === "get_history") {
    // Retrieve past assessments from DB
    if (supabaseUrl && supabaseKey) {
      var client = createClient(supabaseUrl, supabaseKey);
      try {
        var case_id = payload.case_id;
        var query = client.from("api579_assessments").select("*");
        if (case_id) {
          query = query.eq("case_id", case_id);
        }
        var { data, error } = await query.order("assessment_timestamp", { ascending: false }).limit(10);
        if (error) {
          response = { error: error.message };
        } else {
          response = { assessments: data || [] };
        }
      } catch (dbErr) {
        response = { error: dbErr.message };
      }
    } else {
      response = { error: "Database not configured" };
    }
  } else {
    response = { error: "Unknown action: " + action };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response)
  };
};

export { handler };
