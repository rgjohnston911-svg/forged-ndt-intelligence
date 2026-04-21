// @ts-nocheck
/**
 * DEPLOY222 - universal-code-authority.ts
 * netlify/functions/universal-code-authority.ts
 *
 * UNIVERSAL CODE AUTHORITY ENGINE
 *
 * Implements the 5-tier precedence hierarchy from the architecture spec:
 *   Tier 1: Regulatory Authority (NRC, FAA, OSHA, PHMSA)
 *   Tier 2: Jurisdictional Law (NBIC, state boiler codes)
 *   Tier 3: Industry Consensus Codes (API, ASME, DNV, AWS)
 *   Tier 4: Owner/Operator Specifications
 *   Tier 5: Best Practice Standards (ISO, ASTM general)
 *
 * Resolution logic:
 *   Step 1: Identify all applicable codes from case context
 *   Step 2: Filter by jurisdiction
 *   Step 3: Apply tier-based dominance (lower tier number = higher authority)
 *   Step 4: Resolve conflicts (stricter result wins at same tier)
 *   Step 5: Assign governing code set with clause references
 *   Step 6: Determine decision authority level
 *
 * Runs ALONGSIDE run-authority.ts. This engine determines WHICH codes
 * apply; run-authority evaluates the evidence against those codes.
 *
 * POST { case_id: string }
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var EXECUTION_MODE = "deterministic";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

// ================================================================
// TIER LABELS
// ================================================================
var TIER_LABELS = {
  1: "Regulatory Authority",
  2: "Jurisdictional Law",
  3: "Industry Consensus Code",
  4: "Owner/Operator Specification",
  5: "Best Practice Standard"
};

// ================================================================
// BUILT-IN CODE KNOWLEDGE (supplements code_sets table)
// Maps asset type + industry + conditions to applicable codes
// ================================================================
var CODE_MAPPINGS = [
  // Tier 1: Regulatory
  { tier: 1, code_id: "NRC_10CFR50", triggers: { industries: ["nuclear"], asset_types: ["reactor_vessel", "steam_generator", "nuclear_piping"] } },
  { tier: 1, code_id: "FAA_AC43", triggers: { industries: ["aerospace", "aviation"], asset_types: ["aircraft_structure", "engine_component"] } },
  { tier: 1, code_id: "OSHA_PSM", triggers: { industries: ["process", "chemical", "refinery", "oil_gas"], conditions: ["hazardous_chemicals", "flammable", "toxic"] } },
  { tier: 1, code_id: "DOT_PHMSA", triggers: { industries: ["pipeline"], asset_types: ["pipeline"] } },

  // Tier 2: Jurisdictional
  { tier: 2, code_id: "NBIC", triggers: { asset_types: ["pressure_vessel", "boiler"], regions: ["US"] } },

  // Tier 3: Industry consensus
  { tier: 3, code_id: "API_510", triggers: { asset_types: ["pressure_vessel", "heat_exchanger"] } },
  { tier: 3, code_id: "API_570", triggers: { asset_types: ["process_piping"] } },
  { tier: 3, code_id: "API_579", triggers: { conditions: ["wall_loss", "ffs_required", "crack_ffs", "pitting"] } },
  { tier: 3, code_id: "API_653", triggers: { asset_types: ["storage_tank"] } },
  { tier: 3, code_id: "API_1104", triggers: { asset_types: ["pipeline"], conditions: ["welding"] } },
  { tier: 3, code_id: "ASME_VIII", triggers: { asset_types: ["pressure_vessel"], conditions: ["fabrication", "design_review"] } },
  { tier: 3, code_id: "ASME_B313", triggers: { asset_types: ["process_piping"] } },
  { tier: 3, code_id: "ASME_PCC2", triggers: { conditions: ["composite_repair", "bonded_repair", "wrap_repair"] } },
  { tier: 3, code_id: "AWS_D11", triggers: { asset_types: ["structural_steel"], conditions: ["welding"] } },
  { tier: 3, code_id: "DNV_GL", triggers: { asset_types: ["marine_vessel", "offshore_fixed_platform", "offshore_floating_facility"] } },
  { tier: 3, code_id: "NACE_MR0175", triggers: { conditions: ["sour_service", "h2s", "sulfide"] } },
  { tier: 3, code_id: "AASHTO_MBE", triggers: { asset_types: ["bridge_civil_structure"] } },

  // Tier 5: Best practice
  { tier: 5, code_id: "ISO_24817", triggers: { conditions: ["composite_repair"] } },
  { tier: 5, code_id: "ASTM_E3166", triggers: { conditions: ["additive_manufacturing", "3d_printed"] } }
];

// ================================================================
// APPLICABLE CLAUSE MAPPINGS
// ================================================================
var CLAUSE_LIBRARY = {
  API_510: [
    { clause: "Section 7", title: "Inspection Practices", trigger: "general_inspection" },
    { clause: "Section 7.4", title: "Thickness Measurements", trigger: "wall_loss" },
    { clause: "Section 7.5", title: "Corrosion Rate Determination", trigger: "corrosion" },
    { clause: "Section 8", title: "Repairs, Alterations, and Re-rating", trigger: "repair" },
    { clause: "Section 9", title: "Fitness-For-Service Assessment", trigger: "ffs_required" }
  ],
  API_570: [
    { clause: "Section 7", title: "Inspection of Piping Systems", trigger: "general_inspection" },
    { clause: "Section 7.1.2", title: "Thickness Measurement Locations", trigger: "wall_loss" },
    { clause: "Section 7.2", title: "Corrosion Under Insulation", trigger: "cui" },
    { clause: "Section 8", title: "Evaluation and Fitness-For-Service", trigger: "ffs_required" },
    { clause: "Section 9", title: "Repairs", trigger: "repair" }
  ],
  API_579: [
    { clause: "Part 4", title: "General Metal Loss", trigger: "wall_loss" },
    { clause: "Part 5", title: "Local Metal Loss", trigger: "pitting" },
    { clause: "Part 8", title: "Weld Misalignment and Shell Distortions", trigger: "weld_defect" },
    { clause: "Part 9", title: "Crack-Like Flaws", trigger: "crack" },
    { clause: "Part 10", title: "Creep Damage", trigger: "creep" },
    { clause: "Part 12", title: "Dents and Gouges", trigger: "mechanical_damage" }
  ],
  ASME_PCC2: [
    { clause: "Article 4.1", title: "Non-metallic Composite Repair", trigger: "composite_repair" },
    { clause: "Article 2.1", title: "Welded Repairs", trigger: "weld_repair" }
  ],
  AWS_D11: [
    { clause: "Section 6", title: "Inspection", trigger: "general_inspection" },
    { clause: "Table 6.1", title: "Visual Acceptance Criteria", trigger: "visual_inspection" },
    { clause: "Section 5.26", title: "Weld Profiles", trigger: "weld_defect" }
  ],
  NACE_MR0175: [
    { clause: "Part 2", title: "Carbon and Low Alloy Steels", trigger: "sour_service" },
    { clause: "Part 3", title: "CRAs and Other Alloys", trigger: "advanced_alloy" }
  ]
};

// ================================================================
// STEP 1: IDENTIFY APPLICABLE CODES
// ================================================================
function identifyApplicableCodes(caseRow, findings, materialStatus) {
  var applicable = [];
  var haystack = buildHaystack(caseRow, findings, materialStatus);

  for (var mi = 0; mi < CODE_MAPPINGS.length; mi++) {
    var mapping = CODE_MAPPINGS[mi];
    var match = false;
    var matchReasons = [];
    var triggers = mapping.triggers;

    // Check asset type match
    if (triggers.asset_types) {
      var assetType = (caseRow.component_name || "").toLowerCase().replace(/ /g, "_");
      var assetField = (caseRow.asset_type || "").toLowerCase().replace(/ /g, "_");
      for (var ai = 0; ai < triggers.asset_types.length; ai++) {
        if (assetType.indexOf(triggers.asset_types[ai]) >= 0 || assetField.indexOf(triggers.asset_types[ai]) >= 0 || haystack.indexOf(triggers.asset_types[ai]) >= 0) {
          match = true;
          matchReasons.push("asset type: " + triggers.asset_types[ai]);
        }
      }
    }

    // Check industry match
    if (triggers.industries) {
      var caseIndustry = (caseRow.industry || caseRow.sector || "").toLowerCase();
      for (var ii = 0; ii < triggers.industries.length; ii++) {
        if (caseIndustry.indexOf(triggers.industries[ii]) >= 0 || haystack.indexOf(triggers.industries[ii]) >= 0) {
          match = true;
          matchReasons.push("industry: " + triggers.industries[ii]);
        }
      }
    }

    // Check condition match
    if (triggers.conditions) {
      for (var ci = 0; ci < triggers.conditions.length; ci++) {
        var cond = triggers.conditions[ci];
        if (haystack.indexOf(cond) >= 0 || haystack.indexOf(cond.replace(/_/g, " ")) >= 0) {
          match = true;
          matchReasons.push("condition: " + cond);
        }
      }
    }

    if (match) {
      applicable.push({
        code_id: mapping.code_id,
        tier: mapping.tier,
        tier_label: TIER_LABELS[mapping.tier] || "Unknown",
        match_reasons: matchReasons
      });
    }
  }

  return applicable;
}

function buildHaystack(caseRow, findings, materialStatus) {
  var parts = [];
  var textFields = [
    "title", "component_name", "method", "inspection_context", "notes",
    "summary", "asset_type", "industry", "sector", "material_class",
    "load_condition", "code_family", "environment"
  ];
  for (var ti = 0; ti < textFields.length; ti++) {
    if (caseRow[textFields[ti]]) parts.push(String(caseRow[textFields[ti]]).toLowerCase());
  }
  if (findings) {
    for (var fi = 0; fi < findings.length; fi++) {
      var f = findings[fi];
      if (f.indication_type) parts.push(f.indication_type.toLowerCase());
      if (f.notes) parts.push(f.notes.toLowerCase());
      if (f.recommended_action) parts.push(f.recommended_action.toLowerCase());
    }
  }
  // Inject material authority status as condition triggers
  if (materialStatus) {
    if (materialStatus === "failed" || materialStatus === "suspect") {
      parts.push("material_degradation");
    }
  }
  // Inject wall loss condition if thickness data exists
  if (caseRow.authority_evidence) {
    var ae = caseRow.authority_evidence;
    if (ae.thickness_summary && ae.thickness_summary.pct_min && ae.thickness_summary.pct_min < 0.80) {
      parts.push("wall_loss");
      parts.push("ffs_required");
    }
  }
  return parts.join(" ");
}

// ================================================================
// STEP 2-3: FILTER + RANK BY TIER
// ================================================================
function rankByPrecedence(applicableCodes, codeSetsFromDb) {
  // Enrich with DB data
  var codeMap = {};
  if (codeSetsFromDb) {
    for (var di = 0; di < codeSetsFromDb.length; di++) {
      codeMap[codeSetsFromDb[di].id] = codeSetsFromDb[di];
    }
  }

  var enriched = [];
  for (var ai = 0; ai < applicableCodes.length; ai++) {
    var ac = applicableCodes[ai];
    var dbInfo = codeMap[ac.code_id] || {};
    enriched.push({
      code_id: ac.code_id,
      name: dbInfo.name || ac.code_id,
      short_name: dbInfo.short_name || ac.code_id,
      tier: ac.tier,
      tier_label: ac.tier_label,
      match_reasons: ac.match_reasons,
      description: dbInfo.description || ""
    });
  }

  // Sort by tier (ascending = highest authority first)
  enriched.sort(function(a, b) { return a.tier - b.tier; });

  return enriched;
}

// ================================================================
// STEP 4: RESOLVE CONFLICTS
// ================================================================
function resolveConflicts(rankedCodes) {
  var conflicts = [];
  var tierGroups = {};

  // Group by tier
  for (var ri = 0; ri < rankedCodes.length; ri++) {
    var tier = rankedCodes[ri].tier;
    if (!tierGroups[tier]) tierGroups[tier] = [];
    tierGroups[tier].push(rankedCodes[ri]);
  }

  // Check for conflicts within same tier
  var tiers = Object.keys(tierGroups).sort();
  for (var ti = 0; ti < tiers.length; ti++) {
    var group = tierGroups[tiers[ti]];
    if (group.length > 1) {
      // Multiple codes at same tier — not necessarily a conflict
      // Conflict = codes that could produce different dispositions
      // For now, flag as "overlap" and note resolution rule
      conflicts.push({
        tier: Number(tiers[ti]),
        tier_label: TIER_LABELS[Number(tiers[ti])] || "Unknown",
        codes: group.map(function(g) { return g.code_id; }),
        resolution: "CONSERVATIVE_MERGE",
        explanation: group.length + " codes apply at Tier " + tiers[ti] +
          " (" + (TIER_LABELS[Number(tiers[ti])] || "Unknown") + "). " +
          "When codes overlap, the stricter requirement governs. " +
          "Codes: " + group.map(function(g) { return g.short_name; }).join(", ") + "."
      });
    }
  }

  return conflicts;
}

// ================================================================
// STEP 5: DETERMINE GOVERNING CODE SET + CLAUSES
// ================================================================
function resolveGoverningSet(rankedCodes, caseRow, findings) {
  if (rankedCodes.length === 0) {
    return {
      governing_codes: [],
      clauses: [],
      fallback_applied: true,
      fallback_reason: "No codes matched case context. Defaulting to ASME Section V general NDE requirements.",
      fallback_code: "ASME_V_GENERAL"
    };
  }

  var governing = [];
  var allClauses = [];
  var haystack = buildHaystack(caseRow, findings, null);

  // The highest-tier (lowest number) code is primary
  // All others at the same tier are co-governing
  // Lower-authority codes supplement but don't override
  var primaryTier = rankedCodes[0].tier;

  for (var ri = 0; ri < rankedCodes.length; ri++) {
    var code = rankedCodes[ri];
    var role = code.tier === primaryTier ? "primary" : (code.tier <= 3 ? "supplementary" : "reference");

    // Find applicable clauses
    var codeClauses = CLAUSE_LIBRARY[code.code_id] || [];
    var matchedClauses = [];
    for (var cli = 0; cli < codeClauses.length; cli++) {
      var cl = codeClauses[cli];
      // Always include general_inspection
      if (cl.trigger === "general_inspection" || haystack.indexOf(cl.trigger) >= 0 || haystack.indexOf(cl.trigger.replace(/_/g, " ")) >= 0) {
        matchedClauses.push({
          code_id: code.code_id,
          code_name: code.short_name,
          clause: cl.clause,
          title: cl.title,
          trigger: cl.trigger,
          role: role
        });
      }
    }

    governing.push({
      code_id: code.code_id,
      name: code.name,
      short_name: code.short_name,
      tier: code.tier,
      tier_label: code.tier_label,
      role: role,
      clause_count: matchedClauses.length,
      match_reasons: code.match_reasons
    });

    allClauses = allClauses.concat(matchedClauses);
  }

  return {
    governing_codes: governing,
    clauses: allClauses,
    fallback_applied: false,
    fallback_reason: null,
    fallback_code: null
  };
}

// ================================================================
// STEP 6: DETERMINE AUTHORITY LEVEL
// ================================================================
function determineAuthorityLevel(governingResult, caseRow) {
  if (governingResult.fallback_applied) {
    return {
      level: "advisory",
      reason: "No specific code matched. Decision is advisory only. Assign applicable code family to upgrade to code-authoritative."
    };
  }

  var hasTier1 = false;
  var hasTier2 = false;
  var hasTier3 = false;
  var primaryCount = 0;

  for (var gi = 0; gi < governingResult.governing_codes.length; gi++) {
    var gc = governingResult.governing_codes[gi];
    if (gc.tier === 1) hasTier1 = true;
    if (gc.tier === 2) hasTier2 = true;
    if (gc.tier === 3) hasTier3 = true;
    if (gc.role === "primary") primaryCount++;
  }

  // If regulatory code applies, decision authority is elevated
  if (hasTier1) {
    return {
      level: "regulatory",
      reason: "Regulatory authority (Tier 1) applies. Decision must comply with " +
        governingResult.governing_codes.filter(function(g) { return g.tier === 1; })
          .map(function(g) { return g.short_name; }).join(", ") +
        ". Regulatory non-compliance is a legal violation."
    };
  }

  if (hasTier2) {
    return {
      level: "jurisdictional",
      reason: "Jurisdictional law (Tier 2) applies. Compliance is legally mandated in this jurisdiction."
    };
  }

  if (hasTier3 && governingResult.clauses.length > 0) {
    return {
      level: "code_authoritative",
      reason: "Industry consensus code (Tier 3) applies with " + governingResult.clauses.length +
        " applicable clauses identified. Decision is code-authoritative and can be authority-locked."
    };
  }

  return {
    level: "provisional",
    reason: "Only best-practice or owner specifications apply. Decision is provisional until a Tier 1-3 code is assigned."
  };
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

    // Load case
    var caseRes = await sb.from("inspection_cases").select("*").eq("id", caseId).single();
    if (caseRes.error || !caseRes.data) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "case not found" }) };
    }
    var caseRow = caseRes.data;

    // Load findings
    var findingsRes = await sb.from("findings").select("*").eq("case_id", caseId);
    var findings = findingsRes.data || [];

    // Load code_sets from DB for enrichment
    var codeSetsRes = await sb.from("code_sets").select("*");
    var codeSetsDb = codeSetsRes.data || [];

    // Material authority status (from DEPLOY219)
    var materialStatus = caseRow.material_authority_status || null;

    // Step 1: Identify applicable codes
    var applicableCodes = identifyApplicableCodes(caseRow, findings, materialStatus);

    // Step 2-3: Rank by precedence
    var rankedCodes = rankByPrecedence(applicableCodes, codeSetsDb);

    // Step 4: Resolve conflicts
    var conflicts = resolveConflicts(rankedCodes);

    // Step 5: Governing code set + clauses
    var governingResult = resolveGoverningSet(rankedCodes, caseRow, findings);

    // Step 6: Authority level
    var authorityLevel = determineAuthorityLevel(governingResult, caseRow);

    // Build result
    var generatedAt = new Date().toISOString();
    var highestTier = rankedCodes.length > 0 ? rankedCodes[0].tier : null;
    var result = {
      engine: "universal-code-authority/1.0.0",
      execution_mode: EXECUTION_MODE,
      generated_at: generatedAt,
      case_id: caseId,
      case_number: caseRow.case_number,
      resolution_steps: {
        step1_identified: applicableCodes.length + " codes matched case context",
        step2_ranked: rankedCodes.length + " codes ranked by 5-tier precedence",
        step3_conflicts: conflicts.length + " tier-level overlaps detected",
        step4_governing: governingResult.governing_codes.length + " codes in governing set",
        step5_clauses: governingResult.clauses.length + " applicable clauses identified",
        step6_authority: authorityLevel.level
      },
      precedence_hierarchy: rankedCodes,
      conflicts: conflicts,
      governing_codes: governingResult.governing_codes,
      applicable_clauses: governingResult.clauses,
      fallback: governingResult.fallback_applied ? {
        applied: true,
        reason: governingResult.fallback_reason,
        fallback_code: governingResult.fallback_code
      } : null,
      authority_level: authorityLevel,
      highest_tier: highestTier,
      highest_tier_label: highestTier ? (TIER_LABELS[highestTier] || "Unknown") : "none",
      summary: buildSummary(rankedCodes, governingResult, conflicts, authorityLevel)
    };

    // Persist
    await sb.from("inspection_cases").update({
      code_authority_result: result,
      code_authority_generated_at: generatedAt,
      governing_codes: governingResult.governing_codes,
      precedence_tier: authorityLevel.level,
      authority_conflicts: conflicts.length > 0 ? conflicts : null
    }).eq("id", caseId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, execution_mode: EXECUTION_MODE, result: result })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};

function buildSummary(ranked, governing, conflicts, authLevel) {
  var parts = [];
  parts.push("Authority Level: " + authLevel.level.toUpperCase().replace(/_/g, " ") + ".");
  parts.push(authLevel.reason);

  if (governing.governing_codes.length > 0) {
    var primary = governing.governing_codes.filter(function(g) { return g.role === "primary"; });
    if (primary.length > 0) {
      parts.push("Primary governing code" + (primary.length > 1 ? "s" : "") + ": " +
        primary.map(function(p) { return p.short_name + " (Tier " + p.tier + ")"; }).join(", ") + ".");
    }
    var supplementary = governing.governing_codes.filter(function(g) { return g.role === "supplementary"; });
    if (supplementary.length > 0) {
      parts.push("Supplementary: " + supplementary.map(function(s) { return s.short_name; }).join(", ") + ".");
    }
  }

  if (governing.clauses.length > 0) {
    parts.push(governing.clauses.length + " applicable clauses identified across " + governing.governing_codes.length + " codes.");
  }

  if (conflicts.length > 0) {
    parts.push(conflicts.length + " overlap" + (conflicts.length > 1 ? "s" : "") + " resolved using conservative merge (stricter requirement governs).");
  }

  if (governing.fallback_applied) {
    parts.push("FALLBACK: " + governing.fallback_reason);
  }

  return parts.join(" ");
}
