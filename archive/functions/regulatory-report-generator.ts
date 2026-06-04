// @ts-nocheck
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ══════════════════════════════════════════════════════════════════
// REGULATORY REPORT GENERATOR (DEPLOY330)
//
// Takes internal FORGED analysis outputs and formats them into
// code-compliant assessment reports that engineers expect.
//
// Supported report types:
// 1. API 579-1/ASME FFS-1 Level 1/2 Assessment
// 2. ASME B31G / Modified B31G Remaining Strength
// 3. API 580/581 RBI Assessment Summary
// 4. DNV-RP-F101 Corroded Pipeline Assessment
// 5. API 510/570 Inspection Summary
// 6. ASME PCC-2 Repair Assessment
// 7. General FFS Executive Summary
//
// Each report follows the exact section structure, terminology,
// and calculation presentation format that inspectors and
// plant engineers expect for regulatory submission.
// ══════════════════════════════════════════════════════════════════

// ── REPORT TEMPLATES ────────────────────────────────────────────
var REPORT_TEMPLATES = {
  "api_579_level1": {
    name: "API 579-1/ASME FFS-1 Level 1 Assessment",
    code_reference: "API 579-1/ASME FFS-1, 3rd Edition",
    sections: [
      { id: "1.0", title: "Executive Summary", required: true },
      { id: "2.0", title: "Equipment Identification", required: true },
      { id: "3.0", title: "Damage Mechanism", required: true },
      { id: "4.0", title: "Data Required for Assessment", required: true },
      { id: "4.1", title: "Original Equipment Design Data", required: true },
      { id: "4.2", title: "Maintenance and Operational History", required: false },
      { id: "4.3", title: "Inspection Data", required: true },
      { id: "5.0", title: "Assessment Technique and Acceptance Criteria", required: true },
      { id: "5.1", title: "Minimum Required Thickness Calculation", required: true },
      { id: "5.2", title: "Remaining Strength Factor", required: true },
      { id: "5.3", title: "Remaining Life Calculation", required: true },
      { id: "6.0", title: "Results and Conclusions", required: true },
      { id: "7.0", title: "Recommendations", required: true },
      { id: "8.0", title: "References", required: false }
    ]
  },
  "b31g_remaining_strength": {
    name: "ASME B31G / Modified B31G Remaining Strength",
    code_reference: "ASME B31G-2012 (R2017)",
    sections: [
      { id: "1.0", title: "Summary", required: true },
      { id: "2.0", title: "Pipeline Identification", required: true },
      { id: "3.0", title: "Corrosion Data", required: true },
      { id: "3.1", title: "Maximum Depth of Corrosion", required: true },
      { id: "3.2", title: "Longitudinal Extent", required: true },
      { id: "4.0", title: "Pipe Properties", required: true },
      { id: "5.0", title: "B31G Calculation", required: true },
      { id: "5.1", title: "Modified B31G Calculation", required: true },
      { id: "5.2", title: "Estimated Repair Factor", required: true },
      { id: "6.0", title: "Safe Operating Pressure", required: true },
      { id: "7.0", title: "Disposition", required: true }
    ]
  },
  "api_580_rbi": {
    name: "API 580/581 Risk-Based Inspection Plan",
    code_reference: "API 580, 3rd Edition / API 581, 3rd Edition",
    sections: [
      { id: "1.0", title: "Executive Summary", required: true },
      { id: "2.0", title: "Scope and Objectives", required: true },
      { id: "3.0", title: "Equipment Registry", required: true },
      { id: "4.0", title: "Consequence of Failure Analysis", required: true },
      { id: "4.1", title: "Release Scenarios", required: true },
      { id: "4.2", title: "Financial Consequence", required: true },
      { id: "4.3", title: "Safety and Environmental Consequence", required: true },
      { id: "5.0", title: "Probability of Failure Analysis", required: true },
      { id: "5.1", title: "Generic Failure Frequency", required: true },
      { id: "5.2", title: "Damage Factor", required: true },
      { id: "5.3", title: "Management System Factor", required: true },
      { id: "6.0", title: "Risk Ranking", required: true },
      { id: "7.0", title: "Inspection Plan", required: true },
      { id: "7.1", title: "Inspection Methods and Coverage", required: true },
      { id: "7.2", title: "Inspection Intervals", required: true },
      { id: "8.0", title: "Risk Mitigation Recommendations", required: true }
    ]
  },
  "dnv_rp_f101": {
    name: "DNV-RP-F101 Corroded Pipeline Assessment",
    code_reference: "DNV-RP-F101 (2017)",
    sections: [
      { id: "1.0", title: "Assessment Summary", required: true },
      { id: "2.0", title: "Pipeline Data", required: true },
      { id: "3.0", title: "Corrosion Defect Data", required: true },
      { id: "4.0", title: "Single Defect Assessment", required: true },
      { id: "4.1", title: "Capacity Pressure Calculation", required: true },
      { id: "4.2", title: "Allowable Pressure", required: true },
      { id: "5.0", title: "Interacting Defects Assessment", required: false },
      { id: "6.0", title: "System Reliability", required: false },
      { id: "7.0", title: "Conclusions and Recommendations", required: true }
    ]
  },
  "api_510_570_summary": {
    name: "API 510/570 Inspection Summary",
    code_reference: "API 510, 11th Edition / API 570, 4th Edition",
    sections: [
      { id: "1.0", title: "Inspection Summary", required: true },
      { id: "2.0", title: "Equipment Description", required: true },
      { id: "3.0", title: "Inspection History", required: true },
      { id: "4.0", title: "Current Inspection Findings", required: true },
      { id: "5.0", title: "Corrosion Rate Calculation", required: true },
      { id: "5.1", title: "Short-Term Rate", required: true },
      { id: "5.2", title: "Long-Term Rate", required: true },
      { id: "6.0", title: "Minimum Required Thickness", required: true },
      { id: "7.0", title: "Remaining Life and Next Inspection Date", required: true },
      { id: "8.0", title: "Recommendations", required: true }
    ]
  },
  "pcc2_repair": {
    name: "ASME PCC-2 Repair Assessment",
    code_reference: "ASME PCC-2-2018",
    sections: [
      { id: "1.0", title: "Repair Summary", required: true },
      { id: "2.0", title: "Damage Assessment", required: true },
      { id: "3.0", title: "Repair Method Selection", required: true },
      { id: "4.0", title: "Repair Design Calculation", required: true },
      { id: "5.0", title: "Material and Procedure Requirements", required: true },
      { id: "6.0", title: "Quality Control Requirements", required: true },
      { id: "7.0", title: "Post-Repair Monitoring Plan", required: true }
    ]
  },
  "ffs_executive": {
    name: "General FFS Executive Summary",
    code_reference: "Multiple Standards",
    sections: [
      { id: "1.0", title: "Executive Summary", required: true },
      { id: "2.0", title: "Asset Overview", required: true },
      { id: "3.0", title: "Active Damage Mechanisms", required: true },
      { id: "4.0", title: "Fitness-for-Service Status", required: true },
      { id: "5.0", title: "Remaining Life Summary", required: true },
      { id: "6.0", title: "Risk Profile", required: true },
      { id: "7.0", title: "Recommended Actions", required: true },
      { id: "8.0", title: "Confidence and Uncertainty", required: true }
    ]
  }
};

