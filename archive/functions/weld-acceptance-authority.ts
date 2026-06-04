// @ts-nocheck
/**
 * DEPLOY272 - Weld Acceptance Authority v2.0.0 "Smartest CWI Core"
 * netlify/functions/weld-acceptance-authority.ts
 *
 * COMPLETE CWI-level deterministic weld evaluation engine.
 * Full hardcoded knowledge base — same pattern as live-code-authority.ts.
 * No database dependency for core logic. All standards, criteria, materials,
 * processes, joints, and physics hardcoded directly.
 *
 * Architecture: OpenAI sees -> Claude reasons -> this engine DECIDES.
 * AI handles observation. This engine handles code, physics, and law.
 *
 * Knowledge base:
 *   12 welding codes with real numeric acceptance criteria
 *   65+ discontinuity types (ISO 6520 taxonomy)
 *   15 material families with weldability data
 *   15 welding processes with physics & typical defects
 *   18 joint configurations
 *   7 service condition modifiers (sour, cryogenic, cyclic, etc.)
 *   10 damage progression models
 *   5 repair method families
 *
 * 15 actions:
 *   get_registry
 *   evaluate_weld            -- full CWI pipeline
 *   route_code               -- determine governing code + clause
 *   check_acceptance         -- single discontinuity vs code threshold
 *   check_dominance          -- discontinuity interaction/dominance ranking
 *   validate_physics         -- 4D physics plausibility
 *   check_evidence           -- evidence sufficiency gate
 *   get_process_registry     -- all welding processes
 *   get_material_registry    -- all base materials
 *   get_joint_registry       -- all joint configurations
 *   get_discontinuity_registry -- all discontinuity types
 *   get_code_library         -- all supported codes with editions
 *   get_service_conditions   -- service condition modifiers
 *   get_damage_models        -- damage progression models
 *   get_repair_methods       -- repair intelligence
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var ENGINE_NAME = "weld-acceptance-authority";
var ENGINE_VERSION = "v2.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

var supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// == helpers ==

function ok(data) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(data) };
}

function fail(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

function getOrg(event) {
  try {
    var auth = event.headers["authorization"] || "";
    if (!auth) return null;
    var token = auth.replace("Bearer ", "");
    var payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.app_metadata && payload.app_metadata.org_id ? payload.app_metadata.org_id : null;
  } catch (e) {
    return null;
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function nowISO() {
  return new Date().toISOString();
}

function auditLog(orgId, actionType, caseId, scanId, detail) {
  return supabase.from("weld_audit_events").insert({
    org_id: orgId,
    case_id: caseId || null,
    scan_id: scanId || null,
    action_type: actionType,
    event_json: detail
  });
}

// ================================================================
// CODE LIBRARY — All supported welding codes with current editions
// Updated via Live Code Authority auto-update pattern
// ================================================================

var CODE_LIBRARY = {
  aws_d1_1: {
    code_key: "aws_d1_1",
    code_name: "AWS D1.1/D1.1M Structural Welding Code - Steel",
    edition: "2025 (26th Edition)",
    edition_year: 2025,
    organization: "American Welding Society",
    scope: "Structural steel welding for buildings, bridges (static), tubular",
    acceptance_tables: ["Table 8.9 (Visual)", "Table 8.10 (RT)", "Table 8.11 (UT)"],
    loading_conditions: ["static", "cyclic"],
    material_scope: "Carbon and low-alloy steels",
    thickness_range_mm: "3.2 to unlimited",
    supersedes: "AWS D1.1:2020 (25th Edition)"
  },
  aws_d1_2: {
    code_key: "aws_d1_2",
    code_name: "AWS D1.2/D1.2M Structural Welding Code - Aluminum",
    edition: "2014 (5th Edition)",
    edition_year: 2014,
    organization: "American Welding Society",
    scope: "Structural aluminum welding",
    acceptance_tables: ["Table 8.1 (Visual)", "Table 8.2 (RT)"],
    loading_conditions: ["static", "cyclic"],
    material_scope: "Aluminum alloys (1xxx-7xxx series)",
    thickness_range_mm: "2.5 to unlimited",
    supersedes: "AWS D1.2:2008"
  },
  aws_d1_3: {
    code_key: "aws_d1_3",
    code_name: "AWS D1.3/D1.3M Structural Welding Code - Sheet Steel",
    edition: "2018 (2nd Edition)",
    edition_year: 2018,
    organization: "American Welding Society",
    scope: "Sheet steel to structural member connections",
    acceptance_tables: ["Table 7.1"],
    loading_conditions: ["static"],
    material_scope: "Sheet steel <= 4.8mm (3/16 in.)",
    thickness_range_mm: "0.5 to 4.8",
    supersedes: "AWS D1.3:2008"
  },
  aws_d1_5: {
    code_key: "aws_d1_5",
    code_name: "AWS D1.5M/D1.5 Bridge Welding Code",
    edition: "2015 (7th Edition) with 2016 Errata",
    edition_year: 2015,
    organization: "American Welding Society",
    scope: "Highway bridge welding per AASHTO",
    acceptance_tables: ["Table 6.1 (Visual)", "Table 6.2 (RT)", "Table 6.3 (UT)"],
    loading_conditions: ["cyclic"],
    material_scope: "Bridge steels per AASHTO/AWS",
    thickness_range_mm: "3.2 to unlimited",
    supersedes: "AWS D1.5:2010"
  },
  aws_d1_6: {
    code_key: "aws_d1_6",
    code_name: "AWS D1.6/D1.6M Structural Welding Code - Stainless Steel",
    edition: "2017 (2nd Edition)",
    edition_year: 2017,
    organization: "American Welding Society",
    scope: "Stainless steel structural welding",
    acceptance_tables: ["Table 8.1 (Visual)", "Table 8.2 (RT)"],
    loading_conditions: ["static", "cyclic"],
    material_scope: "Austenitic, ferritic, martensitic, duplex stainless steels",
    thickness_range_mm: "1.5 to unlimited",
    supersedes: "AWS D1.6:2007"
  },
  aws_d1_8: {
    code_key: "aws_d1_8",
    code_name: "AWS D1.8/D1.8M Structural Welding Code - Seismic Supplement",
    edition: "2025 (3rd Edition)",
    edition_year: 2025,
    organization: "American Welding Society",
    scope: "Seismic welding supplement to D1.1 for demand-critical connections",
    acceptance_tables: ["Table 6.1 (Visual)", "Table 6.2 (UT)"],
    loading_conditions: ["seismic"],
    material_scope: "Structural steels in seismic force-resisting systems",
    thickness_range_mm: "3.2 to unlimited",
    supersedes: "AWS D1.8:2016"
  },
  api_1104: {
    code_key: "api_1104",
    code_name: "API Standard 1104 Welding of Pipelines and Related Facilities",
    edition: "22nd Edition (2021)",
    edition_year: 2021,
    organization: "American Petroleum Institute",
    scope: "Pipeline welding for oil, gas, and water transmission",
    acceptance_tables: ["Table 1 (Visual/RT)", "Section 9.3 (AUT)", "Section 9.7 (MFL)"],
    loading_conditions: ["pressure", "cyclic_pressure"],
    material_scope: "Carbon and low-alloy pipe steels",
    thickness_range_mm: "3.2 to 50+",
    supersedes: "API 1104 21st Edition (2013)"
  },
  asme_viii: {
    code_key: "asme_viii",
    code_name: "ASME BPVC Section VIII Division 1 - Pressure Vessels",
    edition: "2025 Edition",
    edition_year: 2025,
    organization: "American Society of Mechanical Engineers",
    scope: "Pressure vessel fabrication welding",
    acceptance_tables: ["UW-51 (RT)", "Appendix 4 (UT)", "Appendix 8 (MT/PT)"],
    loading_conditions: ["pressure", "cyclic_pressure"],
    material_scope: "All pressure vessel materials per Section II",
    thickness_range_mm: "1.5 to unlimited",
    supersedes: "ASME BPVC VIII 2023 Edition"
  },
  asme_ix: {
    code_key: "asme_ix",
    code_name: "ASME BPVC Section IX - Welding, Brazing, and Fusing Qualifications",
    edition: "2025 Edition",
    edition_year: 2025,
    organization: "American Society of Mechanical Engineers",
    scope: "WPS/PQR/welder qualification requirements",
    acceptance_tables: ["QW-191 (Visual)", "QW-302 (Mechanical)"],
    loading_conditions: ["all"],
    material_scope: "All materials per P-number grouping",
    thickness_range_mm: "all",
    supersedes: "ASME BPVC IX 2023 Edition"
  },
  asme_b31_1: {
    code_key: "asme_b31_1",
    code_name: "ASME B31.1 Power Piping",
    edition: "2024 Edition",
    edition_year: 2024,
    organization: "American Society of Mechanical Engineers",
    scope: "Power plant and utility piping systems",
    acceptance_tables: ["Table 136.4 (Visual)", "Table 136.4.2 (RT)"],
    loading_conditions: ["pressure", "cyclic"],
    material_scope: "Power piping materials per ASME B31.1",
    thickness_range_mm: "2.0 to unlimited",
    supersedes: "ASME B31.1 2022 Edition"
  },
  asme_b31_3: {
    code_key: "asme_b31_3",
    code_name: "ASME B31.3 Process Piping",
    edition: "2024 Edition",
    edition_year: 2024,
    organization: "American Society of Mechanical Engineers",
    scope: "Chemical, petroleum, pharmaceutical process piping",
    acceptance_tables: ["Table 341.3.2 (RT)", "Table 341.3.1 (Visual)"],
    loading_conditions: ["pressure", "cyclic", "severe_cyclic"],
    material_scope: "All process piping materials",
    thickness_range_mm: "1.5 to unlimited",
    supersedes: "ASME B31.3 2022 Edition"
  },
  iso_5817: {
    code_key: "iso_5817",
    code_name: "ISO 5817 Welding - Fusion-Welded Joints in Steel, Nickel, Titanium and Their Alloys - Quality Levels",
    edition: "4th Edition (2023)",
    edition_year: 2023,
    organization: "International Organization for Standardization",
    scope: "Quality levels for fusion weld imperfections",
    acceptance_tables: ["Table 1 (Quality Levels B, C, D)"],
    loading_conditions: ["static", "fatigue"],
    material_scope: "Steel, nickel, titanium alloys",
    thickness_range_mm: "0.5 to unlimited",
    supersedes: "ISO 5817:2014 (3rd Edition)"
  }
};


// ================================================================
// ACCEPTANCE CRITERIA — Real numeric limits from each code
// Key format: code_key + "__" + discontinuity_family
// ================================================================

var ACCEPTANCE_CRITERIA = {
  // ============== AWS D1.1 ==============
  aws_d1_1__crack: {
    code_key: "aws_d1_1", disc_family: "crack", table_ref: "Table 8.9",
    clause: "Clause 8.9.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted regardless of size or location"
  },
  aws_d1_1__incomplete_fusion: {
    code_key: "aws_d1_1", disc_family: "incomplete_fusion", table_ref: "Table 8.9",
    clause: "Clause 8.9.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion permitted"
  },
  aws_d1_1__incomplete_penetration: {
    code_key: "aws_d1_1", disc_family: "incomplete_penetration", table_ref: "Table 8.9",
    clause: "Clause 8.9.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete joint penetration in CJP welds"
  },
  aws_d1_1__undercut_static: {
    code_key: "aws_d1_1", disc_family: "undercut", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(4)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_depth_mm: 1.6,
    max_depth_mm_thin: 0.8,
    thin_threshold_mm: 25,
    note: "Max 1.6mm for t>=25mm; max 0.8mm for t<25mm (static)"
  },
  aws_d1_1__undercut_cyclic: {
    code_key: "aws_d1_1", disc_family: "undercut", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(4)", criteria_type: "dimensional",
    absolute_reject: false, loading: "cyclic",
    max_depth_mm: 0.25,
    note: "Max 0.25mm for members under cyclic loading"
  },
  aws_d1_1__porosity_individual: {
    code_key: "aws_d1_1", disc_family: "porosity", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(6)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_individual_mm: 2.4,
    max_count_per_25mm: 1,
    note: "Max individual pore 2.4mm diameter. Max frequency: 1 per 25mm of weld"
  },
  aws_d1_1__porosity_cyclic: {
    code_key: "aws_d1_1", disc_family: "porosity", table_ref: "Table 8.9",
    clause: "Clause 8.9.2(6)", criteria_type: "dimensional",
    absolute_reject: false, loading: "cyclic",
    max_individual_mm: 0.8,
    max_count_per_25mm: 1,
    note: "Max pore 0.8mm for cyclic loading"
  },
  aws_d1_1__slag_static: {
    code_key: "aws_d1_1", disc_family: "inclusion", table_ref: "Table 8.10",
    clause: "Clause 8.12.1", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_length_mm: null,
    max_width_fraction_t: 0.33,
    max_width_mm: 2.4,
    note: "Max width 1/3 t or 2.4mm whichever is less. No length limit for individual elongated inclusions if separated."
  },
  aws_d1_1__overlap: {
    code_key: "aws_d1_1", disc_family: "overlap", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(2)", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "Overlap (cold lap) not permitted"
  },
  aws_d1_1__convexity: {
    code_key: "aws_d1_1", disc_family: "convexity", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(3)", criteria_type: "dimensional",
    absolute_reject: false, loading: "all",
    max_by_leg: { "5": 1.6, "8": 2.4, "13": 3.2, "25": 4.8 },
    note: "Max convexity varies by leg size: <=5mm leg: 1.6mm, <=8mm: 2.4mm, <=13mm: 3.2mm, <=25mm: 4.8mm"
  },
  aws_d1_1__undersize_fillet: {
    code_key: "aws_d1_1", disc_family: "undersize", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(5)", criteria_type: "dimensional",
    absolute_reject: false, loading: "all",
    max_undersize_mm: 1.6,
    max_undersize_length_mm: 50,
    note: "Fillet weld undersize max 1.6mm below specified for max 50mm cumulative per 300mm"
  },
  aws_d1_1__arc_strike: {
    code_key: "aws_d1_1", disc_family: "arc_strike", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(8)", criteria_type: "conditional",
    absolute_reject: false, loading: "all",
    note: "Arc strikes outside weld area shall be ground smooth and inspected for cracks"
  },
  aws_d1_1__spatter: {
    code_key: "aws_d1_1", disc_family: "spatter", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(9)", criteria_type: "conditional",
    absolute_reject: false, loading: "all",
    note: "Excessive spatter shall be removed. Evaluate for underlying porosity."
  },
  aws_d1_1__reinforcement: {
    code_key: "aws_d1_1", disc_family: "reinforcement", table_ref: "Table 8.9",
    clause: "Clause 8.9.1(3)", criteria_type: "dimensional",
    absolute_reject: false, loading: "all",
    max_reinforcement_mm: 3.2,
    note: "Max reinforcement (crown height) 3.2mm above flush"
  },

  // ============== API 1104 ==============
  api_1104__crack: {
    code_key: "api_1104", disc_family: "crack", table_ref: "Table 1",
    clause: "Section 9.3.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted"
  },
  api_1104__incomplete_fusion: {
    code_key: "api_1104", disc_family: "incomplete_fusion", table_ref: "Table 1",
    clause: "Section 9.3.3", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_individual_mm: 25.4,
    max_aggregate_per_300mm: 25.4,
    note: "IF/IP max 25.4mm individual, max 25.4mm aggregate per 300mm weld"
  },
  api_1104__incomplete_penetration: {
    code_key: "api_1104", disc_family: "incomplete_penetration", table_ref: "Table 1",
    clause: "Section 9.3.3", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_individual_mm: 25.4,
    max_aggregate_per_300mm: 25.4,
    note: "IP max 25.4mm individual, max 25.4mm aggregate per 300mm weld"
  },
  api_1104__burn_through: {
    code_key: "api_1104", disc_family: "burn_through", table_ref: "Table 1",
    clause: "Section 9.3.5", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_dimension_mm: 6.4,
    max_count_per_weld: 4,
    note: "Max 6.4mm dimension, max 4 per weld"
  },
  api_1104__undercut: {
    code_key: "api_1104", disc_family: "undercut", table_ref: "Table 1",
    clause: "Section 9.3.8", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_depth_mm: 0.8,
    max_depth_percent_wall: 12.5,
    note: "Max 0.8mm or 12.5% of wall thickness, whichever is less"
  },
  api_1104__porosity: {
    code_key: "api_1104", disc_family: "porosity", table_ref: "Table 1",
    clause: "Section 9.3.6", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_individual_mm: 3.2,
    max_area_percent: 2,
    max_cluster_width_mm: 13,
    note: "Max individual pore 3.2mm, max 2% of weld area. Cluster max 13mm width."
  },
  api_1104__slag_inclusion: {
    code_key: "api_1104", disc_family: "inclusion", table_ref: "Table 1",
    clause: "Section 9.3.4", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_length_mm: 50.8,
    max_width_mm: 1.6,
    max_aggregate_per_300mm: 50.8,
    note: "Max 50.8mm length, 1.6mm width. Aggregate max 50.8mm per 300mm weld."
  },
  api_1104__internal_concavity: {
    code_key: "api_1104", disc_family: "concavity", table_ref: "Table 1",
    clause: "Section 9.3.7", criteria_type: "conditional",
    absolute_reject: false, loading: "pressure",
    note: "Acceptable if density does not exceed thinnest adjacent base metal per RT"
  },
  api_1104__reinforcement: {
    code_key: "api_1104", disc_family: "reinforcement", table_ref: "Table 1",
    clause: "Section 9.3.2", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_reinforcement_mm: 1.6,
    note: "Max external reinforcement 1.6mm"
  },

  // ============== ASME VIII Div 1 ==============
  asme_viii__crack: {
    code_key: "asme_viii", disc_family: "crack", table_ref: "UW-51",
    clause: "UW-51(a)", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted in pressure vessel welds"
  },
  asme_viii__incomplete_fusion: {
    code_key: "asme_viii", disc_family: "incomplete_fusion", table_ref: "UW-51",
    clause: "UW-51(a)(2)", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion permitted"
  },
  asme_viii__incomplete_penetration: {
    code_key: "asme_viii", disc_family: "incomplete_penetration", table_ref: "UW-51",
    clause: "UW-51(a)(3)", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete penetration in full penetration joints"
  },
  asme_viii__undercut: {
    code_key: "asme_viii", disc_family: "undercut", table_ref: "UW-35",
    clause: "UW-35(a)", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_depth_mm: 0.8,
    note: "Max 0.8mm (1/32 in.) undercut depth"
  },
  asme_viii__porosity: {
    code_key: "asme_viii", disc_family: "porosity", table_ref: "Appendix 4",
    clause: "Appendix 4-3", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_individual_mm: 4.8,
    acceptance_per_appendix_4: true,
    note: "Per Appendix 4 acceptance charts. Max individual indication 4.8mm for t < 19mm."
  },
  asme_viii__slag_inclusion: {
    code_key: "asme_viii", disc_family: "inclusion", table_ref: "Appendix 4",
    clause: "Appendix 4-3", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_length_mm_fraction_t: 0.67,
    max_length_mm_cap: 19,
    note: "Max 2/3 t or 19mm whichever is less. Multiple aligned: aggregate per Appendix 4."
  },
  asme_viii__reinforcement: {
    code_key: "asme_viii", disc_family: "reinforcement", table_ref: "UW-35",
    clause: "UW-35(a)", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_reinforcement_by_thickness: {
      "6.4": 1.6, "12.7": 2.4, "25.4": 3.2, "50.8": 4.0, "76.2": 4.8, "999": 6.4
    },
    note: "Max reinforcement varies: t<=6.4mm: 1.6mm, t<=12.7mm: 2.4mm, t<=25.4mm: 3.2mm, t<=50.8mm: 4mm, t<=76.2mm: 4.8mm, t>76.2mm: 6.4mm"
  },

  // ============== ASME B31.3 ==============
  asme_b31_3__crack: {
    code_key: "asme_b31_3", disc_family: "crack", table_ref: "Table 341.3.2",
    clause: "341.3.2(a)", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted"
  },
  asme_b31_3__incomplete_fusion: {
    code_key: "asme_b31_3", disc_family: "incomplete_fusion", table_ref: "Table 341.3.2",
    clause: "341.3.2(c)", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion"
  },
  asme_b31_3__incomplete_penetration: {
    code_key: "asme_b31_3", disc_family: "incomplete_penetration", table_ref: "Table 341.3.2",
    clause: "341.3.2(b)", criteria_type: "conditional",
    absolute_reject: false, loading: "pressure",
    max_individual_mm: null,
    note: "IP not exceeding Tw/3 or 2.4mm whichever is smaller. Not allowed in severe cyclic."
  },
  asme_b31_3__undercut: {
    code_key: "asme_b31_3", disc_family: "undercut", table_ref: "Table 341.3.2",
    clause: "341.3.2(d)", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_depth_mm: 0.8,
    max_depth_percent_wall: 12.5,
    note: "Max 0.8mm or 12.5% of wall, whichever is less. Not allowed in severe cyclic > 0.4mm."
  },
  asme_b31_3__porosity: {
    code_key: "asme_b31_3", disc_family: "porosity", table_ref: "Table 341.3.2",
    clause: "341.3.2(e)", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_individual_mm: null,
    note: "Per ASME Section VIII Appendix 4 acceptance standards for RT"
  },
  asme_b31_3__reinforcement: {
    code_key: "asme_b31_3", disc_family: "reinforcement", table_ref: "Table 341.3.2",
    clause: "341.3.2(f)", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_reinforcement_mm: 1.6,
    note: "Max external reinforcement shall not exceed the lesser of 1.6mm or 1/8 times width of reinforcement"
  },

  // ============== ASME B31.1 ==============
  asme_b31_1__crack: {
    code_key: "asme_b31_1", disc_family: "crack", table_ref: "Table 136.4",
    clause: "136.4.2", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted"
  },
  asme_b31_1__incomplete_fusion: {
    code_key: "asme_b31_1", disc_family: "incomplete_fusion", table_ref: "Table 136.4",
    clause: "136.4.2", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion"
  },
  asme_b31_1__undercut: {
    code_key: "asme_b31_1", disc_family: "undercut", table_ref: "Table 136.4",
    clause: "136.4.3", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    max_depth_mm: 0.8,
    note: "Max 0.8mm (1/32 in.) undercut"
  },
  asme_b31_1__porosity: {
    code_key: "asme_b31_1", disc_family: "porosity", table_ref: "Table 136.4",
    clause: "136.4.4", criteria_type: "dimensional",
    absolute_reject: false, loading: "pressure",
    note: "Per ASME Section VIII Appendix 4 acceptance standards"
  },

  // ============== AWS D1.5 Bridge ==============
  aws_d1_5__crack: {
    code_key: "aws_d1_5", disc_family: "crack", table_ref: "Table 6.1",
    clause: "6.26.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted — all bridge welds treated as cyclic"
  },
  aws_d1_5__incomplete_fusion: {
    code_key: "aws_d1_5", disc_family: "incomplete_fusion", table_ref: "Table 6.1",
    clause: "6.26.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion in bridge welds"
  },
  aws_d1_5__undercut: {
    code_key: "aws_d1_5", disc_family: "undercut", table_ref: "Table 6.1",
    clause: "6.26.1.4", criteria_type: "dimensional",
    absolute_reject: false, loading: "cyclic",
    max_depth_mm: 0.25,
    note: "Max 0.25mm — bridge welds are fatigue-critical"
  },
  aws_d1_5__porosity: {
    code_key: "aws_d1_5", disc_family: "porosity", table_ref: "Table 6.1",
    clause: "6.26.1.6", criteria_type: "dimensional",
    absolute_reject: false, loading: "cyclic",
    max_individual_mm: 0.8,
    note: "Max pore 0.8mm for bridge welds"
  },

  // ============== AWS D1.6 Stainless ==============
  aws_d1_6__crack: {
    code_key: "aws_d1_6", disc_family: "crack", table_ref: "Table 8.1",
    clause: "8.15.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted"
  },
  aws_d1_6__incomplete_fusion: {
    code_key: "aws_d1_6", disc_family: "incomplete_fusion", table_ref: "Table 8.1",
    clause: "8.15.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion"
  },
  aws_d1_6__undercut: {
    code_key: "aws_d1_6", disc_family: "undercut", table_ref: "Table 8.1",
    clause: "8.15.1(4)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_depth_mm: 1.6,
    note: "Max 1.6mm static. Per D1.1 criteria adapted for stainless."
  },
  aws_d1_6__porosity: {
    code_key: "aws_d1_6", disc_family: "porosity", table_ref: "Table 8.1",
    clause: "8.15.1(6)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_individual_mm: 2.4,
    note: "Max 2.4mm individual pore — same as D1.1 static"
  },

  // ============== AWS D1.8 Seismic ==============
  aws_d1_8__crack: {
    code_key: "aws_d1_8", disc_family: "crack", table_ref: "Table 6.1",
    clause: "6.4.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "seismic",
    note: "No cracks in demand-critical welds"
  },
  aws_d1_8__incomplete_fusion: {
    code_key: "aws_d1_8", disc_family: "incomplete_fusion", table_ref: "Table 6.1",
    clause: "6.4.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "seismic",
    note: "No incomplete fusion in demand-critical welds"
  },
  aws_d1_8__undercut: {
    code_key: "aws_d1_8", disc_family: "undercut", table_ref: "Table 6.1",
    clause: "6.4.1(4)", criteria_type: "dimensional",
    absolute_reject: false, loading: "seismic",
    max_depth_mm: 0.25,
    note: "Max 0.25mm — seismic demand-critical connections"
  },
  aws_d1_8__porosity: {
    code_key: "aws_d1_8", disc_family: "porosity", table_ref: "Table 6.1",
    clause: "6.4.1(6)", criteria_type: "dimensional",
    absolute_reject: false, loading: "seismic",
    max_individual_mm: 0.8,
    note: "Max 0.8mm pore — seismic demand-critical"
  },

  // ============== ISO 5817 ==============
  iso_5817__crack: {
    code_key: "iso_5817", disc_family: "crack", table_ref: "Table 1 Ref 1.1",
    clause: "ISO 6520-1 Ref 100", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks at any quality level (B, C, D)"
  },
  iso_5817__undercut_B: {
    code_key: "iso_5817", disc_family: "undercut", table_ref: "Table 1 Ref 1.7",
    clause: "ISO 6520-1 Ref 5011/5012", criteria_type: "dimensional",
    absolute_reject: false, loading: "fatigue", quality_level: "B",
    max_depth_mm: 0.5,
    note: "Quality Level B (stringent): max 0.5mm"
  },
  iso_5817__undercut_C: {
    code_key: "iso_5817", disc_family: "undercut", table_ref: "Table 1 Ref 1.7",
    clause: "ISO 6520-1 Ref 5011/5012", criteria_type: "dimensional",
    absolute_reject: false, loading: "static", quality_level: "C",
    max_depth_mm: 0.5,
    max_depth_percent_t: 10,
    note: "Quality Level C (intermediate): max 0.5mm or 10% t whichever is greater for short lengths"
  },
  iso_5817__undercut_D: {
    code_key: "iso_5817", disc_family: "undercut", table_ref: "Table 1 Ref 1.7",
    clause: "ISO 6520-1 Ref 5011/5012", criteria_type: "dimensional",
    absolute_reject: false, loading: "static", quality_level: "D",
    max_depth_mm: 1.0,
    max_depth_percent_t: 10,
    note: "Quality Level D (moderate): max 1.0mm or 10% t"
  },
  iso_5817__porosity_B: {
    code_key: "iso_5817", disc_family: "porosity", table_ref: "Table 1 Ref 1.11",
    clause: "ISO 6520-1 Ref 2011", criteria_type: "dimensional",
    absolute_reject: false, loading: "fatigue", quality_level: "B",
    max_individual_percent_t: 1.5,
    max_individual_mm: 1.5,
    max_area_percent: 1,
    note: "Level B: max pore 1.5% of t (min 1.5mm), area max 1%"
  },
  iso_5817__porosity_C: {
    code_key: "iso_5817", disc_family: "porosity", table_ref: "Table 1 Ref 1.11",
    clause: "ISO 6520-1 Ref 2011", criteria_type: "dimensional",
    absolute_reject: false, loading: "static", quality_level: "C",
    max_individual_percent_t: 2.5,
    max_individual_mm: 3.0,
    max_area_percent: 2,
    note: "Level C: max pore 2.5% of t (min 3mm), area max 2%"
  },
  iso_5817__porosity_D: {
    code_key: "iso_5817", disc_family: "porosity", table_ref: "Table 1 Ref 1.11",
    clause: "ISO 6520-1 Ref 2011", criteria_type: "dimensional",
    absolute_reject: false, loading: "static", quality_level: "D",
    max_individual_percent_t: 4,
    max_individual_mm: 5.0,
    max_area_percent: 4,
    note: "Level D: max pore 4% of t (min 5mm), area max 4%"
  },
  iso_5817__incomplete_fusion: {
    code_key: "iso_5817", disc_family: "incomplete_fusion", table_ref: "Table 1 Ref 1.5",
    clause: "ISO 6520-1 Ref 401", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No incomplete fusion at quality levels B and C. Short imperfections allowed at D."
  },
  iso_5817__excess_reinforcement_B: {
    code_key: "iso_5817", disc_family: "reinforcement", table_ref: "Table 1 Ref 1.12",
    clause: "ISO 6520-1 Ref 502", criteria_type: "dimensional",
    absolute_reject: false, loading: "fatigue", quality_level: "B",
    max_reinforcement_mm_plus_percent: "1mm + 10% weld width",
    max_cap_mm: 3.0,
    note: "Level B: 1mm + 10% of b, max 3mm total"
  },

  // ============== AWS D1.2 Aluminum ==============
  aws_d1_2__crack: {
    code_key: "aws_d1_2", disc_family: "crack", table_ref: "Table 8.1",
    clause: "8.15.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted in aluminum welds"
  },
  aws_d1_2__undercut: {
    code_key: "aws_d1_2", disc_family: "undercut", table_ref: "Table 8.1",
    clause: "8.15.1(4)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_depth_mm: 0.8,
    note: "Max 0.8mm undercut — aluminum is more sensitive to notch effects"
  },
  aws_d1_2__porosity: {
    code_key: "aws_d1_2", disc_family: "porosity", table_ref: "Table 8.1",
    clause: "8.15.1(6)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_individual_mm: 2.4,
    note: "Max 2.4mm individual pore. Note: porosity more common in aluminum."
  },

  // ============== AWS D1.3 Sheet Steel ==============
  aws_d1_3__crack: {
    code_key: "aws_d1_3", disc_family: "crack", table_ref: "Table 7.1",
    clause: "7.6.1", criteria_type: "zero_tolerance",
    absolute_reject: true, loading: "all",
    note: "No cracks permitted"
  },
  aws_d1_3__burn_through: {
    code_key: "aws_d1_3", disc_family: "burn_through", table_ref: "Table 7.1",
    clause: "7.6.1(4)", criteria_type: "dimensional",
    absolute_reject: false, loading: "static",
    max_dimension_mm: null,
    note: "Burn-through in sheet steel shall be repaired per qualified procedure"
  }
};


// ================================================================
// DISCONTINUITY DATABASE — 65+ types organized by ISO 6520 taxonomy
// ================================================================

var DISCONTINUITY_DB = {
  // === CRACKS (ISO 6520: 100-series) — Tier 1 dominance, always reject ===
  longitudinal_crack: { iso: "1011", family: "crack", name: "Longitudinal Crack", tier: 1, planar: true, desc: "Crack parallel to weld axis" },
  transverse_crack: { iso: "1021", family: "crack", name: "Transverse Crack", tier: 1, planar: true, desc: "Crack perpendicular to weld axis" },
  crater_crack: { iso: "104", family: "crack", name: "Crater Crack (Star Crack)", tier: 1, planar: true, desc: "Crack in weld crater from shrinkage" },
  toe_crack: { iso: "1012/1022", family: "crack", name: "Toe Crack", tier: 1, planar: true, desc: "Crack at weld toe in HAZ" },
  root_crack: { iso: "1013/1023", family: "crack", name: "Root Crack", tier: 1, planar: true, desc: "Crack at weld root" },
  underbead_crack: { iso: "1014", family: "crack", name: "Underbead Crack", tier: 1, planar: true, desc: "HAZ crack beneath weld bead" },
  hot_crack: { iso: "100", family: "crack", name: "Hot Crack (Solidification Crack)", tier: 1, planar: true, desc: "Formed during solidification above solidus" },
  cold_crack: { iso: "100", family: "crack", name: "Cold Crack (Hydrogen-Induced)", tier: 1, planar: true, desc: "Delayed cracking from hydrogen + stress + microstructure" },
  lamellar_tear: { iso: "100", family: "crack", name: "Lamellar Tear", tier: 1, planar: true, desc: "Through-thickness tearing from sulfide inclusions in base metal" },
  stress_corrosion_crack: { iso: "100", family: "crack", name: "Stress Corrosion Crack", tier: 1, planar: true, desc: "In-service cracking from environment + stress" },
  fatigue_crack: { iso: "100", family: "crack", name: "Fatigue Crack", tier: 1, planar: true, desc: "In-service cracking from cyclic loading" },
  reheat_crack: { iso: "100", family: "crack", name: "Reheat Crack (Stress Relief Crack)", tier: 1, planar: true, desc: "During PWHT in Cr-Mo-V steels" },
  hydrogen_crack: { iso: "100", family: "crack", name: "Hydrogen-Induced Crack", tier: 1, planar: true, desc: "HIC from atomic hydrogen in susceptible microstructure" },
  liquation_crack: { iso: "100", family: "crack", name: "Liquation Crack (HAZ Hot Crack)", tier: 1, planar: true, desc: "Grain boundary melting in HAZ" },
  chevron_crack: { iso: "100", family: "crack", name: "Chevron Crack", tier: 1, planar: true, desc: "V-shaped hydrogen crack pattern in SAW welds" },

  // === FUSION DEFECTS (ISO 6520: 400-series) — Tier 2 ===
  incomplete_fusion: { iso: "401", family: "incomplete_fusion", name: "Incomplete Fusion (LOF)", tier: 2, planar: true, desc: "Lack of fusion between weld and base metal or between passes" },
  incomplete_fusion_root: { iso: "4011", family: "incomplete_fusion", name: "Incomplete Root Fusion", tier: 2, planar: true, desc: "LOF at root of joint" },
  incomplete_fusion_sidewall: { iso: "4012", family: "incomplete_fusion", name: "Incomplete Sidewall Fusion", tier: 2, planar: true, desc: "LOF at groove face" },
  incomplete_fusion_interpass: { iso: "4013", family: "incomplete_fusion", name: "Incomplete Interpass Fusion", tier: 2, planar: true, desc: "LOF between weld passes" },
  incomplete_penetration: { iso: "402", family: "incomplete_penetration", name: "Incomplete Penetration (LOP)", tier: 2, planar: true, desc: "Root not fully penetrated in CJP weld" },
  incomplete_penetration_partial: { iso: "4021", family: "incomplete_penetration", name: "Partial Penetration", tier: 2, planar: true, desc: "Partial fusion at root — not through full joint thickness" },

  // === POROSITY (ISO 6520: 200-series) — Tier 3 ===
  porosity_scattered: { iso: "2011", family: "porosity", name: "Scattered Porosity", tier: 3, planar: false, desc: "Randomly distributed gas pores" },
  porosity_cluster: { iso: "2013", family: "porosity", name: "Cluster Porosity", tier: 3, planar: false, desc: "Localized group of gas pores" },
  porosity_linear: { iso: "2014", family: "porosity", name: "Linear Porosity", tier: 3, planar: false, desc: "Pores aligned along weld axis — indicates gas path" },
  porosity_piping: { iso: "2016", family: "porosity", name: "Piping Porosity (Wormhole)", tier: 3, planar: false, desc: "Elongated tubular gas cavity" },
  porosity_surface: { iso: "2017", family: "porosity", name: "Surface Porosity", tier: 3, planar: false, desc: "Gas pore open to weld surface" },

  // === INCLUSIONS (ISO 6520: 300-series) — Tier 3 ===
  slag_inclusion: { iso: "301", family: "inclusion", name: "Slag Inclusion", tier: 3, planar: false, desc: "Entrapped slag between passes or at root" },
  tungsten_inclusion: { iso: "3041", family: "inclusion", name: "Tungsten Inclusion", tier: 3, planar: false, desc: "Embedded tungsten from GTAW electrode contact" },
  oxide_inclusion: { iso: "303", family: "inclusion", name: "Oxide Inclusion", tier: 3, planar: false, desc: "Entrapped oxide film — common in aluminum" },
  flux_inclusion: { iso: "302", family: "inclusion", name: "Flux Inclusion", tier: 3, planar: false, desc: "Entrapped flux material" },
  metallic_inclusion: { iso: "304", family: "inclusion", name: "Metallic Inclusion", tier: 3, planar: false, desc: "Foreign metallic particle in weld" },

  // === SURFACE DISCONTINUITIES — Tier 3-4 ===
  undercut: { iso: "5011", family: "undercut", name: "Undercut", tier: 3, planar: false, desc: "Groove melted at weld toe, unfilled by weld metal" },
  undercut_root: { iso: "5013", family: "undercut", name: "Root Undercut", tier: 3, planar: false, desc: "Undercut at root side" },
  overlap: { iso: "506", family: "overlap", name: "Overlap (Cold Lap)", tier: 3, planar: false, desc: "Weld metal flows over base metal without fusion" },
  burn_through: { iso: "510", family: "burn_through", name: "Burn-Through (Melt-Through)", tier: 3, planar: false, desc: "Excessive penetration causing hole or depression" },
  arc_strike: { iso: "601", family: "arc_strike", name: "Arc Strike", tier: 4, planar: false, desc: "Localized melting from accidental arc contact" },
  spatter: { iso: "602", family: "spatter", name: "Spatter", tier: 4, planar: false, desc: "Metal droplets expelled during welding" },
  grinding_mark: { iso: "N/A", family: "surface", name: "Grinding Mark (Mechanical Damage)", tier: 4, planar: false, desc: "Surface removal from improper grinding" },
  chisel_mark: { iso: "N/A", family: "surface", name: "Chisel Mark / Gouge", tier: 4, planar: false, desc: "Mechanical surface damage from chipping" },
  torn_surface: { iso: "N/A", family: "surface", name: "Torn Surface (Tack Weld Removal)", tier: 4, planar: false, desc: "Surface tearing from poor tack removal" },
  undersize_fillet: { iso: "5213", family: "undersize", name: "Undersize Fillet Weld", tier: 4, planar: false, desc: "Leg size below specified minimum" },
  excessive_convexity: { iso: "503", family: "convexity", name: "Excessive Convexity", tier: 4, planar: false, desc: "Fillet weld face too convex" },
  excessive_concavity: { iso: "515", family: "concavity", name: "Excessive Concavity", tier: 4, planar: false, desc: "Fillet weld face too concave — reduces throat" },
  excessive_reinforcement: { iso: "502", family: "reinforcement", name: "Excessive Reinforcement", tier: 4, planar: false, desc: "Crown height above flush exceeds limit" },
  insufficient_throat: { iso: "5213", family: "undersize", name: "Insufficient Throat", tier: 4, planar: false, desc: "Effective throat below design requirement" },
  misalignment: { iso: "507", family: "misalignment", name: "Misalignment (Hi-Lo)", tier: 4, planar: false, desc: "Offset between adjoining members" },

  // === DIMENSIONAL — Tier 4 ===
  angular_distortion: { iso: "521", family: "distortion", name: "Angular Distortion", tier: 4, planar: false, desc: "Rotation of members about weld axis" },
  linear_misalignment: { iso: "507", family: "misalignment", name: "Linear Misalignment", tier: 4, planar: false, desc: "Offset between members at joint" },

  // === METALLURGICAL — Tier 3-4 ===
  sensitization: { iso: "N/A", family: "metallurgical", name: "Sensitization (Chromium Depletion)", tier: 3, planar: false, desc: "Grain boundary carbide precipitation in austenitic SS (>425C)" },
  sigma_phase: { iso: "N/A", family: "metallurgical", name: "Sigma Phase Embrittlement", tier: 3, planar: false, desc: "Brittle sigma phase in duplex/austenitic SS (650-900C)" },
  grain_coarsening: { iso: "N/A", family: "metallurgical", name: "HAZ Grain Coarsening", tier: 4, planar: false, desc: "Excessive grain growth from high heat input" },
  martensite_formation: { iso: "N/A", family: "metallurgical", name: "Untempered Martensite", tier: 3, planar: false, desc: "Hard brittle phase from rapid cooling in hardenable steels" },
  hydrogen_embrittlement: { iso: "N/A", family: "metallurgical", name: "Hydrogen Embrittlement", tier: 2, planar: false, desc: "Loss of ductility from dissolved hydrogen" },
  temper_embrittlement: { iso: "N/A", family: "metallurgical", name: "Temper Embrittlement", tier: 3, planar: false, desc: "DBTT shift from P, Sn, Sb, As segregation during slow cooling 375-575C" },
  creep_damage: { iso: "N/A", family: "metallurgical", name: "Creep Damage (Type IV)", tier: 2, planar: false, desc: "Time-dependent deformation in HAZ at elevated temperature" }
};


// ================================================================
// MATERIAL DATABASE — 15 families with weldability data
// ================================================================

var MATERIAL_DB = {
  carbon_steel: {
    key: "carbon_steel", name: "Carbon Steel", group: "CS", p_number: "P1",
    weldability: "good", ce_range: "0.20-0.45",
    hydrogen_sensitive: false, preheat_likely: false,
    cracking_risk: "low_to_moderate",
    typical_codes: ["aws_d1_1", "api_1104", "asme_viii"],
    concerns: ["Lamellar tearing if high sulfur", "HAZ hardening if CE > 0.40"]
  },
  low_alloy: {
    key: "low_alloy", name: "Low-Alloy Steel (Cr-Mo)", group: "LA", p_number: "P4/P5",
    weldability: "moderate", ce_range: "0.35-0.65",
    hydrogen_sensitive: true, preheat_likely: true,
    cracking_risk: "moderate_to_high",
    typical_codes: ["asme_viii", "asme_b31_1", "asme_b31_3"],
    concerns: ["Hydrogen cracking", "Reheat cracking during PWHT", "Temper embrittlement"]
  },
  hsla: {
    key: "hsla", name: "High-Strength Low-Alloy Steel", group: "HSLA", p_number: "P1/P3",
    weldability: "moderate", ce_range: "0.30-0.50",
    hydrogen_sensitive: true, preheat_likely: true,
    cracking_risk: "moderate",
    typical_codes: ["aws_d1_1", "aws_d1_5", "api_1104"],
    concerns: ["HAZ softening", "Hydrogen cracking", "Toughness loss in HAZ"]
  },
  quenched_tempered: {
    key: "quenched_tempered", name: "Quenched & Tempered Steel", group: "QT", p_number: "P11",
    weldability: "difficult", ce_range: "0.40-0.65",
    hydrogen_sensitive: true, preheat_likely: true,
    cracking_risk: "high",
    typical_codes: ["aws_d1_1", "aws_d1_5"],
    concerns: ["HAZ softening", "Max heat input limits", "Max interpass limits", "Hydrogen cracking"]
  },
  weathering_steel: {
    key: "weathering_steel", name: "Weathering Steel (Corten)", group: "WS", p_number: "P1",
    weldability: "good", ce_range: "0.25-0.45",
    hydrogen_sensitive: false, preheat_likely: false,
    cracking_risk: "low",
    typical_codes: ["aws_d1_1", "aws_d1_5"],
    concerns: ["Matching filler for corrosion resistance", "Avoid copper contamination"]
  },
  austenitic_ss: {
    key: "austenitic_ss", name: "Austenitic Stainless Steel (304/316)", group: "ASS", p_number: "P8",
    weldability: "good", ce_range: "N/A",
    hydrogen_sensitive: false, preheat_likely: false,
    cracking_risk: "low_solidification",
    typical_codes: ["aws_d1_6", "asme_viii", "asme_b31_3"],
    concerns: ["Sensitization (IGC)", "Hot cracking", "Distortion", "Delta ferrite control"]
  },
  ferritic_ss: {
    key: "ferritic_ss", name: "Ferritic Stainless Steel (409/430)", group: "FSS", p_number: "P7",
    weldability: "moderate", ce_range: "N/A",
    hydrogen_sensitive: false, preheat_likely: true,
    cracking_risk: "moderate",
    typical_codes: ["aws_d1_6", "asme_viii"],
    concerns: ["Grain coarsening", "475C embrittlement", "Toughness loss", "Limited ductility"]
  },
  martensitic_ss: {
    key: "martensitic_ss", name: "Martensitic Stainless Steel (410/420)", group: "MSS", p_number: "P6",
    weldability: "difficult", ce_range: "N/A",
    hydrogen_sensitive: true, preheat_likely: true,
    cracking_risk: "high",
    typical_codes: ["aws_d1_6", "asme_viii"],
    concerns: ["Hydrogen cracking", "Hard HAZ", "PWHT required", "Preheat 200-300C"]
  },
  duplex_ss: {
    key: "duplex_ss", name: "Duplex Stainless Steel (2205/2507)", group: "DSS", p_number: "P10H",
    weldability: "moderate", ce_range: "N/A",
    hydrogen_sensitive: true, preheat_likely: false,
    cracking_risk: "moderate",
    typical_codes: ["aws_d1_6", "asme_viii", "asme_b31_3"],
    concerns: ["Sigma phase", "475C embrittlement", "Ferrite/austenite balance", "Max heat input", "No PWHT typically"]
  },
  aluminum: {
    key: "aluminum", name: "Aluminum Alloys (5xxx/6xxx)", group: "AL", p_number: "P21-P25",
    weldability: "moderate", ce_range: "N/A",
    hydrogen_sensitive: false, preheat_likely: false,
    cracking_risk: "moderate_hot",
    typical_codes: ["aws_d1_2"],
    concerns: ["Hot cracking", "Porosity from hydrogen", "HAZ softening", "Oxide removal critical"]
  },
  nickel_alloy: {
    key: "nickel_alloy", name: "Nickel Alloys (Inconel/Monel)", group: "NI", p_number: "P41-P49",
    weldability: "moderate", ce_range: "N/A",
    hydrogen_sensitive: false, preheat_likely: false,
    cracking_risk: "moderate_hot",
    typical_codes: ["asme_viii", "asme_b31_3"],
    concerns: ["Hot cracking", "DDC (ductility dip cracking)", "Porosity", "Cleanliness critical"]
  },
  titanium: {
    key: "titanium", name: "Titanium Alloys (CP/Ti-6Al-4V)", group: "TI", p_number: "P51-P53",
    weldability: "good_if_shielded", ce_range: "N/A",
    hydrogen_sensitive: true, preheat_likely: false,
    cracking_risk: "low_if_clean",
    typical_codes: ["asme_viii", "asme_b31_3"],
    concerns: ["Contamination from oxygen/nitrogen", "Trailing gas shield required", "Color indicates contamination"]
  },
  copper_alloy: {
    key: "copper_alloy", name: "Copper Alloys (Bronze/Brass)", group: "CU", p_number: "P31-P35",
    weldability: "moderate", ce_range: "N/A",
    hydrogen_sensitive: false, preheat_likely: true,
    cracking_risk: "moderate_hot",
    typical_codes: ["asme_viii"],
    concerns: ["Hot cracking", "High thermal conductivity", "Zinc fume (brass)", "Preheat for thick sections"]
  },
  cast_steel: {
    key: "cast_steel", name: "Cast Steel", group: "CAST", p_number: "P1",
    weldability: "moderate", ce_range: "0.30-0.55",
    hydrogen_sensitive: true, preheat_likely: true,
    cracking_risk: "moderate_to_high",
    typical_codes: ["aws_d1_1", "asme_viii"],
    concerns: ["Porosity from casting", "High CE", "Segregation", "Preheat and PWHT typical"]
  },
  cobalt_alloy: {
    key: "cobalt_alloy", name: "Cobalt Alloys (Stellite)", group: "CO", p_number: "N/A",
    weldability: "difficult", ce_range: "N/A",
    hydrogen_sensitive: false, preheat_likely: true,
    cracking_risk: "high",
    typical_codes: ["asme_viii"],
    concerns: ["Hot cracking", "Thermal fatigue", "Typically hardfacing overlay only"]
  }
};


// ================================================================
// WELDING PROCESS DATABASE — 15 processes with physics
// ================================================================

var PROCESS_DB = {
  smaw: {
    key: "smaw", name: "SMAW (Shielded Metal Arc Welding / Stick)", aws_code: "SMAW",
    heat_input_range_kj_mm: "0.5-3.5",
    hydrogen_risk: "moderate_to_high",
    typical_defects: ["porosity_scattered", "slag_inclusion", "undercut", "incomplete_fusion", "arc_strike"],
    shielding: "Flux coating decomposition",
    position_capable: "All positions",
    typical_materials: ["carbon_steel", "low_alloy", "stainless"],
    physics: "Arc between consumable flux-coated electrode and workpiece. Flux provides shielding gas and slag."
  },
  gmaw: {
    key: "gmaw", name: "GMAW (Gas Metal Arc Welding / MIG)", aws_code: "GMAW",
    heat_input_range_kj_mm: "0.3-2.5",
    hydrogen_risk: "low",
    typical_defects: ["porosity_scattered", "incomplete_fusion", "burn_through", "spatter"],
    shielding: "External gas (Ar, CO2, mixed)",
    position_capable: "All positions (short-circuit for vertical/overhead)",
    typical_materials: ["carbon_steel", "aluminum", "stainless"],
    physics: "Arc between continuous solid wire and workpiece. Gas shield from external supply."
  },
  fcaw: {
    key: "fcaw", name: "FCAW (Flux-Cored Arc Welding)", aws_code: "FCAW",
    heat_input_range_kj_mm: "0.5-3.0",
    hydrogen_risk: "low_to_moderate",
    typical_defects: ["slag_inclusion", "porosity_piping", "incomplete_fusion", "excessive_convexity"],
    shielding: "Flux core + optional external gas",
    position_capable: "All positions",
    typical_materials: ["carbon_steel", "low_alloy"],
    physics: "Arc between continuous flux-cored wire and workpiece. Self-shielded or gas-shielded variants."
  },
  gtaw: {
    key: "gtaw", name: "GTAW (Gas Tungsten Arc Welding / TIG)", aws_code: "GTAW",
    heat_input_range_kj_mm: "0.2-2.0",
    hydrogen_risk: "very_low",
    typical_defects: ["tungsten_inclusion", "porosity_scattered", "incomplete_penetration", "undercut"],
    shielding: "External inert gas (Ar, He)",
    position_capable: "All positions",
    typical_materials: ["stainless", "titanium", "nickel_alloy", "aluminum", "carbon_steel"],
    physics: "Arc between non-consumable tungsten electrode and workpiece. Cleanest process."
  },
  saw: {
    key: "saw", name: "SAW (Submerged Arc Welding)", aws_code: "SAW",
    heat_input_range_kj_mm: "1.0-10.0",
    hydrogen_risk: "low",
    typical_defects: ["slag_inclusion", "chevron_crack", "porosity_scattered", "incomplete_penetration"],
    shielding: "Granular flux blanket",
    position_capable: "Flat and horizontal only",
    typical_materials: ["carbon_steel", "low_alloy", "stainless"],
    physics: "Arc buried under granular flux. Very high deposition rates. Deep penetration."
  },
  paw: {
    key: "paw", name: "PAW (Plasma Arc Welding)", aws_code: "PAW",
    heat_input_range_kj_mm: "0.1-3.0",
    hydrogen_risk: "very_low",
    typical_defects: ["porosity_scattered", "undercut", "tungsten_inclusion"],
    shielding: "Orifice gas + shielding gas (Ar)",
    position_capable: "All positions",
    typical_materials: ["stainless", "titanium", "nickel_alloy"],
    physics: "Constricted arc through orifice. Keyhole mode for full penetration without backing."
  },
  esw: {
    key: "esw", name: "ESW (Electroslag Welding)", aws_code: "ESW",
    heat_input_range_kj_mm: "50-150",
    hydrogen_risk: "low",
    typical_defects: ["grain_coarsening", "incomplete_fusion", "hot_crack"],
    shielding: "Molten slag pool",
    position_capable: "Vertical up only",
    typical_materials: ["carbon_steel", "low_alloy"],
    physics: "Resistance heating through molten slag pool. Very high heat input — single pass."
  },
  egw: {
    key: "egw", name: "EGW (Electrogas Welding)", aws_code: "EGW",
    heat_input_range_kj_mm: "15-50",
    hydrogen_risk: "low",
    typical_defects: ["grain_coarsening", "porosity_scattered", "incomplete_fusion"],
    shielding: "External gas + optional flux core",
    position_capable: "Vertical up only",
    typical_materials: ["carbon_steel"],
    physics: "Vertical single-pass process with copper dam. High heat input."
  },
  stud: {
    key: "stud", name: "Stud Welding (SW)", aws_code: "SW",
    heat_input_range_kj_mm: "0.01-0.5",
    hydrogen_risk: "low",
    typical_defects: ["incomplete_fusion", "porosity_scattered"],
    shielding: "Ceramic ferrule or gas",
    position_capable: "All positions",
    typical_materials: ["carbon_steel"],
    physics: "Arc drawn between stud and plate, stud plunged into molten pool."
  },
  ofw: {
    key: "ofw", name: "OFW (Oxyfuel Welding)", aws_code: "OFW",
    heat_input_range_kj_mm: "0.5-3.0",
    hydrogen_risk: "moderate",
    typical_defects: ["porosity_scattered", "oxide_inclusion", "incomplete_fusion", "excessive_reinforcement"],
    shielding: "Flame envelope",
    position_capable: "All positions",
    typical_materials: ["carbon_steel", "copper_alloy"],
    physics: "Combustion of fuel gas + oxygen. Low intensity heat source."
  },
  rsw: {
    key: "rsw", name: "RSW (Resistance Spot Welding)", aws_code: "RSW",
    heat_input_range_kj_mm: "N/A",
    hydrogen_risk: "none",
    typical_defects: ["expulsion", "insufficient_nugget", "surface_indent"],
    shielding: "None required",
    position_capable: "Lap joints only",
    typical_materials: ["carbon_steel", "stainless", "aluminum"],
    physics: "Resistance heating from current flow between electrodes through lap joint."
  },
  frw: {
    key: "frw", name: "FRW (Friction Welding)", aws_code: "FRW",
    heat_input_range_kj_mm: "N/A",
    hydrogen_risk: "none",
    typical_defects: ["incomplete_fusion", "flash_defects"],
    shielding: "None required",
    position_capable: "Axial joints",
    typical_materials: ["carbon_steel", "stainless", "aluminum", "titanium", "dissimilar"],
    physics: "Frictional heat from relative motion under pressure. Solid-state process."
  },
  fsw: {
    key: "fsw", name: "FSW (Friction Stir Welding)", aws_code: "FSW",
    heat_input_range_kj_mm: "0.5-2.0",
    hydrogen_risk: "none",
    typical_defects: ["root_flaw", "wormhole", "incomplete_penetration"],
    shielding: "None required",
    position_capable: "Flat primarily",
    typical_materials: ["aluminum", "copper_alloy"],
    physics: "Rotating non-consumable tool generates frictional heat. Solid-state — no melting."
  },
  lbw: {
    key: "lbw", name: "LBW (Laser Beam Welding)", aws_code: "LBW",
    heat_input_range_kj_mm: "0.01-0.5",
    hydrogen_risk: "very_low",
    typical_defects: ["porosity_scattered", "undercut", "incomplete_penetration", "hot_crack"],
    shielding: "Inert gas cover",
    position_capable: "All positions (robotic)",
    typical_materials: ["carbon_steel", "stainless", "titanium"],
    physics: "Focused coherent light beam. Very high power density, narrow HAZ, deep penetration."
  },
  ebw: {
    key: "ebw", name: "EBW (Electron Beam Welding)", aws_code: "EBW",
    heat_input_range_kj_mm: "0.01-0.3",
    hydrogen_risk: "none",
    typical_defects: ["porosity_scattered", "incomplete_penetration", "hot_crack"],
    shielding: "Vacuum chamber",
    position_capable: "All (in vacuum)",
    typical_materials: ["titanium", "nickel_alloy", "stainless", "refractory"],
    physics: "Focused electron beam in vacuum. Highest power density. Deepest penetration."
  }
};


// ================================================================
// JOINT CONFIGURATION DATABASE — 18 types
// ================================================================

var JOINT_DB = {
  butt_v_single: { key: "butt_v_single", name: "Single-V Butt", category: "butt", penetration: "CJP", bevel_angle: "60-70 deg included", root_gap_mm: "2-3", root_face_mm: "0-2", backing: "optional" },
  butt_v_double: { key: "butt_v_double", name: "Double-V Butt", category: "butt", penetration: "CJP", bevel_angle: "60-70 deg each side", root_gap_mm: "2-3", root_face_mm: "0-3", backing: "none" },
  butt_j_single: { key: "butt_j_single", name: "Single-J Butt", category: "butt", penetration: "CJP", bevel_angle: "20-25 deg J-groove", root_gap_mm: "2-3", root_face_mm: "1-3", backing: "optional" },
  butt_u_single: { key: "butt_u_single", name: "Single-U Butt", category: "butt", penetration: "CJP", bevel_angle: "20 deg U-groove", root_gap_mm: "2-3", root_face_mm: "1-3", backing: "optional" },
  butt_square: { key: "butt_square", name: "Square Butt", category: "butt", penetration: "CJP_thin", bevel_angle: "0 (square)", root_gap_mm: "0-3", root_face_mm: "full thickness", backing: "optional" },
  butt_bevel_single: { key: "butt_bevel_single", name: "Single-Bevel Butt", category: "butt", penetration: "CJP", bevel_angle: "45 deg single bevel", root_gap_mm: "2-3", root_face_mm: "0-2", backing: "optional" },
  fillet_tee: { key: "fillet_tee", name: "Fillet Weld - Tee Joint", category: "fillet", penetration: "PJP", bevel_angle: "N/A", root_gap_mm: "0-2", root_face_mm: "N/A", backing: "N/A" },
  fillet_lap: { key: "fillet_lap", name: "Fillet Weld - Lap Joint", category: "fillet", penetration: "PJP", bevel_angle: "N/A", root_gap_mm: "0", root_face_mm: "N/A", backing: "N/A" },
  fillet_corner: { key: "fillet_corner", name: "Fillet Weld - Corner Joint", category: "fillet", penetration: "PJP", bevel_angle: "N/A", root_gap_mm: "0-2", root_face_mm: "N/A", backing: "N/A" },
  pjp_tee_bevel: { key: "pjp_tee_bevel", name: "PJP Bevel - Tee Joint", category: "groove_pjp", penetration: "PJP", bevel_angle: "45 deg", root_gap_mm: "0-2", root_face_mm: "3-6", backing: "N/A" },
  cjp_tee_bevel: { key: "cjp_tee_bevel", name: "CJP Bevel - Tee Joint", category: "groove_cjp", penetration: "CJP", bevel_angle: "45 deg", root_gap_mm: "2-3", root_face_mm: "0-2", backing: "optional" },
  pipe_butt_v: { key: "pipe_butt_v", name: "Pipe Butt - V-Groove", category: "pipe", penetration: "CJP", bevel_angle: "60-75 deg", root_gap_mm: "1.6-3.2", root_face_mm: "1.6", backing: "consumable insert or open root" },
  pipe_butt_compound: { key: "pipe_butt_compound", name: "Pipe Butt - Compound Bevel", category: "pipe", penetration: "CJP", bevel_angle: "37.5 + 10 deg compound", root_gap_mm: "1.6", root_face_mm: "1.6", backing: "none" },
  branch_connection: { key: "branch_connection", name: "Branch Connection (Set-On)", category: "pipe", penetration: "CJP_or_PJP", bevel_angle: "varies with angle", root_gap_mm: "2-3", root_face_mm: "0-2", backing: "N/A" },
  socket_weld: { key: "socket_weld", name: "Socket Weld", category: "pipe", penetration: "fillet", bevel_angle: "N/A", root_gap_mm: "1.6 gap per code", root_face_mm: "N/A", backing: "N/A" },
  plug_weld: { key: "plug_weld", name: "Plug Weld", category: "other", penetration: "varies", bevel_angle: "N/A", root_gap_mm: "N/A", root_face_mm: "N/A", backing: "N/A" },
  slot_weld: { key: "slot_weld", name: "Slot Weld", category: "other", penetration: "varies", bevel_angle: "N/A", root_gap_mm: "N/A", root_face_mm: "N/A", backing: "N/A" },
  flare_bevel: { key: "flare_bevel", name: "Flare-Bevel Groove", category: "other", penetration: "PJP", bevel_angle: "curved surface", root_gap_mm: "0", root_face_mm: "N/A", backing: "N/A" }
};


// ================================================================
// SERVICE CONDITION MODIFIERS — tighten acceptance limits
// ================================================================

var SERVICE_CONDITIONS = {
  sour_service: {
    key: "sour_service", name: "Sour Service (H2S)",
    standard: "NACE MR0175 / ISO 15156",
    max_hardness_hv: 248,
    max_hardness_hrc: 22,
    severity_multiplier: 0.5,
    restrictions: [
      "Max hardness 248 HV10 (22 HRC) in weld and HAZ",
      "PWHT mandatory for carbon and low-alloy steels",
      "No hard spots from arc strikes",
      "Microhardness survey required"
    ],
    disc_modifiers: {
      crack: "absolute_reject",
      arc_strike: "reject_if_not_ground_and_tested",
      martensite_formation: "reject_unless_tempered"
    }
  },
  cryogenic: {
    key: "cryogenic", name: "Cryogenic Service (< -45C)",
    standard: "ASME VIII UCS-66 / EN 13445",
    severity_multiplier: 0.7,
    restrictions: [
      "Charpy impact testing at MDMT required",
      "Low-carbon or austenitic materials preferred",
      "Reduced acceptance limits for planar discontinuities",
      "Notch toughness verification mandatory"
    ],
    disc_modifiers: {
      undercut: "reduce_limit_30_percent",
      incomplete_fusion: "absolute_reject",
      incomplete_penetration: "absolute_reject"
    }
  },
  high_temp: {
    key: "high_temp", name: "High Temperature Service (> 425C)",
    standard: "ASME VIII UCS-66 / API 579",
    severity_multiplier: 0.8,
    restrictions: [
      "Creep-strength considerations",
      "Sensitization risk for austenitic SS",
      "Sigma phase risk for duplex SS",
      "Temper embrittlement risk for Cr-Mo steels"
    ],
    disc_modifiers: {
      sensitization: "reject_if_austenitic",
      creep_damage: "reject"
    }
  },
  cyclic_high: {
    key: "cyclic_high", name: "High Cycle Fatigue (> 20,000 cycles)",
    standard: "AWS D1.1 Table 2.4 / BS 7608",
    severity_multiplier: 0.5,
    restrictions: [
      "Use cyclic loading acceptance criteria throughout",
      "Undercut max 0.25mm regardless of code",
      "All toe geometry improvements considered",
      "Planar discontinuities not permitted"
    ],
    disc_modifiers: {
      undercut: "max_0.25mm",
      incomplete_fusion: "absolute_reject",
      incomplete_penetration: "absolute_reject",
      overlap: "absolute_reject"
    }
  },
  cyclic_low_seismic: {
    key: "cyclic_low_seismic", name: "Low Cycle / Seismic (< 20,000 cycles, high strain)",
    standard: "AWS D1.8 / AISC 341",
    severity_multiplier: 0.6,
    restrictions: [
      "Demand-critical connection criteria",
      "Charpy V-notch testing at 0F (-18C)",
      "CVN 27J minimum",
      "Weld access hole geometry per AISC"
    ],
    disc_modifiers: {
      undercut: "max_0.25mm",
      crack: "absolute_reject",
      incomplete_fusion: "absolute_reject"
    }
  },
  lethal_service: {
    key: "lethal_service", name: "Lethal Service",
    standard: "ASME VIII UW-2(a)",
    severity_multiplier: 0.5,
    restrictions: [
      "100% RT or UT examination mandatory",
      "All butt welds shall be CJP",
      "No PJP joints in pressure boundary",
      "Full PWHT required per UCS-56",
      "Tightest acceptance criteria apply"
    ],
    disc_modifiers: {
      incomplete_penetration: "absolute_reject",
      incomplete_fusion: "absolute_reject",
      porosity: "reduce_limit_50_percent"
    }
  },
  hydrogen_service: {
    key: "hydrogen_service", name: "Hydrogen Service",
    standard: "API 941 (Nelson Curves) / API RP 934-A",
    severity_multiplier: 0.6,
    restrictions: [
      "HTHA risk assessment required",
      "Max hardness 200 HBW",
      "PWHT mandatory",
      "Low hydrogen welding mandatory (< 4 ml/100g)",
      "Cr-Mo materials per API 934-A"
    ],
    disc_modifiers: {
      crack: "absolute_reject",
      hydrogen_embrittlement: "reject",
      arc_strike: "reject"
    }
  }
};


// ================================================================
// DAMAGE PROGRESSION MODELS — time-forward failure projections
// ================================================================

var DAMAGE_MODELS = {
  fatigue_growth: {
    key: "fatigue_growth", name: "Fatigue Crack Growth",
    equation: "da/dN = C * (delta_K)^m (Paris Law)",
    applicable_discs: ["toe_crack", "root_crack", "fatigue_crack", "undercut"],
    inputs: ["initial_flaw_size", "stress_range", "cycles_per_year", "material_constants"],
    output: "Remaining cycles to critical flaw size",
    severity: "progressive",
    note: "Growth rate accelerates as flaw grows. Undercut acts as stress raiser initiating fatigue."
  },
  hydrogen_delayed: {
    key: "hydrogen_delayed", name: "Hydrogen Delayed Cracking",
    equation: "Incubation time model: t_f = f(K, C_H, T, hardness)",
    applicable_discs: ["cold_crack", "hydrogen_crack", "underbead_crack"],
    inputs: ["hydrogen_content", "stress_intensity", "hardness", "temperature"],
    output: "Time to crack initiation (hours to days)",
    severity: "catastrophic_delayed",
    note: "Can occur 24-72 hours after welding. Higher risk with high CE, high restraint, low preheat."
  },
  scc_progression: {
    key: "scc_progression", name: "Stress Corrosion Cracking",
    equation: "Threshold: K_ISCC < K_applied for susceptible material+environment",
    applicable_discs: ["stress_corrosion_crack", "sensitization"],
    inputs: ["material", "environment", "stress_level", "temperature"],
    output: "Susceptibility rating and estimated time to failure",
    severity: "catastrophic",
    note: "Requires simultaneous: susceptible material + corrosive environment + tensile stress."
  },
  lof_fatigue_init: {
    key: "lof_fatigue_init", name: "LOF Fatigue Initiation",
    equation: "S-N approach with stress concentration at LOF tip",
    applicable_discs: ["incomplete_fusion", "incomplete_fusion_sidewall", "incomplete_fusion_root"],
    inputs: ["lof_size", "stress_range", "joint_geometry"],
    output: "Estimated cycles to fatigue crack initiation from LOF",
    severity: "progressive",
    note: "LOF acts as pre-existing crack-like flaw. Fatigue life significantly reduced."
  },
  porosity_stable: {
    key: "porosity_stable", name: "Porosity Stability Assessment",
    equation: "Stress concentration: Kt = 1 + 2*(a/r) for spherical void",
    applicable_discs: ["porosity_scattered", "porosity_cluster", "porosity_linear"],
    inputs: ["pore_size", "pore_distribution", "applied_stress"],
    output: "Stress concentration factor and stability rating",
    severity: "generally_stable",
    note: "Isolated porosity is volumetric — low stress concentration. Clustered or linear porosity more severe."
  },
  undercut_fatigue: {
    key: "undercut_fatigue", name: "Undercut Fatigue Initiation",
    equation: "SCF at undercut notch: Kt = 1 + 2*sqrt(d/r) for V-notch",
    applicable_discs: ["undercut", "undercut_root"],
    inputs: ["undercut_depth", "notch_radius", "stress_range", "weld_toe_angle"],
    output: "Fatigue life reduction factor",
    severity: "progressive",
    note: "Undercut creates sharp notch at highest stress location (weld toe). Critical in cyclic."
  },
  arc_strike_corrosion: {
    key: "arc_strike_corrosion", name: "Arc Strike Corrosion Initiation",
    equation: "Local HAZ hardness + galvanic potential difference",
    applicable_discs: ["arc_strike"],
    inputs: ["material", "environment", "arc_strike_size"],
    output: "Corrosion initiation risk and pitting probability",
    severity: "progressive",
    note: "Arc strike creates hard untempered martensite — preferential corrosion site, especially in sour service."
  },
  sensitization_igc: {
    key: "sensitization_igc", name: "Sensitization / Intergranular Corrosion",
    equation: "Cr depletion model: T > 425C for t > critical time (TTS diagram)",
    applicable_discs: ["sensitization"],
    inputs: ["material_grade", "peak_temperature", "time_at_temperature", "carbon_content"],
    output: "Degree of sensitization and IGC susceptibility",
    severity: "progressive",
    note: "304 SS sensitizes at 425-815C. Use 304L/316L (< 0.03% C) to prevent."
  },
  temper_embrittlement_model: {
    key: "temper_embrittlement_model", name: "Temper Embrittlement",
    equation: "J-factor: J = (Si+Mn)*(P+Sn)*10^4 or X-bar = (10P+5Sb+4Sn+As)/100",
    applicable_discs: ["temper_embrittlement"],
    inputs: ["composition", "time_at_temperature", "cooling_rate"],
    output: "DBTT shift and embrittlement severity",
    severity: "progressive_irreversible",
    note: "Cr-Mo steels 375-575C. Controlled by trace elements P, Sn, Sb, As. De-embrittle by heating above 600C."
  },
  creep_model: {
    key: "creep_model", name: "Creep Damage Accumulation",
    equation: "Larson-Miller: P = T*(C + log(t_r)) or Omega model per API 579",
    applicable_discs: ["creep_damage"],
    inputs: ["temperature", "stress", "time_in_service", "material_grade"],
    output: "Remaining creep life fraction and damage parameter",
    severity: "progressive_catastrophic",
    note: "Type IV cracking in HAZ of Cr-Mo steels is most common failure mode."
  }
};


// ================================================================
// REPAIR METHODS — by discontinuity family
// ================================================================

var REPAIR_METHODS = {
  crack: {
    family: "crack",
    method: "Full excavation to sound metal",
    steps: [
      "1. Mark crack extent + 50mm beyond each end",
      "2. Excavate by grinding or arc-air gouging",
      "3. Verify complete removal by MT or PT",
      "4. Repair-weld per qualified WPS with preheat",
      "5. Re-examine repaired area by original method + MT/PT",
      "6. PWHT if required by code or service condition"
    ],
    notes: "Never weld over a crack. Must remove 100%. Document root cause."
  },
  incomplete_fusion: {
    family: "incomplete_fusion",
    method: "Back-gouge and re-weld",
    steps: [
      "1. Remove weld to below LOF by grinding or gouging",
      "2. Verify sound metal by visual inspection",
      "3. Re-weld with adequate heat input and technique",
      "4. Ensure proper interpass cleaning between passes",
      "5. Re-examine by original NDE method"
    ],
    notes: "Root cause typically: insufficient heat input, improper technique, or contamination."
  },
  porosity: {
    family: "porosity",
    method: "Excavate and re-weld with improved conditions",
    steps: [
      "1. Remove affected area by grinding",
      "2. Identify and correct root cause (moisture, contamination, shielding)",
      "3. Ensure clean joint surfaces and adequate shielding",
      "4. Re-weld per WPS with verified gas flow and dry consumables",
      "5. Re-examine by original NDE method"
    ],
    notes: "Address root cause: check gas flow rate, electrode storage, base metal cleanliness, wind screens."
  },
  undercut: {
    family: "undercut",
    method: "Additional weld pass or grinding",
    steps: [
      "1. If minor: grind to smooth transition (check min thickness)",
      "2. If exceeds limit: add weld pass at toe with stringer bead",
      "3. Use reduced travel speed and proper electrode angle",
      "4. May require butter pass technique for difficult geometry",
      "5. Verify smooth toe transition and adequate section"
    ],
    notes: "Prevent by: reduce heat input, proper electrode angle (10-15 deg drag), slower travel speed at toe."
  },
  surface_general: {
    family: "surface",
    method: "Grinding, weld buildup, or re-make",
    steps: [
      "1. Evaluate depth and extent vs remaining section",
      "2. Grind smooth if sufficient material remains",
      "3. If material insufficient: weld buildup per qualified WPS",
      "4. Blend to smooth transition with surrounding surface",
      "5. MT/PT to verify no cracks introduced"
    ],
    notes: "Arc strikes, grinding marks, and mechanical damage in critical areas may require hardness testing."
  }
};


// ================================================================
// DOMINANCE ENGINE
// ================================================================

function getDominanceTier(discKey) {
  var disc = DISCONTINUITY_DB[discKey];
  if (disc) return disc.tier;
  // Check by family
  if (discKey.indexOf("crack") >= 0) return 1;
  if (discKey.indexOf("fusion") >= 0 || discKey.indexOf("penetration") >= 0) return 2;
  return 5;
}

function getDiscInfo(discKey) {
  return DISCONTINUITY_DB[discKey] || null;
}

function rankByDominance(discontinuities) {
  var ranked = discontinuities.slice().sort(function(a, b) {
    var tierA = getDominanceTier(a.discontinuity_key);
    var tierB = getDominanceTier(b.discontinuity_key);
    return tierA - tierB;
  });
  return ranked;
}


// ================================================================
// EVIDENCE SUFFICIENCY ENGINE
// ================================================================

function checkEvidenceSufficiency(evidence) {
  var issues = [];
  var score = 100;
  var required = [];

  if (!evidence.images || evidence.images.length === 0) {
    if (!evidence.measurements || evidence.measurements.length === 0) {
      issues.push("No images and no measurements provided — cannot evaluate");
      score = 0;
      required.push("weld_photo_overview");
      required.push("weld_photo_closeup");
    }
  }

  if (evidence.images && evidence.images.length > 0) {
    var hasOverview = false;
    var hasCloseup = false;
    var hasProfile = false;
    var hasCalibration = false;

    for (var i = 0; i < evidence.images.length; i++) {
      var img = evidence.images[i];
      if (img.type === "overview") hasOverview = true;
      if (img.type === "closeup") hasCloseup = true;
      if (img.type === "profile" || img.type === "side_view") hasProfile = true;
      if (img.calibrated || img.has_reference) hasCalibration = true;
      if (img.quality_score !== undefined && img.quality_score < 50) {
        issues.push("Image " + (i + 1) + " has low quality score (" + img.quality_score + ") — may affect accuracy");
        score -= 10;
      }
    }

    if (!hasOverview) { issues.push("No overview photo"); score -= 10; required.push("weld_photo_overview"); }
    if (!hasCloseup) { issues.push("No close-up photo"); score -= 10; required.push("weld_photo_closeup"); }
    if (!hasProfile) { issues.push("No profile/side view"); score -= 15; required.push("weld_photo_profile"); }
    if (!hasCalibration) { issues.push("No calibration reference"); score -= 15; required.push("calibration_reference"); }
  }

  if (!evidence.process) { issues.push("Welding process not specified"); score -= 10; }
  if (!evidence.position) { issues.push("Weld position not specified"); score -= 5; }
  if (!evidence.material) { issues.push("Base material not specified"); score -= 5; }
  if (!evidence.joint_type) { issues.push("Joint type not specified"); score -= 5; }
  if (!evidence.code) { issues.push("Governing code not specified"); score -= 20; }
  if (!evidence.thickness) { issues.push("Material thickness not specified"); score -= 10; }

  if (score < 0) score = 0;

  var rating = "sufficient";
  if (score < 30) rating = "critically_insufficient";
  else if (score < 50) rating = "insufficient";
  else if (score < 70) rating = "marginal";
  else if (score < 85) rating = "adequate";

  return {
    score: score,
    rating: rating,
    issues: issues,
    required_evidence: required,
    can_proceed: score >= 50,
    can_issue_final: score >= 80,
    must_escalate: score < 50
  };
}


// ================================================================
// CODE ROUTING ENGINE
// ================================================================

function routeCode(context) {
  if (context.code_key) return context.code_key;

  var application = (context.application || "").toLowerCase();
  var material = (context.material || "").toLowerCase();

  // Application-based routing
  if (application.indexOf("bridge") >= 0) return "aws_d1_5";
  if (application.indexOf("seismic") >= 0 || application.indexOf("demand-critical") >= 0) return "aws_d1_8";
  if (application.indexOf("pipeline") >= 0 || application.indexOf("pipe") >= 0) {
    if (application.indexOf("process") >= 0 || application.indexOf("chemical") >= 0) return "asme_b31_3";
    if (application.indexOf("power") >= 0 || application.indexOf("steam") >= 0) return "asme_b31_1";
    return "api_1104";
  }
  if (application.indexOf("pressure") >= 0 || application.indexOf("vessel") >= 0) return "asme_viii";
  if (application.indexOf("lethal") >= 0) return "asme_viii";

  // Material-based routing
  if (material.indexOf("aluminum") >= 0) return "aws_d1_2";
  if (material.indexOf("stainless") >= 0) return "aws_d1_6";
  if (material.indexOf("sheet") >= 0) return "aws_d1_3";

  // Thickness-based
  if (context.thickness && context.thickness <= 4.8) return "aws_d1_3";

  return "aws_d1_1";
}


// ================================================================
// ACCEPTANCE CHECK ENGINE — uses hardcoded criteria
// ================================================================

function findCriteria(codeKey, discKey) {
  var disc = DISCONTINUITY_DB[discKey];
  var family = disc ? disc.family : discKey;

  // Build lookup keys to try
  var keys = [];
  var loadings = ["all", "static", "pressure", "cyclic", "fatigue", "seismic"];

  // Direct key match
  for (var li = 0; li < loadings.length; li++) {
    keys.push(codeKey + "__" + family);
    keys.push(codeKey + "__" + family + "_" + loadings[li]);
    keys.push(codeKey + "__" + discKey);
  }

  var matches = [];
  var seen = {};
  for (var ki = 0; ki < keys.length; ki++) {
    var k = keys[ki];
    if (ACCEPTANCE_CRITERIA[k] && !seen[k]) {
      seen[k] = true;
      matches.push(ACCEPTANCE_CRITERIA[k]);
    }
  }

  // Also search all criteria for this code + family
  var allKeys = Object.keys(ACCEPTANCE_CRITERIA);
  for (var ai = 0; ai < allKeys.length; ai++) {
    var c = ACCEPTANCE_CRITERIA[allKeys[ai]];
    if (c.code_key === codeKey && c.disc_family === family && !seen[allKeys[ai]]) {
      seen[allKeys[ai]] = true;
      matches.push(c);
    }
  }

  return matches;
}

function checkSingleAcceptance(disc, codeKey, context) {
  var criteria = findCriteria(codeKey, disc.discontinuity_key);

  var result = {
    discontinuity_key: disc.discontinuity_key,
    measured_value: disc.measured_value,
    measured_unit: disc.measured_unit || "mm",
    criteria_matched: [],
    disposition: "accept",
    reject_reasons: [],
    conditional_notes: [],
    governing_clauses: []
  };

  if (!criteria || criteria.length === 0) {
    result.disposition = "no_criteria";
    result.conditional_notes.push("No specific acceptance criteria found for " + disc.discontinuity_key + " under " + codeKey);
    return result;
  }

  var loading = context.loading_condition || "static";

  for (var ci = 0; ci < criteria.length; ci++) {
    var crit = criteria[ci];

    // Filter by loading condition
    if (crit.loading && crit.loading !== "all" && crit.loading !== loading) continue;

    // Filter by quality level for ISO 5817
    if (crit.quality_level && context.quality_level && crit.quality_level !== context.quality_level) continue;

    result.criteria_matched.push({
      table: crit.table_ref,
      clause: crit.clause,
      type: crit.criteria_type,
      code: crit.code_key,
      note: crit.note
    });

    result.governing_clauses.push(crit.table_ref + " (" + crit.clause + ")");

    // Absolute reject
    if (crit.absolute_reject) {
      result.disposition = "reject";
      result.reject_reasons.push({
        reason: disc.discontinuity_key + " is not permitted per " + codeKey + " " + crit.table_ref,
        clause: crit.clause,
        criteria_type: crit.criteria_type,
        note: crit.note
      });
      break;
    }

    // Dimensional checks with measured values
    if (disc.measured_value !== undefined && disc.measured_value !== null) {
      var rejectOnMeasure = false;

      // Max depth check
      if (crit.max_depth_mm !== undefined && crit.max_depth_mm !== null) {
        var effectiveMax = crit.max_depth_mm;
        // Thin material override
        if (crit.max_depth_mm_thin !== undefined && context.thickness && context.thickness < crit.thin_threshold_mm) {
          effectiveMax = crit.max_depth_mm_thin;
        }
        if (disc.measured_value > effectiveMax) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " depth " + disc.measured_value + "mm exceeds max " + effectiveMax + "mm",
            clause: crit.clause,
            criteria_type: crit.criteria_type
          });
        }
      }

      // Max depth as percent of wall
      if (crit.max_depth_percent_wall !== undefined && context.thickness) {
        var depthPct = (disc.measured_value / context.thickness) * 100;
        if (depthPct > crit.max_depth_percent_wall) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " depth is " + round2(depthPct) + "% of wall, exceeds " + crit.max_depth_percent_wall + "%",
            clause: crit.clause,
            criteria_type: crit.criteria_type
          });
        }
      }

      // Max individual size
      if (crit.max_individual_mm !== undefined && crit.max_individual_mm !== null) {
        if (disc.measured_value > crit.max_individual_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " size " + disc.measured_value + "mm exceeds max individual " + crit.max_individual_mm + "mm",
            clause: crit.clause,
            criteria_type: crit.criteria_type
          });
        }
      }

      // Max dimension (burn-through etc.)
      if (crit.max_dimension_mm !== undefined && crit.max_dimension_mm !== null) {
        if (disc.measured_value > crit.max_dimension_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " dimension " + disc.measured_value + "mm exceeds max " + crit.max_dimension_mm + "mm",
            clause: crit.clause,
            criteria_type: crit.criteria_type
          });
        }
      }

      // Max reinforcement
      if (crit.max_reinforcement_mm !== undefined && crit.max_reinforcement_mm !== null) {
        if (disc.measured_value > crit.max_reinforcement_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " height " + disc.measured_value + "mm exceeds max reinforcement " + crit.max_reinforcement_mm + "mm",
            clause: crit.clause,
            criteria_type: crit.criteria_type
          });
        }
      }

      // Length check
      if (crit.max_length_mm !== undefined && crit.max_length_mm !== null && disc.measured_length) {
        if (disc.measured_length > crit.max_length_mm) {
          rejectOnMeasure = true;
          result.reject_reasons.push({
            reason: disc.discontinuity_key + " length " + disc.measured_length + "mm exceeds max " + crit.max_length_mm + "mm",
            clause: crit.clause,
            criteria_type: crit.criteria_type
          });
        }
      }

      if (rejectOnMeasure) {
        result.disposition = "reject";
      }
    } else {
      if (crit.criteria_type !== "zero_tolerance" && crit.criteria_type !== "conditional") {
        result.conditional_notes.push("No measurement for " + disc.discontinuity_key + " — cannot verify against " + crit.criteria_type + " limits");
      }
    }
  }

  return result;
}


// ================================================================
// SERVICE CONDITION MODIFIER ENGINE
// ================================================================

function applyServiceConditions(acceptance, serviceConditions, disc) {
  if (!serviceConditions || serviceConditions.length === 0) return acceptance;

  var modified = JSON.parse(JSON.stringify(acceptance));

  for (var si = 0; si < serviceConditions.length; si++) {
    var svc = SERVICE_CONDITIONS[serviceConditions[si]];
    if (!svc) continue;

    var discInfo = DISCONTINUITY_DB[disc.discontinuity_key];
    var family = discInfo ? discInfo.family : disc.discontinuity_key;

    // Check disc_modifiers
    if (svc.disc_modifiers) {
      var modifier = svc.disc_modifiers[family] || svc.disc_modifiers[disc.discontinuity_key];
      if (modifier === "absolute_reject") {
        modified.disposition = "reject";
        modified.reject_reasons.push({
          reason: disc.discontinuity_key + " not permitted under " + svc.name + " (" + svc.standard + ")",
          clause: svc.standard,
          criteria_type: "service_condition"
        });
      } else if (modifier && modifier.indexOf("reduce_limit") >= 0) {
        modified.conditional_notes.push("Service condition " + svc.name + " tightens limits: " + modifier);
      } else if (modifier === "reject") {
        modified.disposition = "reject";
        modified.reject_reasons.push({
          reason: disc.discontinuity_key + " not acceptable under " + svc.name,
          clause: svc.standard,
          criteria_type: "service_condition"
        });
      }
    }
  }

  return modified;
}


// ================================================================
// 4D PHYSICS VALIDATION — hardcoded rules
// ================================================================

function validatePhysics(discKey, processKey, materialKey) {
  var disc = DISCONTINUITY_DB[discKey];
  var proc = processKey ? PROCESS_DB[processKey] : null;
  var mat = materialKey ? MATERIAL_DB[materialKey] : null;

  var rules = [];
  var plausible = false;
  var highProbability = false;

  // Check if this discontinuity is typical for this process
  if (proc && proc.typical_defects) {
    for (var td = 0; td < proc.typical_defects.length; td++) {
      if (proc.typical_defects[td] === discKey || (disc && proc.typical_defects[td] === disc.family)) {
        plausible = true;
        highProbability = true;
        rules.push({
          rule: discKey + " is a typical defect of " + proc.name,
          probability: "high",
          explanation: proc.physics
        });
      }
    }
  }

  // Material-specific checks
  if (mat && disc) {
    if (disc.family === "crack" && mat.hydrogen_sensitive && proc && proc.hydrogen_risk !== "none" && proc.hydrogen_risk !== "very_low") {
      plausible = true;
      highProbability = true;
      rules.push({
        rule: "Hydrogen cracking risk: " + mat.name + " is hydrogen-sensitive + " + proc.name + " has " + proc.hydrogen_risk + " hydrogen risk",
        probability: "high",
        explanation: "Susceptible microstructure + hydrogen source + restraint stress = cracking risk"
      });
    }

    if (discKey === "sensitization" && mat.key === "austenitic_ss") {
      plausible = true;
      rules.push({
        rule: "Sensitization expected in " + mat.name + " if sustained 425-815C",
        probability: "moderate",
        explanation: "Chromium carbide precipitation depletes Cr at grain boundaries"
      });
    }

    if (discKey === "hot_crack" && (mat.key === "austenitic_ss" || mat.key === "nickel_alloy" || mat.key === "aluminum")) {
      plausible = true;
      rules.push({
        rule: "Hot cracking susceptibility in " + mat.name,
        probability: "moderate",
        explanation: mat.concerns ? mat.concerns.join("; ") : "Material susceptible to solidification cracking"
      });
    }
  }

  // General physics rules for any discontinuity that matches family
  if (!plausible && disc) {
    // All processes can produce porosity from contamination
    if (disc.family === "porosity") {
      plausible = true;
      rules.push({
        rule: "Porosity is possible with any arc welding process",
        probability: "moderate",
        explanation: "Gas entrapment from moisture, contamination, insufficient shielding, or base metal chemistry"
      });
    }
    // All fusion processes can produce undercut
    if (disc.family === "undercut") {
      plausible = true;
      rules.push({
        rule: "Undercut possible with any fusion welding process",
        probability: "moderate",
        explanation: "Excessive current, travel speed, or improper electrode angle at weld toe"
      });
    }
  }

  return {
    discontinuity_key: discKey,
    process_key: processKey || null,
    material_key: materialKey || null,
    physics_plausible: plausible,
    high_probability: highProbability,
    rules: rules,
    total_rules: rules.length
  };
}


// ================================================================
// CONFIDENCE ENGINE
// ================================================================

function computeConfidence(evidenceSufficiency, discontinuityResults, physicsValidations, hasCalibration) {
  var score = 50;

  score += (evidenceSufficiency.score / 100) * 25;

  if (hasCalibration) score += 10;

  var measured = 0;
  var total = discontinuityResults.length;
  for (var i = 0; i < discontinuityResults.length; i++) {
    if (discontinuityResults[i].measured_value !== undefined && discontinuityResults[i].measured_value !== null) {
      measured++;
    }
  }
  if (total > 0) {
    score += (measured / total) * 10;
  }

  if (physicsValidations && physicsValidations.length > 0) {
    var plausibleCount = 0;
    for (var pi = 0; pi < physicsValidations.length; pi++) {
      if (physicsValidations[pi].physics_plausible) plausibleCount++;
    }
    score += (plausibleCount / physicsValidations.length) * 5;
  }

  if (score > 100) score = 100;
  score = round2(score);

  var level = "low";
  if (score >= 90) level = "high";
  else if (score >= 75) level = "moderate";
  else if (score >= 60) level = "provisional";

  return {
    score: score,
    level: level,
    requires_escalation: score < 60,
    can_auto_accept: score >= 85,
    can_auto_reject: score >= 70
  };
}


// ================================================================
// ESCALATION LOGIC
// ================================================================

function determineEscalation(confidence, disposition, findings, mode) {
  var escalate = false;
  var reasons = [];

  for (var i = 0; i < findings.length; i++) {
    if (findings[i].discontinuity_key && findings[i].discontinuity_key.indexOf("crack") >= 0) {
      escalate = true;
      reasons.push("Crack detected — requires CWI confirmation");
    }
  }

  if (confidence.requires_escalation) {
    escalate = true;
    reasons.push("Confidence " + confidence.score + " below threshold");
  }

  if (disposition === "accept" && !confidence.can_auto_accept) {
    escalate = true;
    reasons.push("Accept requires confidence >= 85; current: " + confidence.score);
  }

  if (mode === "production" || mode === "cwi_assist") {
    escalate = true;
    reasons.push("Mode " + mode + " requires human signoff");
  }

  return {
    escalate: escalate,
    reasons: reasons,
    priority: escalate && disposition === "reject" ? "high" : escalate ? "normal" : "none"
  };
}


// ================================================================
// REPAIR RECOMMENDATION ENGINE
// ================================================================

function getRepairRecommendation(discKey) {
  var disc = DISCONTINUITY_DB[discKey];
  var family = disc ? disc.family : discKey;

  // Try direct family match
  if (REPAIR_METHODS[family]) return REPAIR_METHODS[family];

  // Fallback mappings
  if (family === "incomplete_penetration") return REPAIR_METHODS["incomplete_fusion"];
  if (family === "burn_through" || family === "overlap" || family === "undersize" || family === "convexity" || family === "concavity" || family === "reinforcement") {
    return REPAIR_METHODS["surface_general"];
  }
  if (family === "inclusion") return REPAIR_METHODS["porosity"];
  if (family === "arc_strike" || family === "spatter" || family === "surface" || family === "misalignment" || family === "distortion") {
    return REPAIR_METHODS["surface_general"];
  }

  return { family: family, method: "Repair per qualified repair procedure", steps: ["Consult CWI for repair method"], notes: "No specific repair template for " + family };
}


// ================================================================
// HANDLER
// ================================================================

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return fail(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    // == get_registry ==
    if (action === "get_registry") {
      return ok({
        engine: ENGINE_NAME,
        version: ENGINE_VERSION,
        status: "operational",
        capabilities: [
          "evaluate_weld", "route_code", "check_acceptance", "check_dominance",
          "validate_physics", "check_evidence",
          "get_process_registry", "get_material_registry", "get_joint_registry",
          "get_discontinuity_registry", "get_code_library", "get_service_conditions",
          "get_damage_models", "get_repair_methods"
        ],
        codes_supported: Object.keys(CODE_LIBRARY),
        modes: ["training", "instructor", "production", "cwi_assist"],
        knowledge_base: {
          codes: Object.keys(CODE_LIBRARY).length,
          acceptance_criteria: Object.keys(ACCEPTANCE_CRITERIA).length,
          discontinuity_types: Object.keys(DISCONTINUITY_DB).length,
          materials: Object.keys(MATERIAL_DB).length,
          processes: Object.keys(PROCESS_DB).length,
          joints: Object.keys(JOINT_DB).length,
          service_conditions: Object.keys(SERVICE_CONDITIONS).length,
          damage_models: Object.keys(DAMAGE_MODELS).length,
          repair_methods: Object.keys(REPAIR_METHODS).length
        },
        architecture: "Hardcoded knowledge base — no database dependency for core logic",
        description: "CWI-level deterministic weld acceptance authority v2.0. Full Smartest CWI Core. AI observes, this engine decides."
      });
    }

    // == get_code_library ==
    if (action === "get_code_library") {
      return ok({ codes: CODE_LIBRARY, total: Object.keys(CODE_LIBRARY).length });
    }

    // == get_process_registry ==
    if (action === "get_process_registry") {
      return ok({ processes: PROCESS_DB, total: Object.keys(PROCESS_DB).length });
    }

    // == get_material_registry ==
    if (action === "get_material_registry") {
      return ok({ materials: MATERIAL_DB, total: Object.keys(MATERIAL_DB).length });
    }

    // == get_joint_registry ==
    if (action === "get_joint_registry") {
      return ok({ joints: JOINT_DB, total: Object.keys(JOINT_DB).length });
    }

    // == get_discontinuity_registry ==
    if (action === "get_discontinuity_registry") {
      return ok({ discontinuities: DISCONTINUITY_DB, total: Object.keys(DISCONTINUITY_DB).length });
    }

    // == get_service_conditions ==
    if (action === "get_service_conditions") {
      return ok({ service_conditions: SERVICE_CONDITIONS, total: Object.keys(SERVICE_CONDITIONS).length });
    }

    // == get_damage_models ==
    if (action === "get_damage_models") {
      return ok({ damage_models: DAMAGE_MODELS, total: Object.keys(DAMAGE_MODELS).length });
    }

    // == get_repair_methods ==
    if (action === "get_repair_methods") {
      return ok({ repair_methods: REPAIR_METHODS, total: Object.keys(REPAIR_METHODS).length });
    }

    // == route_code ==
    if (action === "route_code") {
      var codeKey = routeCode({
        code_key: body.code_key,
        application: body.application,
        material: body.material,
        joint_type: body.joint_type,
        thickness: body.thickness
      });

      var codeInfo = CODE_LIBRARY[codeKey];

      return ok({
        code_key: codeKey,
        code_name: codeInfo ? codeInfo.code_name : codeKey,
        edition: codeInfo ? codeInfo.edition : "unknown",
        routing_basis: body.code_key ? "explicit" : "auto_routed",
        acceptance_tables: codeInfo ? codeInfo.acceptance_tables : [],
        loading_conditions: codeInfo ? codeInfo.loading_conditions : [],
        scope: codeInfo ? codeInfo.scope : ""
      });
    }

    // == check_evidence ==
    if (action === "check_evidence") {
      var evidence = body.evidence || body;
      var sufficiency = checkEvidenceSufficiency(evidence);
      return ok({ evidence_sufficiency: sufficiency });
    }

    // == check_acceptance ==
    if (action === "check_acceptance") {
      if (!body.discontinuity_key) return fail(400, "discontinuity_key required");
      if (!body.code_key) return fail(400, "code_key required");

      var disc = {
        discontinuity_key: body.discontinuity_key,
        measured_value: body.measured_value,
        measured_unit: body.measured_unit || "mm",
        measured_length: body.measured_length
      };

      var context = {
        code_key: body.code_key,
        loading_condition: body.loading_condition || "static",
        thickness: body.thickness,
        quality_level: body.quality_level
      };

      var result = checkSingleAcceptance(disc, body.code_key, context);

      // Apply service conditions if provided
      if (body.service_conditions && body.service_conditions.length > 0) {
        result = applyServiceConditions(result, body.service_conditions, disc);
      }

      return ok(result);
    }

    // == check_dominance ==
    if (action === "check_dominance") {
      if (!body.discontinuities || !Array.isArray(body.discontinuities)) {
        return fail(400, "discontinuities array required");
      }

      var ranked = rankByDominance(body.discontinuities);
      var dominant = ranked.length > 0 ? ranked[0] : null;
      var dominantInfo = dominant ? getDiscInfo(dominant.discontinuity_key) : null;

      var hasTier1 = false;
      for (var t = 0; t < ranked.length; t++) {
        if (getDominanceTier(ranked[t].discontinuity_key) === 1) {
          hasTier1 = true;
          break;
        }
      }

      return ok({
        ranked: ranked.map(function(r) {
          var info = getDiscInfo(r.discontinuity_key);
          return {
            discontinuity_key: r.discontinuity_key,
            dominance_tier: info ? info.tier : 5,
            is_planar: info ? info.planar : false,
            name: info ? info.name : r.discontinuity_key
          };
        }),
        dominant_discontinuity: dominant ? dominant.discontinuity_key : null,
        dominant_tier: dominantInfo ? dominantInfo.tier : null,
        has_tier1_crack: hasTier1,
        verdict: hasTier1
          ? "TIER 1 DOMINANT: Crack detected. Immediate reject per all codes."
          : dominant && dominantInfo && dominantInfo.tier <= 2
          ? "TIER 2 DOMINANT: " + (dominantInfo.name) + " dominates. Evaluate first."
          : "No dominant discontinuity — evaluate all findings individually."
      });
    }

    // == validate_physics ==
    if (action === "validate_physics") {
      if (!body.discontinuity_key) return fail(400, "discontinuity_key required");
      var physResult = validatePhysics(body.discontinuity_key, body.process_key, body.material_key);
      return ok(physResult);
    }

    // ================================================================
    // EVALUATE_WELD — The Full CWI Pipeline
    // ================================================================
    if (action === "evaluate_weld") {
      var orgId = body.org_id || getOrg(event);
      if (!orgId) return fail(400, "org_id required");

      var mode = body.mode || "training";

      // 1. EVIDENCE SUFFICIENCY GATE
      var evidence = {
        images: body.images || [],
        measurements: body.measurements || [],
        process: body.process_key,
        position: body.position_key,
        material: body.material_key,
        joint_type: body.joint_key,
        code: body.code_key,
        thickness: body.thickness
      };

      var evSufficiency = checkEvidenceSufficiency(evidence);

      if (evSufficiency.score < 30) {
        await auditLog(orgId, "evaluation_blocked", body.case_id, body.scan_id, {
          reason: "evidence_critically_insufficient",
          score: evSufficiency.score
        });

        return ok({
          disposition: "insufficient_evidence",
          disposition_detail: "Cannot evaluate — evidence critically insufficient",
          evidence_sufficiency: evSufficiency,
          required_actions: evSufficiency.required_evidence.map(function(re) { return "Provide: " + re; }),
          assessment_complete: false
        });
      }

      // 2. CODE ROUTING
      var codeKey = routeCode({
        code_key: body.code_key,
        application: body.application,
        material: body.material_key,
        joint_type: body.joint_key,
        thickness: body.thickness
      });

      var loadingCondition = body.loading_condition || "static";
      var serviceConditions = body.service_conditions || [];

      // 3. GET MATERIAL & PROCESS INFO
      var matInfo = body.material_key ? MATERIAL_DB[body.material_key] : null;
      var procInfo = body.process_key ? PROCESS_DB[body.process_key] : null;
      var codeInfo = CODE_LIBRARY[codeKey];

      // 4. PROCESS DISCONTINUITIES
      var discontinuities = body.discontinuities || [];
      if (discontinuities.length === 0) {
        var cleanResult = {
          disposition: evSufficiency.can_issue_final ? "accept" : "provisional_accept",
          disposition_detail: "No discontinuities detected",
          code_routed: { code_key: codeKey, code_name: codeInfo ? codeInfo.code_name : codeKey, edition: codeInfo ? codeInfo.edition : "unknown" },
          evidence_sufficiency: evSufficiency,
          findings: [],
          confidence: { score: evSufficiency.score, level: evSufficiency.score >= 80 ? "high" : "provisional" },
          escalation: determineEscalation({ score: evSufficiency.score, requires_escalation: false, can_auto_accept: evSufficiency.can_issue_final }, "accept", [], mode),
          engine_version: ENGINE_VERSION
        };

        try {
          await supabase.from("weld_assessments").insert({
            org_id: orgId,
            case_id: body.case_id || null,
            scan_id: body.scan_id || null,
            code_key: codeKey,
            disposition: cleanResult.disposition,
            disposition_detail: cleanResult.disposition_detail,
            confidence_score: evSufficiency.score,
            engine_version: ENGINE_VERSION,
            assessment_json: cleanResult
          });
          await auditLog(orgId, "weld_evaluated", body.case_id, body.scan_id, { disposition: cleanResult.disposition, code: codeKey });
        } catch(dbErr) {}

        return ok(cleanResult);
      }

      // 5. DOMINANCE CHECK
      var ranked = rankByDominance(discontinuities);

      // 6. EVALUATE EACH DISCONTINUITY
      var findings = [];
      var allRejectReasons = [];
      var overallDisposition = "accept";
      var governingClauses = [];
      var physicsValidations = [];
      var repairRequired = false;
      var repairRecommendations = [];
      var damageProjections = [];

      for (var di = 0; di < ranked.length; di++) {
        var disc = ranked[di];

        var acceptance = checkSingleAcceptance(disc, codeKey, {
          code_key: codeKey,
          loading_condition: loadingCondition,
          thickness: body.thickness,
          quality_level: body.quality_level
        });

        // Apply service condition modifiers
        if (serviceConditions.length > 0) {
          acceptance = applyServiceConditions(acceptance, serviceConditions, disc);
        }

        // Physics validation
        var physValidation = validatePhysics(disc.discontinuity_key, body.process_key, body.material_key);
        physicsValidations.push(physValidation);

        // Discontinuity info
        var discInfo = getDiscInfo(disc.discontinuity_key);

        // Damage model lookup
        var applicableDamage = [];
        var dmKeys = Object.keys(DAMAGE_MODELS);
        for (var dmi = 0; dmi < dmKeys.length; dmi++) {
          var dm = DAMAGE_MODELS[dmKeys[dmi]];
          if (dm.applicable_discs.indexOf(disc.discontinuity_key) >= 0) {
            applicableDamage.push({ model: dm.name, severity: dm.severity, note: dm.note });
          }
        }
        if (applicableDamage.length > 0) {
          damageProjections.push({ discontinuity: disc.discontinuity_key, models: applicableDamage });
        }

        var finding = {
          discontinuity_key: disc.discontinuity_key,
          discontinuity_name: discInfo ? discInfo.name : disc.discontinuity_key,
          iso_6520: discInfo ? discInfo.iso : "N/A",
          dominance_tier: discInfo ? discInfo.tier : 5,
          is_planar: discInfo ? discInfo.planar : false,
          measured_value: disc.measured_value,
          measured_unit: disc.measured_unit || "mm",
          measured_length: disc.measured_length,
          location: disc.location || "not_specified",
          ai_confidence: disc.ai_confidence || null,
          acceptance: acceptance,
          physics: physValidation,
          damage_models: applicableDamage,
          repair_action: null
        };

        // Track disposition
        if (acceptance.disposition === "reject") {
          overallDisposition = "reject";
          repairRequired = true;
          for (var rr = 0; rr < acceptance.reject_reasons.length; rr++) {
            allRejectReasons.push(acceptance.reject_reasons[rr]);
          }

          var repair = getRepairRecommendation(disc.discontinuity_key);
          finding.repair_action = repair;
          repairRecommendations.push({
            discontinuity: disc.discontinuity_key,
            method: repair.method,
            steps: repair.steps
          });
        }

        for (var gc = 0; gc < acceptance.governing_clauses.length; gc++) {
          if (governingClauses.indexOf(acceptance.governing_clauses[gc]) < 0) {
            governingClauses.push(acceptance.governing_clauses[gc]);
          }
        }

        findings.push(finding);
      }

      // 7. CONFIDENCE
      var hasCalibration = false;
      if (body.images) {
        for (var ci = 0; ci < body.images.length; ci++) {
          if (body.images[ci].calibrated || body.images[ci].has_reference) hasCalibration = true;
        }
      }

      var confidence = computeConfidence(evSufficiency, discontinuities, physicsValidations, hasCalibration);

      // 8. PROVISIONAL LOGIC
      if (overallDisposition === "accept" && !evSufficiency.can_issue_final) {
        overallDisposition = "provisional_accept";
      }
      if (overallDisposition === "reject" && confidence.score < 60) {
        overallDisposition = "provisional_reject";
      }

      // 9. ESCALATION
      var escalation = determineEscalation(confidence, overallDisposition, findings, mode);
      if (escalation.escalate && overallDisposition === "accept") {
        overallDisposition = "accept_pending_review";
      }

      // 10. STORE ASSESSMENT
      var dispositionDetail = overallDisposition === "reject"
        ? "REJECT: " + allRejectReasons.length + " code violation(s) found"
        : overallDisposition === "provisional_accept"
        ? "PROVISIONAL ACCEPT: Pending additional evidence"
        : overallDisposition === "accept_pending_review"
        ? "ACCEPT PENDING REVIEW: Requires CWI confirmation"
        : overallDisposition === "provisional_reject"
        ? "PROVISIONAL REJECT: Low confidence — verify"
        : "ACCEPT: All discontinuities within acceptance criteria";

      var assessmentRecord = {
        org_id: orgId,
        case_id: body.case_id || null,
        scan_id: body.scan_id || null,
        process_key: body.process_key || null,
        position_key: body.position_key || null,
        material_key: body.material_key || null,
        joint_key: body.joint_key || null,
        code_key: codeKey,
        loading_condition: loadingCondition,
        thickness_mm: body.thickness || null,
        discontinuities_found: findings,
        criteria_applied: governingClauses,
        physics_validations: physicsValidations,
        disposition: overallDisposition,
        disposition_detail: dispositionDetail,
        governing_clause: governingClauses.join("; "),
        reject_reasons: allRejectReasons,
        repair_required: repairRequired,
        repair_recommendations: repairRecommendations,
        confidence_score: confidence.score,
        assessment_json: {
          evidence_sufficiency: evSufficiency,
          confidence: confidence,
          escalation: escalation,
          service_conditions: serviceConditions,
          damage_projections: damageProjections,
          material_info: matInfo ? { name: matInfo.name, weldability: matInfo.weldability, hydrogen_sensitive: matInfo.hydrogen_sensitive, concerns: matInfo.concerns } : null,
          process_info: procInfo ? { name: procInfo.name, hydrogen_risk: procInfo.hydrogen_risk } : null,
          code_info: codeInfo ? { name: codeInfo.code_name, edition: codeInfo.edition } : null,
          mode: mode
        },
        engine_version: ENGINE_VERSION
      };

      var assessmentId = null;
      try {
        var assessInsert = await supabase.from("weld_assessments").insert(assessmentRecord).select("id").single();
        if (assessInsert.data) assessmentId = assessInsert.data.id;
        await auditLog(orgId, "weld_evaluated", body.case_id, body.scan_id, {
          disposition: overallDisposition,
          code: codeKey,
          findings_count: findings.length,
          reject_count: allRejectReasons.length,
          confidence: confidence.score,
          escalated: escalation.escalate,
          service_conditions: serviceConditions,
          mode: mode
        });
      } catch(dbErr) {}

      // 11. RETURN FULL CWI REPORT
      return ok({
        assessment_id: assessmentId,
        disposition: overallDisposition,
        disposition_detail: dispositionDetail,
        code_routed: {
          code_key: codeKey,
          code_name: codeInfo ? codeInfo.code_name : codeKey,
          edition: codeInfo ? codeInfo.edition : "unknown",
          loading_condition: loadingCondition,
          governing_clauses: governingClauses
        },
        evidence_sufficiency: evSufficiency,
        findings: findings,
        dominance: {
          dominant: findings.length > 0 ? findings[0].discontinuity_key : null,
          dominant_tier: findings.length > 0 ? findings[0].dominance_tier : null,
          has_crack: findings.some(function(f) { return f.discontinuity_key.indexOf("crack") >= 0; })
        },
        reject_reasons: allRejectReasons,
        repair: {
          required: repairRequired,
          recommendations: repairRecommendations
        },
        damage_projections: damageProjections,
        service_conditions_applied: serviceConditions,
        material_context: matInfo ? { name: matInfo.name, weldability: matInfo.weldability, concerns: matInfo.concerns } : null,
        confidence: confidence,
        escalation: escalation,
        mode: mode,
        engine_version: ENGINE_VERSION,
        summary: overallDisposition === "reject"
          ? "WELD REJECTED. " + allRejectReasons.length + " code violation(s) per " + (governingClauses[0] || codeKey) + ". Repair required."
          : overallDisposition === "accept"
          ? "WELD ACCEPTED. All " + findings.length + " finding(s) within " + (codeInfo ? codeInfo.code_name : codeKey) + " " + (codeInfo ? codeInfo.edition : "") + " acceptance criteria."
          : "WELD " + overallDisposition.toUpperCase().replace(/_/g, " ") + ". " + (escalation.escalate ? escalation.reasons[0] : "")
      });
    }

    return fail(400, "Unknown action: " + action + ". Valid: get_registry, evaluate_weld, route_code, check_acceptance, check_dominance, validate_physics, check_evidence, get_process_registry, get_material_registry, get_joint_registry, get_discontinuity_registry, get_code_library, get_service_conditions, get_damage_models, get_repair_methods");

  } catch (err) {
    return fail(500, String(err && err.message ? err.message : err));
  }
};
