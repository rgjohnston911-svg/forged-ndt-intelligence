// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var ENGINE_ID = "underwater-welding-authority";
var ENGINE_VERSION = "1.0.0";
var DEPLOY = "DEPLOY296";
var corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };

var WELD_CLASSES = {
  class_A: { name: "Class A — Dry Hyperbaric", standard: "AWS D3.6M Class A", environment: "dry_habitat_at_depth", processes: ["GMAW", "GTAW", "FCAW", "SMAW"], hydrogen_risk: "Low", hardness_limit_HV: 350, description: "Welding in dry pressurized habitat. Results comparable to surface welding." },
  class_B: { name: "Class B — Wet Welding (SMAW)", standard: "AWS D3.6M Class B", environment: "direct_water_contact", processes: ["SMAW_wet"], hydrogen_risk: "VERY HIGH — water dissociation generates hydrogen continuously", hardness_limit_HV: 375, description: "Welder and electrode in direct water contact. Rapid quenching. Hard brittle HAZ. Hydrogen from water dissociation." },
  class_O: { name: "Class O — Other", standard: "AWS D3.6M Class O", environment: "varies", processes: ["friction", "explosive", "thermit"], description: "Specialty underwater processes. Project-specific criteria." }
};

var ACCEPTANCE = {
  class_A: { cracks: { accept: false, note: "Zero tolerance" }, incomplete_fusion: { accept: false, note: "None permitted" }, incomplete_penetration: { accept: false, note: "None for CJP" }, porosity: { accept: true, limit_percent: 2, limit_mm: 3 }, slag: { accept: true, limit_mm: 6 }, undercut: { accept: true, limit_mm: 0.8 }, reinforcement: { accept: true, limit_mm: 3 }, arc_strikes: { accept: false, note: "Must be ground smooth" } },
  class_B: { cracks: { accept: false, note: "Zero tolerance — but hydrogen cracking risk very high" }, incomplete_fusion: { accept: false, note: "Common in wet welding — reject" }, incomplete_penetration: { accept: false, note: "Difficult to achieve full pen wet" }, porosity: { accept: true, limit_percent: 5, limit_mm: 4, note: "Higher tolerance — porosity inherent in wet welding" }, slag: { accept: true, limit_mm: 12, note: "More generous than surface" }, undercut: { accept: true, limit_mm: 1.6, note: "1.6mm vs 0.8mm for Class A" }, reinforcement: { accept: true, limit_mm: 5 } }
};

var UNDERWATER_METALLURGY = {
  wet_weld_HAZ: { typical_hardness_HV: { min: 250, typical: 350, max: 450 }, risk: "Above 350 HV significantly increases hydrogen cracking risk", mitigation: ["Temper bead technique", "Low CE filler metal", "Controlled travel speed", "Multiple pass technique"] },
  hydrogen: { surface_low_H2_ml_100g: 4, wet_weld_typical_ml_100g: 50, note: "Wet weld hydrogen is 5-20x higher than surface low-hydrogen welding" },
  mechanical: { tensile: "70-90% of surface", yield: "75-95% of surface", elongation: "50-80% of surface", impact: "30-60% of surface — critical reduction", fatigue_life: "40-70% of surface due to porosity and HAZ hardness" },
  temper_bead: { description: "Controlled deposition of subsequent beads to temper HAZ of previous beads", purpose: "Reduce HAZ hardness from >400 to <350 HV without PWHT", requirements: ["Controlled bead placement overlapping previous HAZ", "Consistent heat input", "Minimum 3 passes", "Qualified procedure per AWS D3.6M"] }
};

var UNDERWATER_DEFECTS = {
  hydrogen_porosity: { name: "Hydrogen Porosity (Water-Induced)", tier: 3, cause: "Water contact with arc", severity: "moderate — accepted at higher levels" },
  quench_cracking: { name: "Quench Cracking", tier: 1, cause: "Rapid cooling from water — HAZ >400 HV", severity: "critical — always reject" },
  delayed_hydrogen_cracking: { name: "Delayed Hydrogen Cracking", tier: 1, cause: "Diffusible hydrogen trapped in hard HAZ", severity: "critical — develops 24-72 hours post-weld" },
  electrode_coating_breakdown: { name: "Electrode Coating Breakdown", tier: 3, cause: "Waterproof coating failure", severity: "moderate — degrades quality" },
  habitat_seal_failure: { name: "Habitat Seal Failure (Class A)", tier: 2, cause: "Water ingress into dry habitat", severity: "high — converts Class A to uncontrolled Class B" },
  pressure_porosity: { name: "Pressure-Induced Porosity", tier: 3, cause: "Ambient pressure affects gas in weld pool", severity: "moderate" }
};