// ── CALCULATION FORMATTERS ──────────────────────────────────────
var CALCULATION_FORMATTERS = {
  "minimum_required_thickness": function(inputs) {
    // t_min = P * R / (S * E - 0.6 * P) + CA
    var P = inputs.design_pressure || 0;
    var R = inputs.inside_radius || 0;
    var S = inputs.allowable_stress || 0;
    var E = inputs.joint_efficiency || 1.0;
    var CA = inputs.corrosion_allowance || 0;

    var t_min = S * E - 0.6 * P > 0 ? P * R / (S * E - 0.6 * P) + CA : 0;

    return {
      formula: "t_min = (P x R) / (S x E - 0.6 x P) + CA",
      inputs_formatted: {
        "Design Pressure (P)": P + " psi",
        "Inside Radius (R)": R + " in",
        "Allowable Stress (S)": S + " psi",
        "Joint Efficiency (E)": E,
        "Corrosion Allowance (CA)": CA + " in"
      },
      result: Math.round(t_min * 10000) / 10000,
      result_unit: "in",
      result_label: "Minimum Required Thickness (t_min)"
    };
  },

  "b31g_safe_pressure": function(inputs) {
    var SMYS = inputs.smys || 0;
    var D = inputs.outside_diameter || 0;
    var t = inputs.nominal_wall || 0;
    var d = inputs.max_depth || 0;
    var L = inputs.defect_length || 0;

    // B31G Original
    var A = 0.893 * L / Math.sqrt(D * t);
    var M = A <= 4.0 ? Math.sqrt(1 + 0.8 * A * A) : 0.032 * A * A + 3.3;

    var dOverT = d / t;
    var P_safe = 0;
    if (dOverT <= 0.8 && t > 0 && D > 0) {
      P_safe = 1.1 * (2 * SMYS * t / D) * ((1 - (2/3) * dOverT) / (1 - (2/3) * dOverT / M));
    }

    return {
      formula: "P_safe = 1.1 x (2 x SMYS x t / D) x [(1 - 2/3 x d/t) / (1 - 2/3 x (d/t)/M)]",
      inputs_formatted: {
        "SMYS": SMYS + " psi",
        "Outside Diameter (D)": D + " in",
        "Nominal Wall (t)": t + " in",
        "Max Corrosion Depth (d)": d + " in",
        "Defect Length (L)": L + " in",
        "Folias Factor (M)": Math.round(M * 1000) / 1000,
        "d/t ratio": Math.round(dOverT * 1000) / 1000
      },
      result: Math.round(P_safe * 10) / 10,
      result_unit: "psi",
      result_label: "Safe Operating Pressure (B31G)"
    };
  },

  "remaining_life": function(inputs) {
    var t_actual = inputs.actual_thickness || 0;
    var t_min = inputs.min_thickness || 0;
    var rate = inputs.corrosion_rate || 0;

    var RL = rate > 0 ? (t_actual - t_min) / rate : 999;

    return {
      formula: "RL = (t_actual - t_min) / corrosion_rate",
      inputs_formatted: {
        "Actual Thickness (t_actual)": t_actual + " in",
        "Minimum Required (t_min)": t_min + " in",
        "Corrosion Rate": rate + " in/yr"
      },
      result: Math.round(RL * 10) / 10,
      result_unit: "years",
      result_label: "Remaining Life"
    };
  },

  "risk_score": function(inputs) {
    var pof = inputs.probability_of_failure || 1;
    var cof = inputs.consequence_of_failure || 1;
    var risk = pof * cof;

    var category = "Low";
    if (risk > 16) category = "High";
    else if (risk > 8) category = "Medium-High";
    else if (risk > 4) category = "Medium";
    else if (risk > 2) category = "Medium-Low";

    return {
      formula: "Risk = PoF x CoF",
      inputs_formatted: {
        "Probability of Failure (PoF)": pof + " (1-5 scale)",
        "Consequence of Failure (CoF)": cof + " (1-5 scale)"
      },
      result: risk,
      result_unit: "",
      result_label: "Risk Score (" + category + ")"
    };
  }
};

