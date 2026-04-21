// @ts-nocheck
/**
 * DEPLOY239 - aerospace-vertical.ts
 * netlify/functions/aerospace-vertical.ts
 *
 * AEROSPACE & AVIATION INDUSTRY VERTICAL
 *
 * Implements FAA/EASA regulatory frameworks, damage tolerance principles,
 * composite inspection depth, and maintenance cycle integration.
 *
 * POST /api/aerospace-vertical { action: "assess_case", case_id }
 *   -> Full aerospace assessment: damage tolerance + inspection + regulatory
 *
 * POST /api/aerospace-vertical { action: "identify_damage", case_id }
 *   -> Aerospace-specific damage mechanisms
 *
 * POST /api/aerospace-vertical { action: "get_inspection_requirements", structure_type }
 *   -> Inspection requirements by structure category
 *
 * POST /api/aerospace-vertical { action: "get_registry" }
 *   -> All aerospace damage mechanisms and structure categories
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "aerospace-vertical/1.0.0";
var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// AEROSPACE DAMAGE MECHANISMS
// ================================================================
var AERO_DAMAGE = {
  fatigue_cracking: {
    id: "fatigue_cracking", name: "Fatigue Cracking",
    category: "structural",
    description: "Crack initiation and growth under cyclic loading. Primary concern for pressurized fuselage, wing structures, and landing gear. Managed through damage tolerance analysis per FAR 25.571.",
    materials: ["aluminum_2024", "aluminum_7075", "aluminum_7050", "titanium_6al4v", "steel_4340"],
    components: ["fuselage_skin", "wing_spar", "wing_skin", "bulkhead", "landing_gear", "engine_mount"],
    inspection_methods: ["HFEC", "LFEC", "UT", "RT", "fluorescent_PT", "VT"],
    regulatory: "FAR 25.571, AC 25.571-1D",
    severity: "critical",
    keywords: ["fatigue", "crack", "cyclic", "pressurization", "flight_cycle"]
  },
  corrosion_general: {
    id: "corrosion_general", name: "General / Uniform Corrosion",
    category: "environmental",
    description: "Surface corrosion of aluminum alloys from moisture, salt spray, and chemical exposure. Exfoliation corrosion particularly dangerous on high-strength aluminum.",
    materials: ["aluminum_2024", "aluminum_7075", "aluminum_7050"],
    components: ["fuselage_skin", "wing_skin", "spar_caps", "stringers", "floor_beams", "bilge_area"],
    inspection_methods: ["VT", "HFEC", "UT", "tap_testing"],
    regulatory: "AC 43-4B, CPCP per FAR 25.509",
    severity: "moderate_to_high",
    keywords: ["corrosion", "exfoliation", "intergranular", "filiform", "pitting", "surface"]
  },
  stress_corrosion: {
    id: "stress_corrosion", name: "Stress Corrosion Cracking (SCC)",
    category: "environmental",
    description: "Intergranular cracking in susceptible aluminum alloys under sustained tensile stress in corrosive environment. 7xxx-series alloys in short-transverse grain direction most susceptible.",
    materials: ["aluminum_7075_t6", "aluminum_7079", "aluminum_2024_t3"],
    components: ["wing_spar", "bulkhead", "fitting", "forging", "extrusion"],
    inspection_methods: ["ET", "UT", "fluorescent_PT"],
    regulatory: "FAR 25.571, AD mandates for specific fleet",
    severity: "critical",
    keywords: ["scc", "stress_corrosion", "intergranular", "7075", "sustained_load"]
  },
  composite_delamination: {
    id: "composite_delamination", name: "Composite Delamination / Disbond",
    category: "composite",
    description: "Separation between plies in composite laminates or disbond between composite skin and substructure. Can result from impact, manufacturing defects, moisture ingress, or thermal cycling.",
    materials: ["cfrp", "gfrp", "honeycomb", "fiberglass"],
    components: ["empennage", "flight_control_surface", "nacelle", "fairing", "radome", "wing_skin_composite"],
    inspection_methods: ["tap_testing", "UT_pulse_echo", "thermography", "shearography", "bond_testing"],
    regulatory: "AC 20-107B, CMH-17",
    severity: "moderate_to_critical",
    keywords: ["delamination", "disbond", "composite", "impact", "bvid", "barely_visible"]
  },
  composite_impact: {
    id: "composite_impact", name: "Impact Damage (BVID/VID)",
    category: "composite",
    description: "Barely Visible Impact Damage (BVID) and Visible Impact Damage (VID) in composite structures. BVID is particularly dangerous because internal damage may be extensive while surface shows minimal indication.",
    materials: ["cfrp", "gfrp", "honeycomb"],
    components: ["fuselage_composite", "wing_composite", "empennage", "nacelle", "radome"],
    inspection_methods: ["VT", "tap_testing", "UT_pulse_echo", "thermography", "PAUT"],
    regulatory: "AC 20-107B, AMC 20-29",
    severity: "high_to_critical",
    keywords: ["impact", "bvid", "vid", "dent", "hail", "tool_drop", "fod"]
  },
  hydrogen_embrittlement_aero: {
    id: "hydrogen_embrittlement_aero", name: "Hydrogen Embrittlement (Landing Gear)",
    category: "structural",
    description: "High-strength steel landing gear and fittings susceptible to hydrogen embrittlement from cadmium plating processes, pickling, or cathodic protection.",
    materials: ["steel_4340", "steel_300m", "steel_4330v"],
    components: ["landing_gear", "actuator", "high_strength_bolt", "fitting"],
    inspection_methods: ["MT", "fluorescent_PT", "UT", "ET"],
    regulatory: "FAR 25.571",
    severity: "critical",
    keywords: ["hydrogen", "embrittlement", "landing_gear", "high_strength", "cadmium", "plating"]
  },
  thermal_damage: {
    id: "thermal_damage", name: "Thermal / Heat Damage",
    category: "environmental",
    description: "Overheating damage to composite and metallic structures from engine bleed air leaks, fire, lightning strike, or brake heat. Composites lose strength above glass transition temperature.",
    materials: ["cfrp", "gfrp", "aluminum_2024", "titanium"],
    components: ["engine_pylon", "nacelle", "wheel_well", "brake_assembly", "wing_root"],
    inspection_methods: ["VT", "thermography", "UT", "tap_testing", "hardness_testing"],
    regulatory: "AC 20-107B, AC 20-53B (lightning)",
    severity: "moderate_to_critical",
    keywords: ["thermal", "heat", "overheat", "lightning", "fire", "bleed_air", "burn"]
  },
  fretting: {
    id: "fretting", name: "Fretting / Wear",
    category: "structural",
    description: "Surface damage at contact interfaces under oscillating relative motion. Common at fastener holes, bushing interfaces, and control surface hinges.",
    materials: ["aluminum_2024", "aluminum_7075", "titanium_6al4v", "steel"],
    components: ["fastener_hole", "bushing", "hinge", "lug", "pin_joint", "actuator_attachment"],
    inspection_methods: ["VT", "HFEC", "ET", "fluorescent_PT"],
    regulatory: "Structural repair manual",
    severity: "moderate",
    keywords: ["fretting", "wear", "fastener", "bushing", "hinge", "contact"]
  },
  disbond_adhesive: {
    id: "disbond_adhesive", name: "Adhesive Bond Degradation",
    category: "composite",
    description: "Degradation of adhesive bonds in bonded metallic and composite structures. Affected by moisture, temperature cycling, surface preparation quality, and age.",
    materials: ["bonded_aluminum", "cfrp_bonded", "honeycomb_bonded"],
    components: ["doubler", "bonded_repair", "honeycomb_panel", "skin_stringer_bond", "leading_edge"],
    inspection_methods: ["tap_testing", "bond_testing", "UT", "thermography"],
    regulatory: "AC 20-107B, CMH-17",
    severity: "moderate_to_high",
    keywords: ["bond", "adhesive", "disbond", "honeycomb", "doubler", "bonded"]
  }
};

// ================================================================
// STRUCTURE CATEGORIES & INSPECTION REQUIREMENTS
// ================================================================
var STRUCTURE_CATEGORIES = {
  principal_structural_elements: {
    id: "pse", name: "Principal Structural Elements (PSE)",
    description: "Structural elements that carry flight, ground, or pressurization loads whose failure could be catastrophic.",
    examples: ["wing_spar", "fuselage_frame", "bulkhead", "landing_gear_fitting", "engine_mount", "horizontal_stabilizer_spar"],
    inspection_approach: "Damage tolerance analysis per FAR 25.571. Inspection intervals set to detect damage before it reaches critical size.",
    typical_intervals: "Based on crack growth analysis — typically 1,000 to 20,000 flight cycles depending on stress level and environment",
    regulatory: "FAR 25.571, AC 25.571-1D"
  },
  damage_tolerant_structure: {
    id: "dts", name: "Damage Tolerant Structure",
    description: "Structure designed to sustain damage without catastrophic failure until detected at scheduled inspections.",
    examples: ["fuselage_skin", "wing_skin", "spar_web", "stringer"],
    inspection_approach: "Scheduled inspections at intervals ensuring damage is found before residual strength falls below limit load.",
    typical_intervals: "Repeat inspections per MRBR or SSID",
    regulatory: "FAR 25.571(b), MSG-3"
  },
  safe_life_structure: {
    id: "sls", name: "Safe-Life Structure",
    description: "Structure with a defined life limit — must be replaced at or before the limit regardless of condition.",
    examples: ["landing_gear", "some_fittings", "specific_lugs"],
    inspection_approach: "Retirement at certified safe-life limit. Inspections during service for corrosion and damage.",
    typical_intervals: "Hard life limit (flight hours or cycles). No extension without analysis.",
    regulatory: "FAR 25.571(c)"
  },
  composite_structure: {
    id: "cs", name: "Composite Structure",
    description: "CFRP/GFRP primary and secondary structure. Damage tolerance approach with specific considerations for impact damage, environmental degradation, and manufacturing defects.",
    examples: ["787_fuselage", "a350_wing", "empennage_skins", "flight_control_surfaces"],
    inspection_approach: "Damage tolerance with BVID threshold. Scheduled inspections plus event-driven (after known impacts).",
    typical_intervals: "Varies by zone — external VT at A-check, detailed at C-check, special for known impact zones",
    regulatory: "AC 20-107B, AMC 20-29, FAR 25.571"
  },
  maintenance_checks: {
    id: "maint", name: "Maintenance Check Intervals",
    description: "Standard airline maintenance check structure.",
    checks: [
      { check: "Transit", interval: "Every flight", scope: "Walk-around, fluid levels, obvious damage" },
      { check: "A-Check", interval: "400-800 flight hours", scope: "General visual, lubrication, operational checks" },
      { check: "B-Check", interval: "6-8 months (being phased out)", scope: "More detailed checks, filter changes" },
      { check: "C-Check", interval: "18-24 months / 4,000-6,000 FH", scope: "Detailed structural inspection, systems checks, corrosion treatment" },
      { check: "D-Check (Heavy)", interval: "6-12 years / 20,000-30,000 FH", scope: "Complete strip-down, full structural inspection, major component overhaul" }
    ]
  }
};

// ================================================================
// MATCHING LOGIC
// ================================================================
function lower(s) { return (s || "").toString().toLowerCase(); }

function identifyAeroDamage(caseData) {
  var text = lower(caseData.damage_type) + " " + lower(caseData.material) + " " + lower(caseData.notes) + " " + lower(caseData.component_name) + " " + lower(caseData.asset_type);
  var matches = [];

  var dmgKeys = Object.keys(AERO_DAMAGE);
  for (var i = 0; i < dmgKeys.length; i++) {
    var dmg = AERO_DAMAGE[dmgKeys[i]];
    var score = 0;
    var reasons = [];

    for (var k = 0; k < dmg.keywords.length; k++) {
      if (text.indexOf(dmg.keywords[k]) >= 0) { score += 20; reasons.push("keyword: " + dmg.keywords[k]); }
    }
    for (var m = 0; m < dmg.materials.length; m++) {
      var matWords = dmg.materials[m].replace(/_/g, " ").split(" ");
      for (var mw = 0; mw < matWords.length; mw++) {
        if (matWords[mw].length > 3 && text.indexOf(matWords[mw]) >= 0) { score += 10; reasons.push("material: " + dmg.materials[m]); break; }
      }
    }
    for (var c = 0; c < dmg.components.length; c++) {
      var compWords = dmg.components[c].replace(/_/g, " ").split(" ");
      for (var cw = 0; cw < compWords.length; cw++) {
        if (compWords[cw].length > 3 && text.indexOf(compWords[cw]) >= 0) { score += 15; reasons.push("component: " + dmg.components[c]); break; }
      }
    }

    if (score > 0) {
      matches.push({
        mechanism_id: dmg.id, name: dmg.name, category: dmg.category,
        match_score: score, match_reasons: reasons, severity: dmg.severity,
        inspection_methods: dmg.inspection_methods, regulatory: dmg.regulatory,
        description: dmg.description
      });
    }
  }

  matches.sort(function(a, b) { return b.match_score - a.match_score; });
  return matches;
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

    if (action === "get_registry") {
      var dmgList = [];
      var dmgKeys = Object.keys(AERO_DAMAGE);
      for (var i = 0; i < dmgKeys.length; i++) {
        var d = AERO_DAMAGE[dmgKeys[i]];
        dmgList.push({ id: d.id, name: d.name, category: d.category, severity: d.severity, regulatory: d.regulatory });
      }
      return {
        statusCode: 200, headers: corsHeaders,
        body: JSON.stringify({
          damage_mechanisms: dmgList.length, structure_categories: Object.keys(STRUCTURE_CATEGORIES).length,
          mechanisms: dmgList, categories: Object.keys(STRUCTURE_CATEGORIES),
          engine_version: ENGINE_VERSION, response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    if (action === "get_inspection_requirements") {
      if (!body.structure_type) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "structure_type required" }) };
      var cat = STRUCTURE_CATEGORIES[body.structure_type];
      if (!cat) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Unknown structure type. Valid: " + Object.keys(STRUCTURE_CATEGORIES).join(", ") }) };
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ structure: cat, engine_version: ENGINE_VERSION, response_ms: Date.now() - startTime }, null, 2) };
    }

    if (action === "identify_damage") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      var caseResult = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (caseResult.error || !caseResult.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };
      var damage = identifyAeroDamage(caseResult.data);
      return {
        statusCode: 200, headers: corsHeaders,
        body: JSON.stringify({ case_id: body.case_id, damage_mechanisms: damage, total_matches: damage.length, primary: damage.length > 0 ? damage[0] : null, engine_version: ENGINE_VERSION, response_ms: Date.now() - startTime }, null, 2)
      };
    }

    if (action === "assess_case") {
      if (!body.case_id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "case_id required" }) };
      var assessCase = await sb.from("inspection_cases").select("*").eq("id", body.case_id).single();
      if (assessCase.error || !assessCase.data) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Case not found" }) };

      var cd = assessCase.data;
      var mechs = identifyAeroDamage(cd);

      var inspMethods = {};
      for (var ri = 0; ri < mechs.length && ri < 5; ri++) {
        for (var rm = 0; rm < mechs[ri].inspection_methods.length; rm++) {
          var mth = mechs[ri].inspection_methods[rm];
          inspMethods[mth] = (inspMethods[mth] || 0) + 1;
        }
      }
      var methodList = [];
      var mKeys = Object.keys(inspMethods);
      for (var ml = 0; ml < mKeys.length; ml++) methodList.push({ method: mKeys[ml], relevance: inspMethods[mKeys[ml]] });
      methodList.sort(function(a, b) { return b.relevance - a.relevance; });

      var threatLevel = "low";
      if (mechs.length > 0) {
        var sev = mechs[0].severity;
        if (sev.indexOf("critical") >= 0) threatLevel = "critical";
        else if (sev.indexOf("high") >= 0) threatLevel = "high";
        else if (sev.indexOf("moderate") >= 0) threatLevel = "moderate";
      }

      return {
        statusCode: 200, headers: corsHeaders,
        body: JSON.stringify({
          case_id: body.case_id,
          aerospace_assessment: {
            threat_level: threatLevel,
            primary_mechanism: mechs.length > 0 ? { id: mechs[0].mechanism_id, name: mechs[0].name, severity: mechs[0].severity, regulatory: mechs[0].regulatory } : null,
            total_mechanisms: mechs.length,
            recommended_inspection: methodList,
            regulatory_references: mechs.length > 0 ? mechs.slice(0, 3).map(function(m) { return m.regulatory; }) : [],
            damage_tolerance_note: "All aerospace structural assessments must comply with FAR 25.571 damage tolerance requirements. Inspection intervals are based on crack growth analysis ensuring detection before critical size."
          },
          mechanisms: mechs,
          case_summary: { component: cd.component_name, material: cd.material, damage_type: cd.damage_type, asset_type: cd.asset_type },
          engine_version: ENGINE_VERSION, response_ms: Date.now() - startTime
        }, null, 2)
      };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown action: " + action + ". Valid: identify_damage, assess_case, get_inspection_requirements, get_registry" }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