function evaluateUnderwaterWeld(input) {
  var wc = input.weld_class || "class_B";
  var defects = input.defects || [];
  var classDef = WELD_CLASSES[wc];
  if (!classDef) return { error: "Unknown class. Options: class_A, class_B, class_O" };
  var criteria = ACCEPTANCE[wc] || {};
  var findings = []; var disposition = "ACCEPT"; var rejectReasons = [];
  for (var i = 0; i < defects.length; i++) {
    var d = defects[i]; var dt = d.type || "unknown"; var ds = d.size_mm || 0;
    var cr = criteria[dt]; var f = { defect: dt, size_mm: ds, class: wc };
    if (cr) {
      if (cr.accept === false) { f.disposition = "REJECT"; f.reason = cr.note || "Not permitted"; disposition = "REJECT"; rejectReasons.push(dt + ": " + (cr.note || "not permitted")); }
      else if (cr.limit_mm && ds > cr.limit_mm) { f.disposition = "REJECT"; f.reason = "Exceeds " + cr.limit_mm + "mm limit"; disposition = "REJECT"; rejectReasons.push(dt + ": exceeds " + cr.limit_mm + "mm"); }
      else { f.disposition = "ACCEPT"; f.reason = "Within " + classDef.standard + " limits"; }
    } else { f.disposition = "REQUIRES_REVIEW"; f.reason = "No specific criterion — engineering judgment"; }
    findings.push(f);
  }
  var hydrogenWarning = null;
  if (wc === "class_B") { hydrogenWarning = { warning: "DELAYED HYDROGEN CRACKING RISK", detail: "Wet welds have 5-20x higher hydrogen than surface. Cracking may develop 24-72 hours after welding.", action: "Perform MPI or ACFM 24-72 hours after welding. Do not accept based solely on immediate post-weld inspection." }; }
  var confidence = wc === "class_A" ? 0.80 : 0.60;
  if (defects.length === 0) confidence = confidence * 0.7;
  return { weld_class: wc, class_name: classDef.name, standard: classDef.standard, disposition: disposition, findings: findings, reject_reasons: rejectReasons, hydrogen_warning: hydrogenWarning, confidence: Math.round(confidence * 100) / 100, metallurgy: wc === "class_B" ? { HAZ: UNDERWATER_METALLURGY.wet_weld_HAZ, hydrogen: UNDERWATER_METALLURGY.hydrogen, mechanical: UNDERWATER_METALLURGY.mechanical } : null };
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };
  try {
    var body = JSON.parse(event.body || "{}"); var action = body.action || "get_registry";
    if (action === "get_registry") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, deploy: DEPLOY, mode: "deterministic", purpose: "Underwater Welding Authority — AWS D3.6M Class A/B, underwater metallurgy, hydrogen cracking risk", weld_classes: Object.keys(WELD_CLASSES).length, defect_types: Object.keys(UNDERWATER_DEFECTS).length, actions: ["evaluate_weld", "get_weld_classes", "get_acceptance_criteria", "get_underwater_defects", "get_metallurgy", "get_registry"] }) }; }
    if (action === "evaluate_weld") { var wr = evaluateUnderwaterWeld(body); try { var sb = createClient(supabaseUrl, supabaseKey); await sb.from("underwater_weld_assessments").insert({ org_id: body.org_id || null, case_id: body.case_id || null, weld_class: body.weld_class || "unknown", disposition: wr.disposition, confidence: wr.confidence, result_json: wr }); } catch (e) {} return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, result: wr }, null, 2) }; }
    if (action === "get_weld_classes") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, classes: WELD_CLASSES }, null, 2) }; }
    if (action === "get_acceptance_criteria") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, criteria: ACCEPTANCE }, null, 2) }; }
    if (action === "get_underwater_defects") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, defects: UNDERWATER_DEFECTS }, null, 2) }; }
    if (action === "get_metallurgy") { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ engine: ENGINE_ID, version: ENGINE_VERSION, action: action, metallurgy: UNDERWATER_METALLURGY }, null, 2) }; }
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action }) };
  } catch (err) { return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) }; }
};