// ── REPORT BUILDER ──────────────────────────────────────────────
function buildReport(templateKey, reportData) {
  var template = REPORT_TEMPLATES[templateKey];
  if (!template) return null;

  var report = {
    report_id: generateReportId(),
    generated_at: new Date().toISOString(),
    template: templateKey,
    title: template.name,
    code_reference: template.code_reference,
    prepared_by: reportData.prepared_by || "FORGED NDT Intelligence OS",
    reviewed_by: reportData.reviewed_by || "Pending Review",
    sections: [],
    calculations: [],
    completeness: 0,
    status: "draft"
  };

  var filledCount = 0;
  var requiredCount = 0;

  for (var si = 0; si < template.sections.length; si++) {
    var sectionDef = template.sections[si];
    var sectionData = reportData.sections ? reportData.sections[sectionDef.id] : null;

    if (sectionDef.required) requiredCount++;

    var section = {
      id: sectionDef.id,
      title: sectionDef.title,
      required: sectionDef.required,
      content: null,
      data_tables: [],
      calculations: [],
      status: "empty"
    };

    if (sectionData) {
      section.content = sectionData.content || null;
      section.data_tables = sectionData.tables || [];
      section.status = section.content ? "filled" : "partial";
      if (section.content && sectionDef.required) filledCount++;

      // Process any calculations in this section
      if (sectionData.calculations) {
        for (var ci = 0; ci < sectionData.calculations.length; ci++) {
          var calc = sectionData.calculations[ci];
          var formatter = CALCULATION_FORMATTERS[calc.type];
          if (formatter) {
            var formatted = formatter(calc.inputs || {});
            section.calculations.push(formatted);
            report.calculations.push({
              section: sectionDef.id,
              calculation: formatted
            });
          }
        }
      }
    }

    report.sections.push(section);
  }

  report.completeness = requiredCount > 0 ? Math.round((filledCount / requiredCount) * 100) : 0;
  report.status = report.completeness === 100 ? "complete" : (report.completeness > 0 ? "in_progress" : "draft");

  return report;
}

