// @ts-nocheck
/**
 * DEPLOY264 - reality-lock-domain.ts
 * netlify/functions/reality-lock-domain.ts
 *
 * REALITY LOCK DOMAIN GATING v1.0.0
 * "Does the system ACTUALLY know enough to evaluate this combination?"
 *
 * Declares which process x position x material x code combinations
 * are supported, limited, or unsupported. Refuses to fake an answer.
 *
 * 10 actions:
 *   get_registry         — engine overview
 *   gate_check           — validate a combination, return proceed/warn/degrade/block
 *   get_combinations     — list all registered combinations with filtering
 *   get_gaps             — list all known domain gaps
 *   get_coverage_matrix  — full coverage matrix for a code family
 *   get_support_summary  — summary stats of what is supported
 *   add_combination      — register a new supported combination
 *   report_gap           — report a new domain gap
 *   resolve_gap          — mark a gap as resolved
 *   get_gate_history     — audit trail of gate checks
 *
 * var only. String concatenation only. No backticks.
 */

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function ok(body) {
  return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) };
}
function errResp(code, msg) {
  return { statusCode: code, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
}

// ============================================================
// Gate Decision Logic
// ============================================================
function determineGateResult(combo, gaps) {
  // If no combination found at all
  if (!combo) {
    if (gaps.length > 0) {
      var hasBlocking = false;
      for (var g = 0; g < gaps.length; g++) {
        if (gaps[g].severity === "blocking") { hasBlocking = true; break; }
      }
      if (hasBlocking) return "blocked";
      return "degraded_mode";
    }
    return "degraded_mode";
  }

  var support = combo.support_level;
  var confidence = combo.confidence_pct;

  if (support === "unsupported") return "blocked";
  if (support === "experimental") return "degraded_mode";
  if (support === "limited" || confidence < 70) return "proceed_with_warnings";
  if (support === "validated" && confidence >= 80) return "proceed_with_warnings";
  if (support === "full" && confidence >= 90) return "proceed";
  return "proceed_with_warnings";
}

function buildGateMessage(gateResult, combo, gaps, input) {
  var process = input.process || "unknown";
  var position = input.position || "unknown";
  var material = input.material || "unknown";
  var code = input.code_family || "unknown";
  var label = process + " / " + position + " / " + material + " / " + code;

  if (gateResult === "proceed") {
    return "PROCEED: " + label + " is fully supported (confidence " + (combo ? combo.confidence_pct : 0) + "%). Evaluation will use full physics model and code-traced acceptance criteria.";
  }
  if (gateResult === "proceed_with_warnings") {
    var warnings = [];
    if (combo && combo.limitations) {
      for (var w = 0; w < combo.limitations.length; w++) {
        warnings.push(combo.limitations[w]);
      }
    }
    return "PROCEED WITH CAUTION: " + label + " is supported at " + (combo ? combo.support_level : "limited") + " level (confidence " + (combo ? combo.confidence_pct : 0) + "%). " + (warnings.length > 0 ? "Limitations: " + warnings.join("; ") : "Some limitations may apply.");
  }
  if (gateResult === "degraded_mode") {
    return "DEGRADED MODE: " + label + " has limited system coverage. Evaluation will proceed with reduced confidence. Results should be verified by qualified personnel.";
  }
  if (gateResult === "blocked") {
    var blockReasons = [];
    for (var bg = 0; bg < gaps.length; bg++) {
      blockReasons.push(gaps[bg].description);
    }
    return "BLOCKED: " + label + " is not supported by the evaluation system. " + (blockReasons.length > 0 ? "Reason: " + blockReasons[0] : "No physics model, acceptance criteria, or training data available for this combination.") + " Do NOT rely on system evaluation for this combination.";
  }
  return "Unknown gate result";
}

export var handler: Handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return errResp(405, "POST only");

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "";
    var sb = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // ACTION: get_registry
    // ============================================================
    if (action === "get_registry") {
      return ok({
        engine: "reality-lock-domain",
        version: "1.0.0",
        deploy: "DEPLOY264",
        mode: "deterministic",
        description: "Declares which process x position x material x code combinations the system supports. Refuses to fake an answer for unsupported combinations.",
        capabilities: [
          "get_registry — engine overview",
          "gate_check — validate a combination: proceed / proceed_with_warnings / degraded_mode / blocked",
          "get_combinations — list all registered domain combinations with filtering",
          "get_gaps — list all known domain gaps (things the system cannot do)",
          "get_coverage_matrix — full coverage matrix for a code family showing all process/position/material support levels",
          "get_support_summary — summary statistics of coverage",
          "add_combination — register a new supported combination",
          "report_gap — report a new domain gap",
          "resolve_gap — mark a gap as resolved",
          "get_gate_history — audit trail of all gate checks"
        ],
        support_levels: {
          full: "Code coverage + physics model + acceptance criteria + repair pathways. Confidence 90-100%.",
          validated: "Covered and tested but some edge cases may exist. Confidence 80-95%.",
          limited: "Partial coverage — known limitations that may affect accuracy. Confidence 60-80%.",
          experimental: "Minimal coverage — results are estimates only. Confidence 30-60%.",
          unsupported: "No coverage — system will not evaluate. Confidence 0%."
        },
        gate_results: {
          proceed: "Full support — evaluation uses complete physics model",
          proceed_with_warnings: "Supported with known limitations — warnings displayed",
          degraded_mode: "Limited coverage — reduced confidence, manual verification recommended",
          blocked: "Not supported — system refuses to evaluate"
        },
        principle: "Honest about what we know and what we do not. Better to say 'I cannot reliably evaluate this' than to produce a confident-sounding wrong answer."
      });
    }

    // ============================================================
    // ACTION: gate_check
    // The core action — validate a combination
    // ============================================================
    if (action === "gate_check") {
      var process = body.process || "";
      var position = body.position || "";
      var material = body.material || "";
      var codeFamily = body.code_family || "";
      var assessmentId = body.assessment_id || null;
      var caseId = body.case_id || null;
      var orgId = body.org_id || null;

      if (!process) return errResp(400, "process required");
      if (!position) return errResp(400, "position required");
      if (!material) return errResp(400, "material required");
      if (!codeFamily) return errResp(400, "code_family required");

      // Look for exact match first
      var exactResult = await sb.from("domain_combination_registry")
        .select("*")
        .eq("process", process)
        .eq("position", position)
        .eq("material", material)
        .eq("code_family", codeFamily)
        .eq("is_active", true)
        .limit(1);

      var combo = (exactResult.data && exactResult.data.length > 0) ? exactResult.data[0] : null;

      // If no exact match, try partial matches for a degraded assessment
      var partialMatches = [];
      if (!combo) {
        // Try process + material + code (any position)
        var pmcResult = await sb.from("domain_combination_registry")
          .select("*")
          .eq("process", process)
          .eq("material", material)
          .eq("code_family", codeFamily)
          .eq("is_active", true)
          .limit(3);
        if (pmcResult.data && pmcResult.data.length > 0) {
          for (var pm = 0; pm < pmcResult.data.length; pm++) {
            partialMatches.push({
              match_type: "process_material_code",
              combination: pmcResult.data[pm],
              missing: "position " + position + " not validated for this process/material/code"
            });
          }
        }

        // Try process + code (any material, any position)
        var pcResult = await sb.from("domain_combination_registry")
          .select("*")
          .eq("process", process)
          .eq("code_family", codeFamily)
          .eq("is_active", true)
          .limit(3);
        if (pcResult.data && pcResult.data.length > 0) {
          for (var pc = 0; pc < pcResult.data.length; pc++) {
            partialMatches.push({
              match_type: "process_code",
              combination: pcResult.data[pc],
              missing: "material " + material + " and/or position " + position + " not validated"
            });
          }
        }
      }

      // Check for known gaps
      var gapQuery = sb.from("domain_gap_registry").select("*").eq("resolved", false);
      var gapsFound = [];
      var gapResult = await gapQuery;
      if (gapResult.data) {
        for (var gi = 0; gi < gapResult.data.length; gi++) {
          var gap = gapResult.data[gi];
          var gapApplies = false;
          if (gap.process && gap.process === process) gapApplies = true;
          if (gap.material && gap.material === material) gapApplies = true;
          if (gap.code_family && gap.code_family === codeFamily) gapApplies = true;
          if (gap.position && gap.position === position) gapApplies = true;
          // Null fields in gap = applies to all
          if (!gap.process && !gap.material && !gap.code_family && !gap.position) gapApplies = false;
          if (gapApplies) gapsFound.push(gap);
        }
      }

      var gateResult = determineGateResult(combo, gapsFound);
      var gateMessage = buildGateMessage(gateResult, combo, gapsFound, { process: process, position: position, material: material, code_family: codeFamily });

      var warnings = [];
      if (combo && combo.limitations) {
        for (var wl = 0; wl < combo.limitations.length; wl++) {
          warnings.push(combo.limitations[wl]);
        }
      }
      if (combo && combo.known_issues) {
        for (var ki = 0; ki < combo.known_issues.length; ki++) {
          warnings.push("Known issue: " + combo.known_issues[ki]);
        }
      }
      for (var gw = 0; gw < gapsFound.length; gw++) {
        if (gapsFound[gw].severity !== "blocking") {
          warnings.push("Gap: " + gapsFound[gw].description);
        }
      }

      var gapCodes = [];
      for (var gc = 0; gc < gapsFound.length; gc++) {
        gapCodes.push(gapsFound[gc].gap_code);
      }

      // Save the check
      if (assessmentId || caseId) {
        await sb.from("domain_validation_checks").insert({
          org_id: orgId,
          assessment_id: assessmentId,
          case_id: caseId,
          process: process,
          position: position,
          material: material,
          code_family: codeFamily,
          support_level: combo ? combo.support_level : "unsupported",
          confidence_pct: combo ? combo.confidence_pct : 0,
          gate_result: gateResult,
          warnings: warnings,
          gaps_found: gapCodes
        });
      }

      // Audit
      await sb.from("domain_audit_events").insert({
        org_id: orgId,
        assessment_id: assessmentId,
        event_type: "gate_check",
        event_data: {
          process: process,
          position: position,
          material: material,
          code_family: codeFamily,
          gate_result: gateResult,
          support_level: combo ? combo.support_level : "not_found",
          confidence_pct: combo ? combo.confidence_pct : 0,
          gaps_count: gapsFound.length
        },
        actor: body.checked_by || "system"
      });

      return ok({
        action: "gate_check",
        input: { process: process, position: position, material: material, code_family: codeFamily },
        gate_result: gateResult,
        support_level: combo ? combo.support_level : (partialMatches.length > 0 ? "partial_match" : "not_found"),
        confidence_pct: combo ? combo.confidence_pct : 0,
        data_source: combo ? combo.data_source : "none",
        warnings: warnings,
        gaps: gapsFound.map(function(g) {
          return { gap_code: g.gap_code, severity: g.severity, description: g.description, workaround: g.workaround };
        }),
        partial_matches: combo ? [] : partialMatches.slice(0, 5).map(function(pm) {
          return {
            match_type: pm.match_type,
            process: pm.combination.process,
            position: pm.combination.position,
            material: pm.combination.material,
            code_family: pm.combination.code_family,
            support_level: pm.combination.support_level,
            missing: pm.missing
          };
        }),
        recommended_actions: combo ? (combo.recommended_actions || []) : ["Verify evaluation results with qualified personnel", "Consider whether this combination requires specialized assessment"],
        message: gateMessage
      });
    }

    // ============================================================
    // ACTION: get_combinations
    // ============================================================
    if (action === "get_combinations") {
      var gcQuery = sb.from("domain_combination_registry").select("*").eq("is_active", true).order("process");
      if (body.process) gcQuery = gcQuery.eq("process", body.process);
      if (body.position) gcQuery = gcQuery.eq("position", body.position);
      if (body.material) gcQuery = gcQuery.eq("material", body.material);
      if (body.code_family) gcQuery = gcQuery.eq("code_family", body.code_family);
      if (body.support_level) gcQuery = gcQuery.eq("support_level", body.support_level);
      var gcResult = await gcQuery;
      if (gcResult.error) return errResp(500, gcResult.error.message);
      return ok({
        action: "get_combinations",
        count: gcResult.data.length,
        combinations: gcResult.data
      });
    }

    // ============================================================
    // ACTION: get_gaps
    // ============================================================
    if (action === "get_gaps") {
      var ggQuery = sb.from("domain_gap_registry").select("*").order("gap_code");
      if (body.resolved !== undefined) ggQuery = ggQuery.eq("resolved", body.resolved);
      if (body.severity) ggQuery = ggQuery.eq("severity", body.severity);
      if (body.gap_type) ggQuery = ggQuery.eq("gap_type", body.gap_type);
      var ggResult = await ggQuery;
      if (ggResult.error) return errResp(500, ggResult.error.message);
      return ok({
        action: "get_gaps",
        count: ggResult.data.length,
        unresolved: ggResult.data.filter(function(g) { return !g.resolved; }).length,
        gaps: ggResult.data
      });
    }

    // ============================================================
    // ACTION: get_coverage_matrix
    // ============================================================
    if (action === "get_coverage_matrix") {
      var cmCode = body.code_family || null;
      var cmQuery = sb.from("domain_combination_registry").select("process, position, material, code_family, support_level, confidence_pct").eq("is_active", true);
      if (cmCode) cmQuery = cmQuery.eq("code_family", cmCode);
      var cmResult = await cmQuery.order("process");
      if (cmResult.error) return errResp(500, cmResult.error.message);

      // Build matrix structure
      var processes = {};
      var materials = {};
      var positions = {};
      var matrix = [];

      for (var ci = 0; ci < cmResult.data.length; ci++) {
        var row = cmResult.data[ci];
        processes[row.process] = true;
        materials[row.material] = true;
        positions[row.position] = true;
        matrix.push({
          process: row.process,
          position: row.position,
          material: row.material,
          code_family: row.code_family,
          support_level: row.support_level,
          confidence_pct: row.confidence_pct
        });
      }

      return ok({
        action: "get_coverage_matrix",
        code_family: cmCode || "all",
        total_combinations: matrix.length,
        unique_processes: Object.keys(processes).length,
        unique_materials: Object.keys(materials).length,
        unique_positions: Object.keys(positions).length,
        processes: Object.keys(processes).sort(),
        materials: Object.keys(materials).sort(),
        positions: Object.keys(positions).sort(),
        matrix: matrix,
        coverage_by_level: {
          full: matrix.filter(function(m) { return m.support_level === "full"; }).length,
          validated: matrix.filter(function(m) { return m.support_level === "validated"; }).length,
          limited: matrix.filter(function(m) { return m.support_level === "limited"; }).length,
          experimental: matrix.filter(function(m) { return m.support_level === "experimental"; }).length,
          unsupported: matrix.filter(function(m) { return m.support_level === "unsupported"; }).length
        }
      });
    }

    // ============================================================
    // ACTION: get_support_summary
    // ============================================================
    if (action === "get_support_summary") {
      var ssResult = await sb.from("domain_combination_registry").select("support_level, confidence_pct, process, material, code_family").eq("is_active", true);
      var ssGaps = await sb.from("domain_gap_registry").select("severity, resolved");

      var data = ssResult.data || [];
      var gaps = ssGaps.data || [];

      var byLevel = { full: 0, validated: 0, limited: 0, experimental: 0, unsupported: 0 };
      var totalConfidence = 0;
      for (var si = 0; si < data.length; si++) {
        byLevel[data[si].support_level] = (byLevel[data[si].support_level] || 0) + 1;
        totalConfidence += data[si].confidence_pct;
      }

      var unresolvedGaps = gaps.filter(function(g) { return !g.resolved; }).length;
      var blockingGaps = gaps.filter(function(g) { return !g.resolved && g.severity === "blocking"; }).length;

      return ok({
        action: "get_support_summary",
        total_combinations: data.length,
        by_support_level: byLevel,
        average_confidence: data.length > 0 ? Math.round(totalConfidence / data.length) : 0,
        high_confidence_count: data.filter(function(d) { return d.confidence_pct >= 90; }).length,
        total_gaps: gaps.length,
        unresolved_gaps: unresolvedGaps,
        blocking_gaps: blockingGaps,
        system_readiness: blockingGaps > 0
          ? "Operational with " + blockingGaps + " known blocking gap(s) — some combinations will be refused"
          : unresolvedGaps > 0
          ? "Operational with " + unresolvedGaps + " known limitation(s)"
          : "Fully operational — no known gaps"
      });
    }

    // ============================================================
    // ACTION: add_combination
    // ============================================================
    if (action === "add_combination") {
      var acProcess = body.process;
      var acPosition = body.position;
      var acMaterial = body.material;
      var acCode = body.code_family;
      var acSupport = body.support_level || "limited";
      var acConfidence = body.confidence_pct || 50;

      if (!acProcess || !acPosition || !acMaterial || !acCode) return errResp(400, "process, position, material, code_family all required");

      var acInsert = await sb.from("domain_combination_registry").insert({
        process: acProcess,
        position: acPosition,
        material: acMaterial,
        code_family: acCode,
        support_level: acSupport,
        confidence_pct: acConfidence,
        data_source: body.data_source || "expert_seeded",
        limitations: body.limitations || null,
        known_issues: body.known_issues || null,
        notes: body.notes || null,
        validated_by: body.validated_by || null
      }).select().single();

      if (acInsert.error) return errResp(500, "Failed to add: " + acInsert.error.message);

      await sb.from("domain_audit_events").insert({
        org_id: body.org_id || null,
        event_type: "combination_added",
        event_data: { process: acProcess, position: acPosition, material: acMaterial, code_family: acCode, support_level: acSupport },
        actor: body.added_by || "system"
      });

      return ok({ action: "add_combination", combination: acInsert.data, message: "Domain combination registered." });
    }

    // ============================================================
    // ACTION: report_gap
    // ============================================================
    if (action === "report_gap") {
      var rgCode = body.gap_code;
      var rgDescription = body.description;
      var rgType = body.gap_type;
      var rgSeverity = body.severity || "degraded";

      if (!rgCode || !rgDescription || !rgType) return errResp(400, "gap_code, description, gap_type required");

      var rgInsert = await sb.from("domain_gap_registry").insert({
        gap_code: rgCode,
        process: body.process || null,
        position: body.position || null,
        material: body.material || null,
        code_family: body.code_family || null,
        gap_type: rgType,
        severity: rgSeverity,
        description: rgDescription,
        workaround: body.workaround || null,
        resolution_plan: body.resolution_plan || null
      }).select().single();

      if (rgInsert.error) return errResp(500, "Failed to report gap: " + rgInsert.error.message);

      await sb.from("domain_audit_events").insert({
        org_id: body.org_id || null,
        event_type: "gap_identified",
        event_data: { gap_code: rgCode, gap_type: rgType, severity: rgSeverity },
        actor: body.reported_by || "system"
      });

      return ok({ action: "report_gap", gap: rgInsert.data, message: "Domain gap reported: " + rgCode });
    }

    // ============================================================
    // ACTION: resolve_gap
    // ============================================================
    if (action === "resolve_gap") {
      var rvGapCode = body.gap_code;
      if (!rvGapCode) return errResp(400, "gap_code required");

      var rvUpdate = await sb.from("domain_gap_registry").update({
        resolved: true,
        resolved_at: new Date().toISOString()
      }).eq("gap_code", rvGapCode).select().single();

      if (rvUpdate.error) return errResp(500, "Failed to resolve: " + rvUpdate.error.message);

      await sb.from("domain_audit_events").insert({
        org_id: body.org_id || null,
        event_type: "gap_resolved",
        event_data: { gap_code: rvGapCode },
        actor: body.resolved_by || "system"
      });

      return ok({ action: "resolve_gap", gap: rvUpdate.data, message: "Gap " + rvGapCode + " marked as resolved." });
    }

    // ============================================================
    // ACTION: get_gate_history
    // ============================================================
    if (action === "get_gate_history") {
      var ghQuery = sb.from("domain_validation_checks").select("*");
      if (body.assessment_id) ghQuery = ghQuery.eq("assessment_id", body.assessment_id);
      if (body.case_id) ghQuery = ghQuery.eq("case_id", body.case_id);
      if (body.org_id) ghQuery = ghQuery.eq("org_id", body.org_id);
      var ghResult = await ghQuery.order("checked_at", { ascending: false }).limit(body.limit || 50);

      if (ghResult.error) return errResp(500, ghResult.error.message);
      return ok({
        action: "get_gate_history",
        count: ghResult.data.length,
        checks: ghResult.data
      });
    }

    return errResp(400, "Unknown action: " + action + ". Valid: get_registry, gate_check, get_combinations, get_gaps, get_coverage_matrix, get_support_summary, add_combination, report_gap, resolve_gap, get_gate_history");

  } catch (e) {
    return errResp(500, String(e && e.message ? e.message : e));
  }
};
