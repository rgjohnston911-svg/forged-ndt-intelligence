// @ts-nocheck
/**
 * DEPLOY270 - live-code-authority.ts
 * netlify/functions/live-code-authority.ts
 *
 * LIVE CODE AUTHORITY ENGINE v1.0.0
 * Hardcoded knowledge of current standards editions, supersession
 * history, and applicability rules.
 *
 * Eliminates "edition TBD" and "VAGUE_REFERENCE" failures in the
 * governance lock by resolving every standards reference to:
 *   - exact designation
 *   - current edition/year
 *   - authority body
 *   - applicable domains/materials/damage modes
 *   - supersession history
 *   - key thresholds
 *
 * 8 actions:
 *   get_registry          — engine overview
 *   resolve_standard      — resolve a vague reference to exact edition
 *   check_edition         — verify if a cited edition is current
 *   get_applicable_codes  — get all applicable codes for a domain/material/damage mode
 *   get_supersession      — get supersession chain for a standard
 *   get_thresholds        — get key thresholds from a standard
 *   validate_references   — batch validate a list of standards references
 *   get_full_registry     — dump entire code authority database
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var ENGINE_VERSION = "live-code-authority/1.0.0";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) { return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) }; }
function errResp(code, msg) { return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) }; }

// ============================================================
// STANDARDS REGISTRY — HARDCODED CURRENT EDITIONS
// This is the single source of truth for the platform.
// Updated manually when new editions are published.
// Last updated: 2026-04-21
// ============================================================
var STANDARDS_DB = [
  // API — Pressure Equipment
  { body: "API", designation: "API 510", title: "Pressure Vessel Inspection Code", current_edition: "11th Edition", current_year: 2022, previous_edition: "10th Edition", previous_year: 2014, domains: ["pressure_vessels", "refining", "chemical", "petrochemical"], materials: ["carbon_steel", "low_alloy", "stainless_steel", "high_alloy"], damage_modes: ["corrosion", "cracking", "creep", "erosion"], thresholds: { min_thickness: "Per MAWP calculation", corrosion_allowance: "Per owner/user specification", inspection_interval_max_years: 10 } },
  { body: "API", designation: "API 570", title: "Piping Inspection Code", current_edition: "4th Edition", current_year: 2016, addendum_year: 2021, previous_edition: "3rd Edition", previous_year: 2009, domains: ["piping", "refining", "chemical", "petrochemical", "offshore"], materials: ["carbon_steel", "low_alloy", "stainless_steel"], damage_modes: ["corrosion", "erosion", "cracking", "CUI", "FAC"], thresholds: { external_interval_max_years: 10, internal_interval_max_years: 5, half_life_rule: "interval = remaining_life / 2" } },
  { body: "API", designation: "API 653", title: "Tank Inspection, Repair, Alteration, and Reconstruction", current_edition: "6th Edition", current_year: 2022, previous_edition: "5th Edition", previous_year: 2014, domains: ["storage_tanks", "refining", "terminals"], materials: ["carbon_steel"], damage_modes: ["corrosion", "settlement", "cracking"], thresholds: { external_interval_max_years: 10, internal_interval_max_years: 20, shell_minimum_thickness_mm: 2.5 } },

  // API — Fitness for Service
  { body: "API/ASME", designation: "API 579-1/ASME FFS-1", title: "Fitness-For-Service", current_edition: "4th Edition", current_year: 2024, previous_edition: "3rd Edition", previous_year: 2016, domains: ["pressure_vessels", "piping", "storage_tanks", "all"], materials: ["carbon_steel", "low_alloy", "stainless_steel", "high_alloy"], damage_modes: ["corrosion", "cracking", "creep", "dents", "laminations", "misalignment"], thresholds: { level_1: "Screening assessment", level_2: "Component-specific", level_3: "Detailed FEA" } },

  // API — Damage Mechanisms
  { body: "API", designation: "API 571", title: "Damage Mechanisms Affecting Fixed Equipment in the Refining Industry", current_edition: "3rd Edition", current_year: 2020, previous_edition: "2nd Edition", previous_year: 2011, domains: ["refining", "chemical", "petrochemical"], materials: ["all"], damage_modes: ["all"], thresholds: {} },

  // API — Offshore Structures
  { body: "API", designation: "API RP 2A-WSD", title: "Planning, Designing, and Constructing Fixed Offshore Platforms - WSD", current_edition: "23rd Edition", current_year: 2021, previous_edition: "22nd Edition", previous_year: 2014, domains: ["offshore", "fixed_platforms"], materials: ["structural_steel", "carbon_steel"], damage_modes: ["fatigue", "corrosion", "impact", "overload"], thresholds: { fatigue_safety_factor: 2.0, member_utilization_max: 0.6 } },
  { body: "API", designation: "API RP 2SIM", title: "Structural Integrity Management of Fixed Offshore Structures", current_edition: "1st Edition", current_year: 2014, domains: ["offshore", "fixed_platforms", "structural_integrity"], materials: ["structural_steel"], damage_modes: ["fatigue", "corrosion", "damage"], thresholds: {} },
  { body: "API", designation: "API RP 2I", title: "In-service Inspection of Mooring Hardware for Floating Structures", current_edition: "3rd Edition", current_year: 2015, domains: ["offshore", "subsea", "mooring"], materials: ["structural_steel", "chain", "wire_rope"], damage_modes: ["fatigue", "corrosion", "wear"], thresholds: {} },
  { body: "API", designation: "API RP 2MET", title: "Petroleum and Natural Gas Industries - Metocean", current_edition: "2nd Edition", current_year: 2014, domains: ["offshore", "metocean"], materials: [], damage_modes: [], thresholds: {} },
  { body: "API", designation: "API RP 1111", title: "Design, Construction, Operation, and Maintenance of Offshore Hydrocarbon Pipelines", current_edition: "5th Edition", current_year: 2015, domains: ["offshore", "pipelines", "subsea"], materials: ["carbon_steel", "CRA"], damage_modes: ["corrosion", "fatigue", "buckling"], thresholds: {} },

  // API — Safety
  { body: "API", designation: "API RP 14C", title: "Analysis, Design, Installation, and Testing of Safety Systems for Offshore Production Facilities", current_edition: "8th Edition", current_year: 2017, domains: ["offshore", "safety_systems"], materials: [], damage_modes: [], thresholds: {} },
  { body: "API", designation: "API RP 14J", title: "Design and Hazards Analysis for Offshore Production Facilities", current_edition: "2nd Edition", current_year: 2013, domains: ["offshore", "fire_blast"], materials: [], damage_modes: [], thresholds: {} },

  // API — Pipeline
  { body: "API", designation: "API 1104", title: "Welding of Pipelines and Related Facilities", current_edition: "22nd Edition", current_year: 2019, previous_edition: "21st Edition", previous_year: 2013, domains: ["pipelines", "welding"], materials: ["carbon_steel", "low_alloy"], damage_modes: ["weld_defects"], thresholds: {} },

  // ASME — Pressure
  { body: "ASME", designation: "ASME BPVC Section VIII Div 1", title: "Rules for Construction of Pressure Vessels", current_edition: "2023 Edition", current_year: 2023, domains: ["pressure_vessels"], materials: ["all"], damage_modes: ["all"], thresholds: {} },
  { body: "ASME", designation: "ASME BPVC Section V", title: "Nondestructive Examination", current_edition: "2023 Edition", current_year: 2023, domains: ["NDE", "all"], materials: ["all"], damage_modes: ["all"], thresholds: {} },
  { body: "ASME", designation: "ASME B31.3", title: "Process Piping", current_edition: "2022 Edition", current_year: 2022, domains: ["piping", "chemical", "refining"], materials: ["all"], damage_modes: ["all"], thresholds: {} },
  { body: "ASME", designation: "ASME B31.4", title: "Pipeline Transportation Systems for Liquids and Slurries", current_edition: "2022 Edition", current_year: 2022, domains: ["pipelines", "liquid_pipelines"], materials: ["carbon_steel"], damage_modes: ["corrosion", "fatigue"], thresholds: {} },
  { body: "ASME", designation: "ASME B31.8", title: "Gas Transmission and Distribution Piping Systems", current_edition: "2022 Edition", current_year: 2022, domains: ["pipelines", "gas_pipelines"], materials: ["carbon_steel"], damage_modes: ["corrosion", "fatigue", "SCC"], thresholds: {} },

  // DNV
  { body: "DNV", designation: "DNV-RP-C203", title: "Fatigue Design of Offshore Steel Structures", current_edition: "2021 Edition", current_year: 2021, previous_edition: "2019 Edition", previous_year: 2019, domains: ["offshore", "fatigue", "structural"], materials: ["structural_steel", "carbon_steel"], damage_modes: ["fatigue"], thresholds: { design_fatigue_factor_min: 1.0, inspection_accessible: 2.0, no_access_no_inspection: 10.0 } },
  { body: "DNV", designation: "DNV-RP-F101", title: "Corroded Pipelines", current_edition: "2019 Edition", current_year: 2019, previous_edition: "2017 Edition", previous_year: 2017, domains: ["pipelines", "subsea", "offshore"], materials: ["carbon_steel", "CRA"], damage_modes: ["corrosion", "metal_loss"], thresholds: { single_defect_method: "Part B", interacting_defects_method: "Part B Appendix" } },
  { body: "DNV", designation: "DNV-RP-F105", title: "Free Spanning Pipelines", current_edition: "2021 Edition", current_year: 2021, domains: ["pipelines", "subsea", "free_spans", "VIV"], materials: ["carbon_steel"], damage_modes: ["fatigue", "VIV", "buckling"], thresholds: { onset_reduced_velocity_inline: 1.0, onset_reduced_velocity_crossflow: 3.0 } },
  { body: "DNV", designation: "DNV-RP-F116", title: "Integrity Management of Submarine Pipeline Systems", current_edition: "2021 Edition", current_year: 2021, domains: ["pipelines", "subsea", "integrity_management"], materials: ["carbon_steel", "CRA"], damage_modes: ["corrosion", "fatigue", "buckling"], thresholds: {} },
  { body: "DNV", designation: "DNV-RP-B401", title: "Cathodic Protection Design", current_edition: "2021 Edition", current_year: 2021, domains: ["offshore", "subsea", "CP"], materials: ["carbon_steel", "structural_steel"], damage_modes: ["corrosion"], thresholds: { protection_potential_min_mV: -800, overprotection_limit_mV: -1100 } },

  // NACE / AMPP
  { body: "AMPP (formerly NACE)", designation: "SP0176 (formerly RP0176)", title: "Corrosion Control of Submerged Areas of Permanently Installed Steel Offshore Structures Associated with Petroleum Production", current_edition: "2019 Edition", current_year: 2019, note: "NACE rebranded to AMPP in 2021", domains: ["offshore", "CP", "subsea"], materials: ["carbon_steel", "structural_steel"], damage_modes: ["corrosion"], thresholds: { protection_criterion_mV: -800 } },
  { body: "AMPP (formerly NACE)", designation: "SP0775 (formerly RP0775)", title: "Preparation, Installation, Analysis, and Interpretation of Corrosion Coupons in Oilfield Operations", current_edition: "2023 Edition", current_year: 2023, domains: ["oil_gas", "corrosion_monitoring"], materials: ["carbon_steel"], damage_modes: ["corrosion"], thresholds: {} },
  { body: "AMPP (formerly NACE)", designation: "MR0175/ISO 15156", title: "Petroleum and Natural Gas Industries - Materials for Use in H2S-Containing Environments", current_edition: "2020 Edition", current_year: 2020, domains: ["sour_service", "oil_gas", "H2S"], materials: ["all"], damage_modes: ["SSC", "HIC", "SOHIC", "SCC"], thresholds: { h2s_threshold_kpa: 0.3, ph_limit: 3.5 } },

  // AWS
  { body: "AWS", designation: "AWS D1.1", title: "Structural Welding Code - Steel", current_edition: "2020 Edition", current_year: 2020, previous_edition: "2015 Edition", previous_year: 2015, domains: ["structural_welding", "civil", "buildings", "bridges"], materials: ["structural_steel", "carbon_steel"], damage_modes: ["weld_defects", "fatigue"], thresholds: {} },

  // BS
  { body: "BSI", designation: "BS 7608", title: "Fatigue Design and Assessment of Steel Products", current_edition: "2014 +A1:2015", current_year: 2015, domains: ["fatigue", "structural", "welded_joints"], materials: ["structural_steel", "carbon_steel"], damage_modes: ["fatigue"], thresholds: {} },

  // ISO
  { body: "ISO", designation: "ISO 10816-1", title: "Mechanical Vibration - Evaluation of Machine Vibration", current_edition: "1995 Edition", current_year: 1995, note: "Being replaced by ISO 20816 series", superseded_by: "ISO 20816-1:2016", domains: ["vibration", "machinery", "rotating_equipment"], materials: [], damage_modes: ["vibration"], thresholds: { zone_A_mms: 2.8, zone_B_mms: 7.1, zone_C_mms: 18.0 } },
  { body: "ISO", designation: "ISO 20816-1", title: "Mechanical Vibration - Measurement and Evaluation of Machine Vibration", current_edition: "2016 Edition", current_year: 2016, domains: ["vibration", "machinery"], materials: [], damage_modes: ["vibration"], thresholds: {} },

  // NFPA
  { body: "NFPA", designation: "NFPA 15", title: "Standard for Water Spray Fixed Systems for Fire Protection", current_edition: "2022 Edition", current_year: 2022, domains: ["fire_protection", "offshore", "onshore"], materials: [], damage_modes: [], thresholds: {} }
];

// ============================================================
// RESOLVER — find best match for a vague reference
// ============================================================
function resolveStandard(query) {
  var q = (query || "").toUpperCase().replace(/\s+/g, " ").trim();
  var bestMatch = null;
  var bestScore = 0;

  for (var i = 0; i < STANDARDS_DB.length; i++) {
    var std = STANDARDS_DB[i];
    var score = 0;
    var desig = std.designation.toUpperCase();
    var body = std.body.toUpperCase();

    // Exact designation match
    if (q === desig || q === desig.replace(/ /g, "")) { score = 100; }
    // Partial designation match
    else if (q.indexOf(desig) >= 0 || desig.indexOf(q) >= 0) { score = 80; }
    // Body + number match
    else {
      // Extract numbers from query
      var qNums = q.match(/\d+/g) || [];
      var dNums = desig.match(/\d+/g) || [];
      for (var n = 0; n < qNums.length; n++) {
        for (var dn = 0; dn < dNums.length; dn++) {
          if (qNums[n] === dNums[dn]) score = score + 30;
        }
      }
      // Body name match
      if (q.indexOf(body) >= 0 || q.indexOf(body.split(" ")[0]) >= 0) score = score + 20;
      // Keywords in title
      var titleWords = std.title.toUpperCase().split(" ");
      var qWords = q.split(" ");
      for (var tw = 0; tw < titleWords.length; tw++) {
        for (var qw = 0; qw < qWords.length; qw++) {
          if (titleWords[tw].length > 3 && qWords[qw].length > 3 && titleWords[tw] === qWords[qw]) score = score + 10;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = std;
    }
  }

  if (!bestMatch || bestScore < 20) {
    return { resolved: false, query: query, message: "No matching standard found in registry", suggestion: "Check designation or use get_full_registry to browse" };
  }

  return {
    resolved: true,
    query: query,
    match_confidence: bestScore >= 80 ? "HIGH" : bestScore >= 50 ? "MEDIUM" : "LOW",
    standard: {
      body: bestMatch.body,
      designation: bestMatch.designation,
      title: bestMatch.title,
      current_edition: bestMatch.current_edition,
      current_year: bestMatch.current_year,
      previous_edition: bestMatch.previous_edition || null,
      previous_year: bestMatch.previous_year || null,
      superseded_by: bestMatch.superseded_by || null,
      note: bestMatch.note || null
    }
  };
}

// ============================================================
// HANDLER
// ============================================================
export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";

    if (action === "get_registry") {
      return ok({
        engine: "live-code-authority",
        version: ENGINE_VERSION,
        description: "Hardcoded standards edition registry. Resolves vague references to exact editions. Verifies currency. Eliminates 'edition TBD' failures in the governance lock.",
        actions: ["get_registry", "resolve_standard", "check_edition", "get_applicable_codes", "get_supersession", "get_thresholds", "validate_references", "get_full_registry"],
        standards_count: STANDARDS_DB.length,
        bodies: ["API", "API/ASME", "ASME", "DNV", "AMPP (formerly NACE)", "AWS", "BSI", "ISO", "NFPA"],
        last_updated: "2026-04-21",
        status: "operational"
      });
    }

    if (action === "resolve_standard") {
      if (!body.query) return errResp(400, "query required (e.g., 'API RP 2A', 'DNV-RP-F101', 'NACE SP0176')");
      var resolved = resolveStandard(body.query);
      return ok({ engine: "live-code-authority", result: resolved });
    }

    if (action === "check_edition") {
      if (!body.designation || !body.edition_year) return errResp(400, "designation and edition_year required");
      var found = null;
      var desigUp = body.designation.toUpperCase().replace(/\s+/g, " ").trim();
      for (var i = 0; i < STANDARDS_DB.length; i++) {
        if (STANDARDS_DB[i].designation.toUpperCase() === desigUp || STANDARDS_DB[i].designation.toUpperCase().replace(/ /g, "") === desigUp.replace(/ /g, "")) {
          found = STANDARDS_DB[i];
          break;
        }
      }
      if (!found) return ok({ engine: "live-code-authority", designation: body.designation, status: "NOT_IN_REGISTRY", message: "Standard not found in registry" });

      var isCurrent = found.current_year === body.edition_year || (found.addendum_year && found.addendum_year === body.edition_year);
      return ok({
        engine: "live-code-authority",
        designation: body.designation,
        cited_year: body.edition_year,
        current_year: found.current_year,
        current_edition: found.current_edition,
        is_current: isCurrent,
        is_superseded: !isCurrent,
        superseded_by: found.superseded_by || null,
        status: isCurrent ? "CURRENT" : "SUPERSEDED",
        impact: isCurrent ? "None — cited edition is current" : "CRITICAL — cited edition is superseded. Requirements may have changed."
      });
    }

    if (action === "get_applicable_codes") {
      var domain = (body.domain || "").toLowerCase();
      var material = (body.material || "").toLowerCase();
      var damageMode = (body.damage_mode || "").toLowerCase();
      var results = [];

      for (var j = 0; j < STANDARDS_DB.length; j++) {
        var std = STANDARDS_DB[j];
        var match = false;

        if (domain) {
          for (var d = 0; d < std.domains.length; d++) {
            if (std.domains[d].indexOf(domain) >= 0 || domain.indexOf(std.domains[d]) >= 0) { match = true; break; }
          }
        }
        if (material && !match) {
          for (var m = 0; m < std.materials.length; m++) {
            if (std.materials[m].indexOf(material) >= 0 || material.indexOf(std.materials[m]) >= 0 || std.materials[m] === "all") { match = true; break; }
          }
        }
        if (damageMode && !match) {
          for (var dm = 0; dm < std.damage_modes.length; dm++) {
            if (std.damage_modes[dm].indexOf(damageMode) >= 0 || damageMode.indexOf(std.damage_modes[dm]) >= 0 || std.damage_modes[dm] === "all") { match = true; break; }
          }
        }

        if (match) {
          results.push({
            body: std.body,
            designation: std.designation,
            title: std.title,
            current_edition: std.current_edition,
            current_year: std.current_year,
            applicability: { domain_match: domain ? true : false, material_match: material ? true : false, damage_mode_match: damageMode ? true : false }
          });
        }
      }

      return ok({ engine: "live-code-authority", query: { domain: domain, material: material, damage_mode: damageMode }, result_count: results.length, applicable_codes: results });
    }

    if (action === "get_supersession") {
      if (!body.designation) return errResp(400, "designation required");
      var chain = [];
      var desig2 = body.designation.toUpperCase().replace(/\s+/g, " ").trim();
      for (var k = 0; k < STANDARDS_DB.length; k++) {
        var s = STANDARDS_DB[k];
        if (s.designation.toUpperCase() === desig2 || s.designation.toUpperCase().replace(/ /g, "") === desig2.replace(/ /g, "")) {
          if (s.previous_edition) chain.push({ edition: s.previous_edition, year: s.previous_year, status: "SUPERSEDED" });
          chain.push({ edition: s.current_edition, year: s.current_year, status: s.superseded_by ? "SUPERSEDED" : "CURRENT" });
          if (s.superseded_by) chain.push({ designation: s.superseded_by, status: "REPLACEMENT" });
          break;
        }
      }
      if (chain.length === 0) return ok({ engine: "live-code-authority", designation: body.designation, message: "Not found in registry" });
      return ok({ engine: "live-code-authority", designation: body.designation, supersession_chain: chain });
    }

    if (action === "get_thresholds") {
      if (!body.designation) return errResp(400, "designation required");
      var desig3 = body.designation.toUpperCase().replace(/\s+/g, " ").trim();
      for (var l = 0; l < STANDARDS_DB.length; l++) {
        if (STANDARDS_DB[l].designation.toUpperCase() === desig3 || STANDARDS_DB[l].designation.toUpperCase().replace(/ /g, "") === desig3.replace(/ /g, "")) {
          return ok({ engine: "live-code-authority", designation: body.designation, title: STANDARDS_DB[l].title, current_edition: STANDARDS_DB[l].current_edition, thresholds: STANDARDS_DB[l].thresholds || {} });
        }
      }
      return ok({ engine: "live-code-authority", designation: body.designation, message: "Not found in registry" });
    }

    if (action === "validate_references") {
      var refs = body.references || [];
      if (refs.length === 0) return errResp(400, "references array required");
      var validations = [];
      var failCount = 0;
      for (var r = 0; r < refs.length; r++) {
        var ref = refs[r];
        var resolved2 = resolveStandard(typeof ref === "string" ? ref : ref.designation);
        var status = "PASS";
        var detail = "";
        if (!resolved2.resolved) { status = "FAIL"; detail = "Not found in registry"; failCount++; }
        else if (ref.edition_year && resolved2.standard.current_year !== ref.edition_year) { status = "WARN"; detail = "Cited " + ref.edition_year + " but current is " + resolved2.standard.current_year; }
        else if (!ref.edition_year) { status = "WARN"; detail = "No edition cited — current is " + resolved2.standard.current_edition; }
        validations.push({
          input: typeof ref === "string" ? ref : ref.designation,
          status: status,
          detail: detail,
          resolved: resolved2.resolved ? resolved2.standard : null
        });
      }
      return ok({ engine: "live-code-authority", total: refs.length, pass: refs.length - failCount, fail: failCount, validations: validations });
    }

    if (action === "get_full_registry") {
      return ok({ engine: "live-code-authority", standards_count: STANDARDS_DB.length, standards: STANDARDS_DB });
    }

    return errResp(400, "Unknown action: " + action + ". Use get_registry for available actions.");
  } catch (err) {
    return errResp(500, String(err && err.message ? err.message : err));
  }
};