// ── AUTO-POPULATE FROM FORGED DATA ──────────────────────────────
function autoPopulateFromCase(templateKey, caseData, analysisResults) {
  var populated = { sections: {} };

  if (templateKey === "api_579_level1" || templateKey === "ffs_executive") {
    populated.sections["1.0"] = {
      content: "Fitness-for-service assessment performed for " + (caseData.asset_name || caseData.asset_id || "the subject equipment") + ". " + (caseData.mechanism || "General metal loss") + " identified as the primary damage mechanism. " + (analysisResults.disposition || "Assessment pending.")
    };

    if (caseData.asset_id || caseData.asset_name) {
      populated.sections["2.0"] = {
        content: "Equipment: " + (caseData.asset_name || caseData.asset_id) + ". Type: " + (caseData.equipment_type || "Pressure Equipment") + ". Service: " + (caseData.service || "Not specified") + "."
      };
    }

    if (caseData.mechanism) {
      populated.sections["3.0"] = {
        content: "Primary damage mechanism: " + caseData.mechanism + ". " + (caseData.mechanism_details || "")
      };
    }

    if (analysisResults.remaining_life) {
      populated.sections["5.3"] = {
        content: "Remaining life calculated as " + analysisResults.remaining_life.value + " " + analysisResults.remaining_life.unit + " based on " + (analysisResults.remaining_life.method || "corrosion rate projection") + ".",
        calculations: [{ type: "remaining_life", inputs: analysisResults.remaining_life.inputs || {} }]
      };
    }

    if (analysisResults.disposition) {
      populated.sections["6.0"] = {
        content: "The assessment concludes: " + analysisResults.disposition + ". " + (analysisResults.confidence ? "Confidence: " + analysisResults.confidence + "%." : "")
      };
    }

    if (analysisResults.recommendations) {
      populated.sections["7.0"] = {
        content: analysisResults.recommendations
      };
    }
  }

  if (templateKey === "b31g_remaining_strength") {
    if (caseData.pipe_data) {
      populated.sections["2.0"] = {
        content: "Pipeline: " + (caseData.asset_name || caseData.asset_id || "Subject Pipeline") + ". NPS: " + (caseData.pipe_data.nps || "N/A") + ". Material: " + (caseData.pipe_data.material || "N/A") + ". SMYS: " + (caseData.pipe_data.smys || "N/A") + " psi."
      };
    }

    if (analysisResults.b31g) {
      populated.sections["5.0"] = {
        content: "B31G original method calculation:",
        calculations: [{ type: "b31g_safe_pressure", inputs: analysisResults.b31g.inputs || {} }]
      };
    }
  }

  return populated;
}

function generateReportId() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var id = "RPT-";
  for (var i = 0; i < 8; i++) {
    id = id + chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// ── SAVE FUNCTIONS ──────────────────────────────────────────────
async function saveReport(sb, report) {
  try {
    await sb.from("regulatory_reports").insert([{
      report_id: report.report_id,
      case_id: report.case_id || null,
      template: report.template,
      title: report.title,
      code_reference: report.code_reference,
      completeness: report.completeness,
      status: report.status,
      calculations_count: report.calculations.length,
      full_report: report
    }]);
  } catch (e) {
    // non-fatal
  }
}

async function getReportHistory(sb, caseId, limit) {
  try {
    var q = sb.from("regulatory_reports").select("*").order("created_at", { ascending: false }).limit(limit || 20);
    if (caseId) q = q.eq("case_id", caseId);
    var result = await q;
    return result.data || [];
  } catch (e) {
    return [];
  }
}

// ── HANDLER ─────────────────────────────────────────────────────
var handler = async function(event) {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "POST only" }) };

  try {
    var body = JSON.parse(event.body || "{}");
    var action = body.action || "get_registry";
    var sb = createClient(supabaseUrl, supabaseKey);

    // ── GET REGISTRY ──────────────────────────────────────────
    if (action === "get_registry") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "regulatory-report-generator",
          deploy: "DEPLOY330",
          version: "1.0.0",
          description: "Regulatory Report Generator — code-compliant FFS assessment reports for API 579, B31G, API 580/581, DNV-RP-F101",
          report_templates: Object.keys(REPORT_TEMPLATES).length,
          calculation_types: Object.keys(CALCULATION_FORMATTERS).length,
          capabilities: [
            "api_579_assessment",
            "b31g_remaining_strength",
            "rbi_assessment",
            "dnv_pipeline_assessment",
            "inspection_summary",
            "repair_assessment",
            "auto_populate",
            "calculation_formatting"
          ],
          actions: ["get_registry", "generate_report", "auto_populate", "calculate", "get_templates", "get_history"]
        })
      };
    }

    // ── GENERATE REPORT ───────────────────────────────────────
    if (action === "generate_report") {
      var templateKey = body.template || "ffs_executive";
      var reportData = body.report_data || {};

      var report = buildReport(templateKey, reportData);
      if (!report) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            engine: "regulatory-report-generator",
            error: "Unknown template: " + templateKey,
            available_templates: Object.keys(REPORT_TEMPLATES)
          })
        };
      }

      report.case_id = body.case_id || null;
      await saveReport(sb, report);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "regulatory-report-generator",
          action: "generate_report",
          report: report
        })
      };
    }

    // ── AUTO POPULATE ─────────────────────────────────────────
    if (action === "auto_populate") {
      var apTemplate = body.template || "ffs_executive";
      var caseData = body.case_data || {};
      var analysisResults = body.analysis_results || {};

      var populated = autoPopulateFromCase(apTemplate, caseData, analysisResults);
      var report = buildReport(apTemplate, { sections: populated.sections, prepared_by: body.prepared_by });
      if (report) {
        report.case_id = body.case_id || null;
        await saveReport(sb, report);
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "regulatory-report-generator",
          action: "auto_populate",
          report: report,
          auto_populated_sections: Object.keys(populated.sections).length
        })
      };
    }

    // ── CALCULATE ─────────────────────────────────────────────
    if (action === "calculate") {
      var calcType = body.calculation_type;
      var formatter = CALCULATION_FORMATTERS[calcType];
      if (!formatter) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            engine: "regulatory-report-generator",
            error: "Unknown calculation type: " + calcType,
            available_types: Object.keys(CALCULATION_FORMATTERS)
          })
        };
      }

      var result = formatter(body.inputs || {});
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "regulatory-report-generator",
          action: "calculate",
          calculation: result
        })
      };
    }

    // ── GET TEMPLATES ─────────────────────────────────────────
    if (action === "get_templates") {
      var templates = {};
      for (var tk in REPORT_TEMPLATES) {
        templates[tk] = {
          name: REPORT_TEMPLATES[tk].name,
          code_reference: REPORT_TEMPLATES[tk].code_reference,
          section_count: REPORT_TEMPLATES[tk].sections.length,
          required_sections: REPORT_TEMPLATES[tk].sections.filter(function(s) { return s.required; }).length
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "regulatory-report-generator",
          action: "get_templates",
          templates: templates
        })
      };
    }

    // ── GET HISTORY ───────────────────────────────────────────
    if (action === "get_history") {
      var history = await getReportHistory(sb, body.case_id, body.limit || 20);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          engine: "regulatory-report-generator",
          action: "get_history",
          reports: history,
          count: history.length
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "regulatory-report-generator", error: "Unknown action: " + action })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ engine: "regulatory-report-generator", error: String(err && err.message ? err.message : err) })
    };
  }
};

export { handler };
