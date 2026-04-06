// DEPLOY135 — VoiceInspectionPage.tsx v16.4
// v16.4: Build 2 — Failure Mode Dominance Engine + Disposition Pathway Engine
// Adds Step 7 (failure mode dominance + disposition pathway) after hardening
// DEPLOY134 — VoiceInspectionPage.tsx v16.3
// v16.3: Build 1 — Authority Lock Engine + B31G Remaining Strength Calculator
// DEPLOY129 — VoiceInspectionPage.tsx v16.2
// v16.2: Hardening Sprint 1 wired — Reality Challenge + Unknown State + Trusted Facts
// DEPLOY125 — VoiceInspectionPage.tsx v16.1
// v16.1: Interactive Grammar Bridge readback with editable fields + amendment trail
// DEPLOY123 — VoiceInspectionPage.tsx v16.0
// v16.0: Evidence Provenance wired into pipeline + UI
// Calls evidence-provenance before decision-core, passes results through pipeline.
// Evidence Provenance card shows trust band, evidence items, measurement reality gaps.
// DEPLOY113 — VoiceInspectionPage.tsx v15.0
// v15.0: Superbrain Synthesis — Five Magic Features rendered
// Replaces AI Narrative with full superbrain intelligence output
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

import React, { useState, useRef, useEffect } from "react";
import { runHardeningPipeline } from "../utils/hardening-pipeline";
import HardeningResultsPanel from "../components/HardeningResultsPanel";

function generateInspectionReport(data: {
  transcript: string;
  parsed: any;
  asset: any;
  decisionCore: any;
  aiNarrative: string | null;
  superbrainResult: any;
  provenanceResult?: any;
}) {
  var dc = data.decisionCore;
  if (!dc) { alert("No Decision Core data to export."); return; }

  var phy = dc.physical_reality;
  var dmg = dc.damage_reality;
  var con = dc.consequence_reality;
  var auth = dc.authority_reality;
  var insp = dc.inspection_reality;
  var conf = dc.reality_confidence;
  var dec = dc.decision_reality;
  var comp = dc.physics_computations;
  var sb = data.superbrainResult;

  var now = new Date();
  var dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  var timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  var caseRef = "FORGED-" + now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");

  var tierColorVal = con.consequence_tier === "CRITICAL" ? "#dc2626" : con.consequence_tier === "HIGH" ? "#ea580c" : con.consequence_tier === "MEDIUM" ? "#ca8a04" : "#16a34a";
  var bandColorVal = conf.band === "TRUSTED" || conf.band === "HIGH" ? "#16a34a" : conf.band === "GUARDED" ? "#ca8a04" : "#dc2626";

  function esc(s: any): string { return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  var html = "";
  html += "<!DOCTYPE html><html><head><meta charset='utf-8'><title>FORGED NDT Inspection Report - " + esc(caseRef) + "</title>";
  html += "<style>";
  html += "* { margin: 0; padding: 0; box-sizing: border-box; }";
  html += "body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #1a1a1a; padding: 40px; max-width: 850px; margin: 0 auto; }";
  html += "@media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 0.75in; } }";
  html += ".header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 20px; }";
  html += ".header h1 { font-size: 18px; color: #1e40af; margin-bottom: 4px; }";
  html += ".header .subtitle { font-size: 11px; color: #6b7280; }";
  html += ".meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }";
  html += ".meta-box { padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 6px; }";
  html += ".meta-label { font-size: 9px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }";
  html += ".meta-value { font-size: 12px; font-weight: 600; }";
  html += ".section { margin-bottom: 18px; page-break-inside: avoid; }";
  html += ".section-title { font-size: 13px; font-weight: 800; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 4px; margin-bottom: 10px; }";
  html += ".banner { padding: 10px 16px; border-radius: 6px; text-align: center; font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 12px; }";
  html += ".info-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; font-size: 11px; }";
  html += ".info-label { font-weight: 600; color: #374151; }";
  html += ".info-value { color: #1a1a1a; }";
  html += ".gate-row { display: flex; align-items: center; gap: 8px; padding: 5px 10px; margin-bottom: 3px; border-radius: 4px; font-size: 11px; }";
  html += ".gate-pass { background: #f0fdf4; } .gate-block { background: #fef2f2; } .gate-warn { background: #fffbeb; } .gate-info { background: #eff6ff; }";
  html += ".recovery-item { padding: 8px 12px; margin-bottom: 6px; border-left: 3px solid #2563eb; background: #f9fafb; border-radius: 4px; }";
  html += ".mech-valid { padding: 6px 10px; background: #f0fdf4; border-radius: 4px; margin-bottom: 4px; border-left: 3px solid #16a34a; }";
  html += ".mech-reject { padding: 4px 10px; background: #fef2f2; border-radius: 4px; margin-bottom: 3px; font-size: 10px; color: #991b1b; }";
  html += ".gap-item { padding: 5px 10px; background: #fef2f2; border-radius: 4px; margin-bottom: 3px; color: #991b1b; font-size: 11px; }";
  html += ".confidence-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }";
  html += ".conf-box { text-align: center; padding: 6px; border: 1px solid #e5e7eb; border-radius: 4px; }";
  html += ".conf-label { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; }";
  html += ".conf-value { font-size: 14px; font-weight: 700; }";
  html += ".narrative { padding: 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; white-space: pre-wrap; font-size: 11px; line-height: 1.7; }";
  html += ".sig-line { display: flex; gap: 40px; margin-top: 30px; padding-top: 10px; }";
  html += ".sig-box { flex: 1; border-top: 1px solid #374151; padding-top: 4px; }";
  html += ".sig-label { font-size: 10px; color: #6b7280; }";
  html += ".print-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; font-size: 14px; font-weight: 700; color: #fff; background: #2563eb; border: none; border-radius: 6px; cursor: pointer; z-index: 1000; }";
  html += ".print-btn:hover { background: #1d4ed8; }";
  html += ".sb-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }";
  html += ".sb-table th { background: #f0f4ff; padding: 6px 8px; text-align: left; border: 1px solid #dbeafe; font-weight: 700; color: #1e40af; }";
  html += ".sb-table td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: top; }";
  html += ".sb-item { padding: 6px 10px; margin-bottom: 4px; background: #f9fafb; border-radius: 4px; border-left: 3px solid #2563eb; font-size: 11px; }";
  html += "</style></head><body>";

  html += "<button class='print-btn no-print' onclick='window.print()'>Save as PDF / Print</button>";

  html += "<div class='header'>";
  html += "<h1>FORGED NDT Intelligence OS</h1>";
  html += "<div style='font-size: 14px; font-weight: 700; margin-bottom: 4px;'>Physics-First Inspection Intelligence Report</div>";
  html += "<div class='subtitle'>Case: " + esc(caseRef) + " | " + esc(dateStr) + " " + esc(timeStr) + "</div>";
  html += "<div class='subtitle'>Engine: decision-core v2.5 + Superbrain v1.1 + Provenance v1.0 + Authority Lock v1.0 | Elapsed: " + (dc.elapsed_ms || "?") + "ms</div>";
  html += "</div>";

  html += "<div class='meta-grid'>";
  var displayAssetClass = data.asset?.asset_class || "unknown";
  var assetNote = "";
  if (dc.asset_correction && dc.asset_correction.corrected) {
    displayAssetClass = dc.asset_correction.corrected_to;
    assetNote = " (corrected from " + esc(dc.asset_correction.original) + ")";
  }
  html += "<div class='meta-box'><div class='meta-label'>Asset Classification</div><div class='meta-value'>" + esc(displayAssetClass) + assetNote + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Consequence Tier</div><div class='meta-value' style='color:" + tierColorVal + "'>" + esc(con.consequence_tier) + " - " + esc(con.failure_mode).replace(/_/g, " ") + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Disposition</div><div class='meta-value'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Primary Authority</div><div class='meta-value'>" + esc(auth.primary_authority) + "</div></div>";
  html += "</div>";

  // SUPERBRAIN FEATURES IN PDF
  if (sb && sb.synthesis) {
    var syn = sb.synthesis;

    // Failure Narrative
    html += "<div class='section'>";
    html += "<div class='section-title'>Failure Narrative (Physics-Traced)</div>";
    html += "<div class='narrative'>" + esc(syn.failure_narrative) + "</div>";
    html += "</div>";

    // Contradiction Matrix
    if (syn.contradiction_matrix && syn.contradiction_matrix.length > 0) {
      html += "<div class='section'>";
      html += "<div class='section-title'>Contradiction Matrix — Code vs Physics</div>";
      html += "<table class='sb-table'>";
      html += "<tr><th>Framework</th><th>Verdict</th><th>Basis</th><th>Limitation</th><th>Gap Reason</th></tr>";
      for (var ci = 0; ci < syn.contradiction_matrix.length; ci++) {
        var cm = syn.contradiction_matrix[ci];
        var vColor = (cm.verdict || "").indexOf("ACCEPT") !== -1 ? "#16a34a" : "#dc2626";
        html += "<tr><td><strong>" + esc(cm.framework) + "</strong></td><td style='color:" + vColor + ";font-weight:700;'>" + esc(cm.verdict) + "</td><td>" + esc(cm.basis) + "</td><td>" + esc(cm.limitation) + "</td><td style='color:#dc2626;'>" + esc(cm.gap_reason) + "</td></tr>";
      }
      html += "</table></div>";
    }

    // Pre-Inspection Briefing
    if (syn.pre_inspection_briefing) {
      var pib = syn.pre_inspection_briefing;
      html += "<div class='section'>";
      html += "<div class='section-title'>Pre-Inspection Briefing — What to Look For</div>";
      if (pib.target_zones && pib.target_zones.length > 0) {
        html += "<div style='margin-bottom:8px;'><strong>Target Zones:</strong></div>";
        for (var tz = 0; tz < pib.target_zones.length; tz++) html += "<div class='sb-item'>" + esc(pib.target_zones[tz]) + "</div>";
      }
      if (pib.expected_flaws && pib.expected_flaws.length > 0) {
        html += "<div style='margin-bottom:8px;margin-top:8px;'><strong>Expected Flaw Morphology:</strong></div>";
        for (var ef = 0; ef < pib.expected_flaws.length; ef++) html += "<div class='sb-item'>" + esc(pib.expected_flaws[ef]) + "</div>";
      }
      if (pib.method_recommendations && pib.method_recommendations.length > 0) {
        html += "<div style='margin-bottom:8px;margin-top:8px;'><strong>Method Recommendations:</strong></div>";
        for (var mr = 0; mr < pib.method_recommendations.length; mr++) html += "<div class='sb-item'>" + esc(pib.method_recommendations[mr]) + "</div>";
      }
      if (pib.sensitivity_settings) html += "<div style='margin-top:8px;font-size:11px;'><strong>Sensitivity:</strong> " + esc(pib.sensitivity_settings) + "</div>";
      if (pib.watch_items && pib.watch_items.length > 0) {
        html += "<div style='margin-bottom:8px;margin-top:8px;'><strong>Watch Items:</strong></div>";
        for (var wi = 0; wi < pib.watch_items.length; wi++) html += "<div class='sb-item' style='border-left-color:#ea580c;'>" + esc(pib.watch_items[wi]) + "</div>";
      }
      html += "</div>";
    }

    // Inspector Action Card
    if (syn.inspector_action_card && syn.inspector_action_card.length > 0) {
      html += "<div class='section'>";
      html += "<div class='section-title'>Inspector Action Card</div>";
      for (var ac = 0; ac < syn.inspector_action_card.length; ac++) {
        var action = syn.inspector_action_card[ac];
        html += "<div class='recovery-item'>";
        html += "<strong>#" + (ac + 1) + " " + esc(action.step) + "</strong><br/>";
        html += "Rationale: " + esc(action.rationale) + "<br/>";
        html += "<span style='color:#16a34a;'>If positive: " + esc(action.threshold_if_positive) + "</span><br/>";
        html += "<span style='color:#dc2626;'>If negative: " + esc(action.threshold_if_negative) + "</span>";
        html += "</div>";
      }
      html += "</div>";
    }

    // Reviewer Brief
    if (syn.reviewer_brief) {
      html += "<div class='section'>";
      html += "<div class='section-title'>Reviewer Brief</div>";
      html += "<div class='narrative'>" + esc(syn.reviewer_brief) + "</div>";
      html += "</div>";
    }

    // Procedure Forensics
    if (syn.procedure_forensics) {
      var pf = syn.procedure_forensics;
      html += "<div class='section'>";
      html += "<div class='section-title'>Procedure Forensics — What Went Wrong</div>";
      if (pf.likely_causes && pf.likely_causes.length > 0) {
        for (var lc = 0; lc < pf.likely_causes.length; lc++) html += "<div class='sb-item'>" + esc(pf.likely_causes[lc]) + "</div>";
      }
      if (pf.reverse_inference_chain && pf.reverse_inference_chain.length > 0) {
        html += "<div style='margin-top:8px;'><strong>Reverse Inference Chain:</strong></div>";
        for (var ri = 0; ri < pf.reverse_inference_chain.length; ri++) html += "<div style='font-size:11px;padding:3px 0;'>" + (ri + 1) + ". " + esc(pf.reverse_inference_chain[ri]) + "</div>";
      }
      html += "</div>";
    }
  }

  // Evidence Provenance in PDF
  if (data.provenanceResult && data.provenanceResult.provenance_summary) {
    var prov = data.provenanceResult;
    html += "<div class='section'>";
    html += "<div class='section-title'>Evidence Provenance</div>";
    html += "<div class='info-row'><span class='info-label'>Trust Band</span><span class='info-value'>" + esc(prov.provenance_summary.trust_band) + " (" + Math.round(prov.provenance_summary.average_trust_weight * 100) + "%)</span></div>";
    html += "<div class='info-row'><span class='info-label'>Dominant Source</span><span class='info-value'>" + esc(prov.provenance_summary.dominant_source) + "</span></div>";
    html += "<div class='info-row'><span class='info-label'>Measured Fraction</span><span class='info-value'>" + Math.round(prov.provenance_summary.measured_fraction * 100) + "%</span></div>";
    html += "<div class='info-row'><span class='info-label'>Total Items</span><span class='info-value'>" + (prov.provenance_summary.total_evidence_items || 0) + "</span></div>";
    if (prov.measurement_reality) {
      html += "<div class='info-row'><span class='info-label'>Method Adequacy</span><span class='info-value'>" + esc(prov.measurement_reality.overall_adequacy) + "</span></div>";
      if (prov.measurement_reality.unanswered_gaps) {
        for (var ugi = 0; ugi < prov.measurement_reality.unanswered_gaps.length; ugi++) {
          html += "<div class='gap-item'>" + esc(prov.measurement_reality.unanswered_gaps[ugi].message) + "</div>";
        }
      }
    }
    if (prov.provenance_summary.recommendation) {
      html += "<div style='margin-top:8px;font-size:11px;color:#92400e;padding:6px 10px;background:#fffbeb;border-radius:4px;'>" + esc(prov.provenance_summary.recommendation) + "</div>";
    }
    html += "</div>";
  }

  // Reality Confidence
  html += "<div class='section'>";
  html += "<div class='section-title'>Reality Confidence</div>";
  html += "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>";
  html += "<div><strong style='color:" + bandColorVal + ";font-size:14px;'>" + esc(conf.band) + "</strong> (" + Math.round(conf.overall * 100) + "%)</div>";
  html += "</div>";
  html += "<div class='confidence-grid'>";
  var confDims = [
    { label: "Physics", value: conf.physics_confidence },
    { label: "Damage", value: conf.damage_confidence },
    { label: "Consequence", value: conf.consequence_confidence },
    { label: "Authority", value: conf.authority_confidence },
    { label: "Inspection", value: conf.inspection_confidence },
  ];
  for (var cdi = 0; cdi < confDims.length; cdi++) {
    var pct = Math.round(confDims[cdi].value * 100);
    var cc = pct >= 70 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626";
    html += "<div class='conf-box'><div class='conf-label'>" + confDims[cdi].label + "</div><div class='conf-value' style='color:" + cc + "'>" + pct + "%</div></div>";
  }
  html += "</div>";
  if (conf.limiting_factors && conf.limiting_factors.length > 0) {
    html += "<div style='font-size:10px;color:#6b7280;'>Limiting: " + esc(conf.limiting_factors.join(" | ")) + "</div>";
  }
  html += "</div>";

  // Consequence
  html += "<div class='section'>";
  html += "<div class='section-title'>Consequence Reality</div>";
  html += "<div class='banner' style='background:" + tierColorVal + "'>" + esc(con.consequence_tier) + " CONSEQUENCE</div>";
  html += "<div class='info-row'><span class='info-label'>Failure Mode</span><span class='info-value'>" + esc(con.failure_mode).replace(/_/g, " ") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Human Impact</span><span class='info-value'>" + esc(con.human_impact) + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Damage State</span><span class='info-value'>" + esc(con.damage_state || "STABLE") + "</span></div>";
  if (con.failure_physics) html += "<div style='margin-top:8px;padding:8px 10px;background:#f0f4ff;border-radius:4px;border-left:3px solid #2563eb;font-size:11px;'><strong>Failure Physics:</strong> " + esc(con.failure_physics) + "</div>";
  html += "</div>";

  // Decision
  html += "<div class='section'>";
  html += "<div class='section-title'>Decision</div>";
  var decColor = dec.disposition === "no_go" ? "#dc2626" : dec.disposition === "hold_for_review" || dec.disposition === "engineering_review_required" ? "#ca8a04" : "#16a34a";
  html += "<div class='banner' style='background:" + decColor + "'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div>";
  html += "<div style='font-size:11px;margin-bottom:10px;'>" + esc(dec.disposition_basis) + "</div>";
  if (dec.gates && dec.gates.length > 0) {
    for (var gi = 0; gi < dec.gates.length; gi++) {
      var g = dec.gates[gi];
      var gc = g.result === "PASS" ? "gate-pass" : g.result === "BLOCKED" ? "gate-block" : g.result === "ESCALATED" ? "gate-warn" : "gate-info";
      html += "<div class='gate-row " + gc + "'><strong>[" + g.result + "]</strong> <span style='font-weight:600;'>" + esc(g.gate).replace(/_/g, " ") + "</span> <span style='color:#6b7280;margin-left:6px;'>" + esc(g.reason) + "</span></div>";
    }
  }
  html += "</div>";

  // Transcript
  html += "<div class='section'>";
  html += "<div class='section-title'>Original Input Transcript</div>";
  html += "<div style='padding:10px;background:#f9fafb;border-radius:6px;font-size:11px;white-space:pre-wrap;border:1px solid #e5e7eb;'>" + esc(data.transcript) + "</div>";
  html += "</div>";

  // Signature
  html += "<div class='sig-line'>";
  html += "<div class='sig-box'><div class='sig-label'>Inspector</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "<div class='sig-box'><div class='sig-label'>Reviewed By</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "</div>";

  html += "<div style='margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;'>";
  html += "Generated by FORGED NDT Intelligence OS - " + esc(dateStr) + " " + esc(timeStr) + " - " + esc(caseRef);
  html += "<br/>Engine: decision-core v2.5 + Superbrain v1.1 + Provenance v1.0 + Authority Lock v1.0 | Klein Bottle Architecture | " + (dc.klein_bottle_states || 6) + " states";
  html += "</div>";

  html += "</body></html>";

  var reportWindow = window.open("", "_blank");
  if (reportWindow) {
    reportWindow.document.write(html);
    reportWindow.document.close();
  } else {
    alert("Pop-up blocked. Please allow pop-ups for this site.");
  }
}


// ============================================================================
// API HELPER
// ============================================================================
var API_BASE = "/api";
async function callAPI(endpoint: string, body: any): Promise<any> {
  var res = await fetch(API_BASE + "/" + endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) { var text = await res.text(); throw new Error(endpoint + " failed (" + res.status + "): " + text); }
  return res.json();
}

// ============================================================================
// SAVE TO CASE MANAGER
// ============================================================================
var SUPABASE_URL = "https://lrxwirjcuzultolomnos.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyeHdpcmpjdXp1bHRvbG9tbm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzQ1NjcsImV4cCI6MjA5MDY1MDU2N30.oVGJybVpR2ktkHWMXsNeVFkBB7QFzfpp9QyIk00zwUU";

async function saveCaseToSupabase(transcriptText: string, parsedData: any, assetData: any, dcResult: any): Promise<{ success: boolean; caseId: string; error?: string }> {
  var now = new Date();
  var caseId = "CASE-" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  var con = dcResult.consequence_reality || {};
  var dec = dcResult.decision_reality || {};
  var conf = dcResult.reality_confidence || {};
  var dmg = dcResult.damage_reality || {};
  var insp = dcResult.inspection_reality || {};
  var auth = dcResult.authority_reality || {};

  var title = transcriptText.substring(0, 80).replace(/[^a-zA-Z0-9 .,\-]/g, "").trim();
  if (!title) title = "Voice Inspection " + caseId;

  var displayAsset = (assetData && assetData.asset_class) || "General";
  if (dcResult.asset_correction && dcResult.asset_correction.corrected) {
    displayAsset = dcResult.asset_correction.corrected_to;
  }

  var caseRow = {
    case_id: caseId,
    case_name: title,
    title: title,
    status: "open",
    inspector_name: "Field Inspector",
    asset_type: displayAsset,
    asset_name: displayAsset,
    asset_class: displayAsset,
    location: "Field",
    description: transcriptText,
    applicable_standard: (auth.primary_authority || "API 570"),
    consequence_tier: (con.consequence_tier || "MEDIUM"),
    superbrain_disposition: (dec.disposition || "hold_for_review"),
    confidence_band: (conf.band || "LOW"),
    confidence_overall: (conf.overall || 0),
    primary_mechanism: (dmg.primary_mechanism ? dmg.primary_mechanism.name : null),
    sufficiency_verdict: (insp.sufficiency_verdict || null),
    hard_lock_count: (dec.hard_locks ? dec.hard_locks.length : 0),
    next_action: (dec.guided_recovery && dec.guided_recovery.length > 0 ? dec.guided_recovery[0].action : null),
    stage: "evaluated",
    highest_severity: (dmg.primary_mechanism ? dmg.primary_mechanism.severity : null),
    finding_count: (dmg.validated_mechanisms ? dmg.validated_mechanisms.length : 0),
    rejectable_count: (dec.hard_locks ? dec.hard_locks.length : 0),
    sb_consequence: (con.consequence_tier || "MEDIUM"),
    sb_disposition: (dec.disposition || "hold_for_review"),
    sb_confidence: (conf.overall || 0),
    sb_mechanism: (dmg.primary_mechanism ? dmg.primary_mechanism.name : null),
    sb_sufficiency: (insp.sufficiency_verdict || null),
    sb_engine_version: (dcResult.engine_version || "v2.5"),
    sb_last_eval: now.toISOString()
  };

  try {
    var res = await fetch(SUPABASE_URL + "/rest/v1/cases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(caseRow)
    });
    if (!res.ok) {
      var errText = await res.text();
      return { success: false, caseId: caseId, error: "Insert failed: " + res.status + " " + errText };
    }
    return { success: true, caseId: caseId };
  } catch (err: any) {
    return { success: false, caseId: caseId, error: "Network error: " + (err.message || String(err)) };
  }
}

// ============================================================================
// EVIDENCE FLAG DEFINITIONS
// ============================================================================
interface EvidenceFlagDef { key: string; label: string; group: string; type: "boolean" | "number"; hardLockCritical: boolean; description: string; }
var CONFIRMABLE_FLAGS: EvidenceFlagDef[] = [
  { key: "visible_deformation", label: "Visible Deformation", group: "Damage Indicators", type: "boolean", hardLockCritical: true, description: "Buckling, bending, denting, or permanent distortion" },
  { key: "visible_cracking", label: "Cracking Suspected", group: "Damage Indicators", type: "boolean", hardLockCritical: false, description: "Possible cracking observed but not confirmed" },
  { key: "crack_confirmed", label: "Cracking CONFIRMED", group: "Damage Indicators", type: "boolean", hardLockCritical: true, description: "Cracking confirmed by visual or NDE" },
  { key: "dent_or_gouge_present", label: "Dent / Gouge Present", group: "Damage Indicators", type: "boolean", hardLockCritical: false, description: "Localized mechanical damage" },
  { key: "critical_wall_loss_confirmed", label: "Critical Wall Loss CONFIRMED", group: "Damage Indicators", type: "boolean", hardLockCritical: true, description: "Wall below code minimum" },
  { key: "primary_member_involved", label: "Primary Member Involved", group: "Structural / Load Path", type: "boolean", hardLockCritical: true, description: "Primary load-carrying member (leg, girder, brace)" },
  { key: "load_path_interruption_possible", label: "Load Path Interruption", group: "Structural / Load Path", type: "boolean", hardLockCritical: true, description: "Possible interruption of structural load path" },
  { key: "support_shift", label: "Support / Restraint Shift", group: "Structural / Load Path", type: "boolean", hardLockCritical: true, description: "Support displacement or misalignment" },
  { key: "support_collapse_confirmed", label: "Support Collapse CONFIRMED", group: "Structural / Load Path", type: "boolean", hardLockCritical: true, description: "Structural failure of support/bearing" },
  { key: "fire_exposure", label: "Fire / Thermal Exposure", group: "Fire / Thermal", type: "boolean", hardLockCritical: true, description: "Component exposed to fire or elevated temperature" },
  { key: "fire_duration_minutes", label: "Fire Duration (minutes)", group: "Fire / Thermal", type: "number", hardLockCritical: false, description: "Approximate fire exposure duration" },
  { key: "fire_property_degradation_confirmed", label: "Fire-Degraded Properties CONFIRMED", group: "Fire / Thermal", type: "boolean", hardLockCritical: true, description: "Post-fire material properties beyond acceptance" },
  { key: "pressure_boundary_involved", label: "Pressure Boundary Involved", group: "Pressure / Leaks", type: "boolean", hardLockCritical: true, description: "Piping, vessel, PSV, flange, or pressure component" },
  { key: "leak_suspected", label: "Leak Suspected", group: "Pressure / Leaks", type: "boolean", hardLockCritical: false, description: "Staining, seepage, or possible leak indicators" },
  { key: "leak_confirmed", label: "Leak CONFIRMED", group: "Pressure / Leaks", type: "boolean", hardLockCritical: true, description: "Active or confirmed leak" },
  { key: "through_wall_leak_confirmed", label: "Through-Wall Leak CONFIRMED", group: "Pressure / Leaks", type: "boolean", hardLockCritical: true, description: "Confirmed through-wall breach with active leak" },
  { key: "underwater_access_limited", label: "Underwater / Limited Access", group: "Access / Data Quality", type: "boolean", hardLockCritical: false, description: "Underwater, confined, or restricted access" },
  { key: "unknown_material", label: "Material Unknown", group: "Access / Data Quality", type: "boolean", hardLockCritical: false, description: "Material grade/type not confirmed" },
];

function extractPreliminaryEvidence(parsed: any, asset: any): any {
  var events = (parsed && parsed.events) || [];
  var transcript = (parsed && parsed.raw_text) || "";
  var lt = transcript.toLowerCase();
  function hasEvent(term: string): boolean { for (var i = 0; i < events.length; i++) { if (events[i].toLowerCase().indexOf(term) !== -1) return true; } return false; }
  function inText(term: string): boolean { return lt.indexOf(term) !== -1; }
  return {
    visible_deformation: hasEvent("deformation") || inText("dent") || inText("deform") || inText("buckl"),
    visible_cracking: hasEvent("cracking") || inText("crack"),
    crack_confirmed: inText("crack confirmed") || inText("cracking confirmed"),
    primary_member_involved: inText("jacket leg") || inText("primary") || inText("girder") || inText("main member"),
    load_path_interruption_possible: inText("load path"),
    leak_suspected: hasEvent("possible_leakage") || inText("leak") || inText("staining"),
    leak_confirmed: inText("confirmed leak") || inText("active leak"),
    pressure_boundary_involved: inText("piping") || inText("psv") || inText("flange") || inText("pressure") || inText("decompression") || inText("chamber"),
    fire_exposure: hasEvent("fire") || inText("fire"),
    fire_duration_minutes: null,
    support_shift: inText("support") && (inText("displace") || inText("shift")),
    support_collapse_confirmed: (inText("support") || inText("bearing")) && (inText("collapse") || inText("failed")),
    dent_or_gouge_present: inText("dent") || inText("gouge"),
    underwater_access_limited: inText("underwater") || inText("subsea"),
    unknown_material: !inText("carbon steel") && !inText("stainless") && !inText("alloy") && !inText("steel"),
    through_wall_leak_confirmed: inText("through-wall") && inText("leak"),
    critical_wall_loss_confirmed: inText("below minimum") || inText("critical wall"),
    fire_property_degradation_confirmed: inText("hardness") && (inText("failed") || inText("degraded")),
  };
}

// ============================================================================
// HELPERS
// ============================================================================
function tierColor(tier: string): string {
  if (tier === "CRITICAL") return "#dc2626";
  if (tier === "HIGH") return "#ea580c";
  if (tier === "MEDIUM") return "#ca8a04";
  return "#16a34a";
}
function bandColor(band: string): string {
  if (band === "TRUSTED") return "#16a34a";
  if (band === "HIGH") return "#16a34a";
  if (band === "GUARDED") return "#ca8a04";
  if (band === "LOW") return "#ea580c";
  return "#dc2626";
}
function gateIcon(result: string): string {
  if (result === "PASS") return "\u2705";
  if (result === "BLOCKED") return "\uD83D\uDED1";
  if (result === "ESCALATED") return "\u26A0\uFE0F";
  return "\u2139\uFE0F";
}
function gateColor(result: string): string {
  if (result === "PASS") return "#16a34a";
  if (result === "BLOCKED") return "#dc2626";
  if (result === "ESCALATED") return "#ea580c";
  return "#ca8a04";
}

// ============================================================================
// CARD WRAPPER
// ============================================================================
function Card({ title, icon, children, status, collapsible, defaultCollapsed, accent }: { title: string; icon: string; children: React.ReactNode; status?: string; collapsible?: boolean; defaultCollapsed?: boolean; accent?: string }) {
  var [collapsed, setCollapsed] = useState(defaultCollapsed || false);
  var canCollapse = collapsible !== false;
  var borderLeft = accent ? "3px solid " + accent : "none";
  return (
    <div style={{ marginBottom: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff", borderLeft: borderLeft }}>
      <div onClick={function() { if (canCollapse) setCollapsed(!collapsed); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: accent ? accent + "08" : "#f9fafb", borderBottom: collapsed ? "none" : "1px solid #e5e7eb", cursor: canCollapse ? "pointer" : "default", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>{title}</span>
          {status && <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "8px" }}>{status}</span>}
        </div>
        {canCollapse && <span style={{ fontSize: "12px", color: "#9ca3af" }}>{collapsed ? "+" : "-"}</span>}
      </div>
      {!collapsed && <div style={{ padding: "16px" }}>{children}</div>}
    </div>
  );
}

// ============================================================================
// STEP TRACKER
// ============================================================================
interface StepState { label: string; status: "pending" | "running" | "done" | "error" | "waiting"; detail?: string; }
function StepTracker({ steps }: { steps: StepState[] }) {
  return (
    <div style={{ margin: "16px 0", padding: "12px 16px", backgroundColor: "#f0f4ff", borderRadius: "8px", border: "1px solid #dbeafe" }}>
      {steps.map(function(step, i) {
        var icon = step.status === "done" ? "\u2705" : step.status === "running" ? "\u23f3" : step.status === "error" ? "\u274c" : step.status === "waiting" ? "\u23f8\ufe0f" : "\u25cb";
        var color = step.status === "done" ? "#16a34a" : step.status === "running" ? "#2563eb" : step.status === "error" ? "#dc2626" : step.status === "waiting" ? "#ca8a04" : "#9ca3af";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px" }}>
            <span>{icon}</span>
            <span style={{ color: color, fontWeight: step.status === "running" ? 700 : 400 }}>{step.label}</span>
            {step.detail && <span style={{ color: "#6b7280", fontSize: "11px" }}>{"\u2014"} {step.detail}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// EVIDENCE CONFIRMATION CARD
// ============================================================================
function EvidenceConfirmationCard({ evidence, onConfirm, onSkip, isGenerating }: { evidence: any; onConfirm: (confirmed: any) => void; onSkip: () => void; isGenerating: boolean }) {
  var [edited, setEdited] = useState<any>({ ...evidence });
  function toggle(key: string) { setEdited(function(prev: any) { var n = { ...prev }; n[key] = !n[key]; return n; }); }
  function setNum(key: string, val: string) { setEdited(function(prev: any) { var n = { ...prev }; var p = parseInt(val, 10); n[key] = isNaN(p) ? null : p; return n; }); }

  var groups: any = {};
  for (var i = 0; i < CONFIRMABLE_FLAGS.length; i++) {
    var f = CONFIRMABLE_FLAGS[i];
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  }

  return (
    <Card title="Evidence Confirmation" icon={"\uD83D\uDD0D"} collapsible={false}>
      <div style={{ padding: "10px 14px", backgroundColor: "#eff6ff", borderRadius: "6px", marginBottom: "16px", borderLeft: "4px solid #2563eb" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e40af", marginBottom: "4px" }}>Review Evidence Before Physics Analysis</div>
        <div style={{ fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>These flags were auto-extracted. They directly control the physics analysis — mechanism validation, consequence tier, and disposition. Correct any errors before proceeding.</div>
      </div>
      {Object.keys(groups).map(function(groupName, gi) {
        return (
          <div key={gi} style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" }}>{groupName}</div>
            {groups[groupName].map(function(flag: EvidenceFlagDef, fi: number) {
              var val = edited[flag.key];
              var origVal = evidence[flag.key];
              var changed = val !== origVal;
              var active = flag.type === "boolean" ? !!val : (val !== null && val !== undefined);
              if (flag.type === "number") {
                return (
                  <div key={fi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", marginBottom: "4px", borderRadius: "6px", backgroundColor: changed ? "#fefce8" : "#fafafa", border: "1px solid " + (flag.hardLockCritical ? "#fecaca" : "#e5e7eb") }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>{flag.label}</span>
                      {flag.hardLockCritical && <span style={{ fontSize: "9px", fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", padding: "1px 5px", borderRadius: "3px", marginLeft: "6px" }}>CRITICAL</span>}
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{flag.description}</div>
                    </div>
                    <input type="number" value={val !== null && val !== undefined ? String(val) : ""} onChange={function(e) { setNum(flag.key, e.target.value); }} placeholder="min" style={{ width: "70px", padding: "4px 8px", fontSize: "13px", border: "1px solid #d1d5db", borderRadius: "4px", textAlign: "center" }} />
                  </div>
                );
              }
              return (
                <div key={fi} onClick={function() { toggle(flag.key); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", marginBottom: "4px", borderRadius: "6px", backgroundColor: changed ? "#fefce8" : (active ? "#f0fdf4" : "#fafafa"), border: "1px solid " + (flag.hardLockCritical ? "#fecaca" : "#e5e7eb"), cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: "13px" }}>{flag.label}</span>
                    {flag.hardLockCritical && <span style={{ fontSize: "9px", fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", padding: "1px 5px", borderRadius: "3px", marginLeft: "6px" }}>CRITICAL</span>}
                    {changed && <span style={{ fontSize: "9px", fontWeight: 700, color: "#92400e", backgroundColor: "#fef3c7", padding: "1px 5px", borderRadius: "3px", marginLeft: "6px" }}>CHANGED</span>}
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{flag.description}</div>
                  </div>
                  <div style={{ width: "44px", height: "24px", borderRadius: "12px", backgroundColor: active ? "#16a34a" : "#d1d5db", position: "relative", flexShrink: 0 }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "10px", backgroundColor: "#fff", position: "absolute", top: "2px", left: active ? "22px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <button onClick={function() { onConfirm(edited); }} disabled={isGenerating} style={{ flex: 2, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#16a34a", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer" }}>
          {isGenerating ? "Running Physics Analysis..." : "\u2705 Confirm & Run Physics Analysis"}
        </button>
        <button onClick={onSkip} disabled={isGenerating} style={{ flex: 1, padding: "12px 16px", fontSize: "13px", fontWeight: 600, color: "#6b7280", backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer" }}>
          Skip {"\u2014"} Trust Auto-Derived
        </button>
      </div>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function VoiceInspectionPage() {
  var [transcript, setTranscript] = useState("");
  var [isGenerating, setIsGenerating] = useState(false);
  var [steps, setSteps] = useState<StepState[]>([]);
  var [evidenceConfirmPending, setEvidenceConfirmPending] = useState(false);
  var [preliminaryEvidence, setPreliminaryEvidence] = useState<any>(null);

  var [parsed, setParsed] = useState<any>(null);
  var [asset, setAsset] = useState<any>(null);
  var [realityLock, setRealityLock] = useState<any>(null);
  var [decisionCore, setDecisionCore] = useState<any>(null);
  var [engineeringResult, setEngineeringResult] = useState<any>(null);
  var [engineeringLoading, setEngineeringLoading] = useState(false);
  var [engineeringError, setEngineeringError] = useState<string | null>(null);
  var [architectureResult, setArchitectureResult] = useState<any>(null);
  var [architectureLoading, setArchitectureLoading] = useState(false);
  var [materialsResult, setMaterialsResult] = useState<any>(null);
  var [materialsLoading, setMaterialsLoading] = useState(false);
  var [aiNarrative, setAiNarrative] = useState<string | null>(null);
  var [errors, setErrors] = useState<string[]>([]);
  var [isListening, setIsListening] = useState(false);
  var recognitionRef = useRef<any>(null);
  var [aiQuestions, setAiQuestions] = useState<any[] | null>(null);
  var [aiUnderstood, setAiUnderstood] = useState<string | null>(null);
  var [selectedAnswers, setSelectedAnswers] = useState<any>({});
  var [pipelinePaused, setPipelinePaused] = useState(false);
  var resultsRef = useRef<HTMLDivElement>(null);

  // SAVE TO CASE MANAGER STATE
  var [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  var [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  var [saveError, setSaveError] = useState<string | null>(null);

  // SUPERBRAIN STATE — v15.0
  var [superbrainResult, setSuperbrainResult] = useState<any>(null);
  var [superbrainLoading, setSuperbrainLoading] = useState(false);
  var [superbrainError, setSuperbrainError] = useState<string | null>(null);
  var [grammarBridgeResult, setGrammarBridgeResult] = useState<any>(null);

  // EVIDENCE PROVENANCE STATE — v16.0
  var [provenanceResult, setProvenanceResult] = useState<any>(null);
  var [provenanceLoading, setProvenanceLoading] = useState(false);
  var [hardeningResult, setHardeningResult] = useState<any>(null);
  var [hardeningLoading, setHardeningLoading] = useState(false);

  // GRAMMAR BRIDGE EDITING STATE — v16.1
  var [gbEditingField, setGbEditingField] = useState<string | null>(null);
  var [gbAmendments, setGbAmendments] = useState<any[]>([]);
  var [gbConfirmed, setGbConfirmed] = useState(false);

  // BUILD 1: AUTHORITY LOCK + REMAINING STRENGTH STATE — v16.3
  var [authorityLockResult, setAuthorityLockResult] = useState<any>(null);
  var [remainingStrengthResult, setRemainingStrengthResult] = useState<any>(null);

  // BUILD 2: FAILURE MODE DOMINANCE + DISPOSITION PATHWAY STATE — v16.4
  var [failureModeDominanceResult, setFailureModeDominanceResult] = useState<any>(null);
  var [dispositionPathwayResult, setDispositionPathwayResult] = useState<any>(null);

  var handleSaveToCase = async function() {
    if (!decisionCore) return;
    setSaveStatus("saving"); setSaveError(null);
    var result = await saveCaseToSupabase(transcript, parsed, asset, decisionCore);
    if (result.success) {
      setSaveStatus("saved");
      setSavedCaseId(result.caseId);
    } else {
      setSaveStatus("error");
      setSaveError(result.error || "Unknown error");
    }
  };

  // GRAMMAR BRIDGE AMENDMENT HANDLER — v16.1
  var handleGbAmend = async function(field: string, value: string) {
    if (!grammarBridgeResult) return;
    try {
      var amendRes = await callAPI("voice-grammar-bridge", {
        action: "amend",
        current_state: grammarBridgeResult,
        amendment: { field: field, value: value, source: "inspector_ui" }
      });
      if (amendRes && amendRes.ok) {
        var amended = amendRes.result || amendRes;
        setGrammarBridgeResult(amended);
        setGbAmendments(function(prev: any[]) {
          return prev.concat([{ field: field, value: value, timestamp: new Date().toISOString() }]);
        });
      }
    } catch (err) { /* amendment failure is non-blocking */ }
    setGbEditingField(null);
  };

  var handleGbConfirm = function() {
    setGbConfirmed(true);
    setGbEditingField(null);
  };

  var callEngineeringCore = async function(decResult: any, narrativeText: string) {
    setEngineeringLoading(true); setEngineeringError(null);
    var ei: Record<string, any> = {
      caseId: 'ENG-' + String(Date.now()),
      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),
      consequenceTier: (decResult.consequence_reality || decResult.consequence || 'MODERATE'),
      ndtVerdict: (decResult.disposition || 'INDETERMINATE'),
      ndtConfidence: (decResult.reality_confidence || 0.5),
      primaryMechanism: (decResult.primary_mechanism || ''),
      governingStandard: (decResult.authority_reality || ''),
      incidentNarrative: narrativeText, isCyclicService: false, materialClass: ''
    };
    var nr = narrativeText.toLowerCase();
    if (nr.indexOf('stainless') >= 0 || nr.indexOf('316') >= 0 || nr.indexOf('304') >= 0) { ei.materialClass = 'austenitic_ss'; }
    else if (nr.indexOf('duplex') >= 0 || nr.indexOf('2205') >= 0) { ei.materialClass = 'duplex_ss'; }
    else if (nr.indexOf('carbon steel') >= 0 || nr.indexOf('a36') >= 0) { ei.materialClass = 'carbon_steel'; }
    else if (nr.indexOf('low alloy') >= 0 || nr.indexOf('p91') >= 0) { ei.materialClass = 'low_alloy'; }
    ei.isCyclicService = (nr.indexOf('cyclic') >= 0 || nr.indexOf('fatigue') >= 0 || nr.indexOf('vibrat') >= 0);
    if (nr.indexOf('crack') >= 0) { ei.flawType = 'crack'; } else if (nr.indexOf('corrosion') >= 0 || nr.indexOf('thinning') >= 0) { ei.flawType = 'corrosion'; } else if (nr.indexOf('pitting') >= 0) { ei.flawType = 'pitting'; } else if (nr.indexOf('dent') >= 0) { ei.flawType = 'dent'; }
    if (nr.indexOf('h2s') >= 0 || nr.indexOf('sour') >= 0) { ei.h2sPartialPressureMPa = 0.001; }
    if (nr.indexOf('chloride') >= 0 || nr.indexOf('seawater') >= 0) { ei.chloridePPM = 1000; }
    if (nr.indexOf('creep') >= 0 || nr.indexOf('elevated temp') >= 0) { ei.operatingTempC = 400; }
    try {
      var er = await fetch('/.netlify/functions/engineering-core', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ei) });
      if (er.ok) { var ed = await er.json(); setEngineeringResult(ed); }
      else { setEngineeringError('Engineering core status ' + er.status); }
    } catch(ex: any) { setEngineeringError('Engineering layer: ' + (ex.message || String(ex))); }
    finally { setEngineeringLoading(false); }
  };

  var callArchitectureCore = async function(decResult: any, narrativeText: string) {
    setArchitectureLoading(true);
    var ai: Record<string, any> = {
      caseId: 'ARCH-' + String(Date.now()),
      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),
      consequenceTier: (decResult.consequence_reality || 'MODERATE'),
      engineeringSignificance: (decResult.engineering_significance || 'MODERATE'),
      ndtVerdict: (decResult.disposition || 'INDETERMINATE'),
      riskRanking: (decResult.risk_ranking || 'MEDIUM'),
      incidentNarrative: narrativeText
    };
    try {
      var ar = await fetch('/.netlify/functions/architecture-core', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ai) });
      if (ar.ok) { var ad = await ar.json(); setArchitectureResult(ad); }
    } catch(ex) {} finally { setArchitectureLoading(false); }
  };

  var callMaterialsCore = async function(decResult: any, narrativeText: string) {
    setMaterialsLoading(true);
    var mi: Record<string, any> = {
      caseId: 'MAT-' + String(Date.now()),
      assetClass: (decResult.asset_class || decResult.assetClass || 'unknown'),
      incidentNarrative: narrativeText
    };
    var nr2 = narrativeText.toLowerCase();
    if (nr2.indexOf('stainless') >= 0 || nr2.indexOf('316') >= 0) { mi.materialClass = 'austenitic_ss'; } else if (nr2.indexOf('duplex') >= 0) { mi.materialClass = 'duplex_ss'; } else if (nr2.indexOf('carbon steel') >= 0) { mi.materialClass = 'carbon_steel'; } else if (nr2.indexOf('low alloy') >= 0) { mi.materialClass = 'low_alloy'; }
    if (nr2.indexOf('pwht') >= 0 || nr2.indexOf('post weld heat') >= 0) { mi.pwhtApplied = true; }
    if (nr2.indexOf('h2s') >= 0 || nr2.indexOf('sour') >= 0) { mi.h2sPartialPressureMPa = 0.001; }
    if (nr2.indexOf('chloride') >= 0 || nr2.indexOf('seawater') >= 0) { mi.chloridePPM = 1000; }
    if (nr2.indexOf('cyclic') >= 0 || nr2.indexOf('fatigue') >= 0) { mi.isCyclicService = true; }
    try {
      var mr = await fetch('/.netlify/functions/materials-core', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mi) });
      if (mr.ok) { var md = await mr.json(); setMaterialsResult(md); }
    } catch(ex) {} finally { setMaterialsLoading(false); }
  };

  // SUPERBRAIN SYNTHESIS CALL — v15.0
  var callSuperbrainSynthesis = async function(dcResult: any, transcriptText: string) {
    setSuperbrainLoading(true); setSuperbrainError(null);
    try {
      var sbRes = await fetch('/.netlify/functions/superbrain-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision_core: dcResult,
          transcript: transcriptText
        })
      });
      if (sbRes.ok) {
        var sbData = await sbRes.json();
        setSuperbrainResult(sbData);
      } else {
        var sbErr = await sbRes.text();
        setSuperbrainError('Superbrain status ' + sbRes.status + ': ' + sbErr.substring(0, 200));
      }
    } catch (ex: any) {
      setSuperbrainError('Superbrain: ' + (ex.message || String(ex)));
    } finally {
      setSuperbrainLoading(false);
    }
  };

  // ========================================================================
  // BUILD 1: AUTHORITY LOCK + REMAINING STRENGTH CALLS — v16.3
  // ========================================================================

  var callAuthorityLock = async function(assetData: any, parsedData: any, gbData: any, confirmedFlags: any) {
    try {
      var mechanisms: string[] = [];
      var wallLossPercent = 0;
      var hasCracking = false;
      var serviceEnv = "";

      // Extract from grammar bridge if available
      if (gbData && gbData.extracted) {
        serviceEnv = gbData.extracted.service_fluid || "";
        if (gbData.extracted.primary_finding) {
          mechanisms.push(gbData.extracted.primary_finding);
        }
        if (gbData.extracted.finding_types) {
          mechanisms = mechanisms.concat(gbData.extracted.finding_types);
        }
        if (gbData.extracted.numeric && gbData.extracted.numeric.wall_loss_percent) {
          wallLossPercent = gbData.extracted.numeric.wall_loss_percent;
        }
      }

      // Extract from parsed data
      if (parsedData) {
        if (parsedData.environment) {
          for (var ei2 = 0; ei2 < parsedData.environment.length; ei2++) {
            var envItem = (parsedData.environment[ei2] || "").toLowerCase();
            if (envItem.indexOf("sour") >= 0 || envItem.indexOf("h2s") >= 0) {
              serviceEnv = serviceEnv || "sour";
            }
          }
        }
        if (parsedData.numeric_values) {
          if (parsedData.numeric_values.wall_loss_percent) {
            wallLossPercent = wallLossPercent || parsedData.numeric_values.wall_loss_percent;
          }
        }
      }

      // Check confirmed flags for cracking
      if (confirmedFlags) {
        if (confirmedFlags.crack_confirmed || confirmedFlags.visible_cracking) {
          hasCracking = true;
        }
      }

      // Check transcript for additional mechanism keywords
      var lt = ((parsedData && parsedData.raw_text) || "").toLowerCase();
      if (lt.indexOf("crack") >= 0) hasCracking = true;
      if (lt.indexOf("corrosion") >= 0 && mechanisms.indexOf("corrosion") < 0) mechanisms.push("corrosion");
      if (lt.indexOf("pitting") >= 0 && mechanisms.indexOf("pitting") < 0) mechanisms.push("pitting");
      if (lt.indexOf("wall loss") >= 0 && mechanisms.indexOf("wall_loss") < 0) mechanisms.push("wall_loss");
      if (lt.indexOf("hic") >= 0 && mechanisms.indexOf("hic") < 0) mechanisms.push("hic");
      if (lt.indexOf("sohic") >= 0 && mechanisms.indexOf("sohic") < 0) mechanisms.push("sohic");
      if (lt.indexOf("ssc") >= 0 && mechanisms.indexOf("ssc") < 0) mechanisms.push("ssc");
      if (lt.indexOf("mic") >= 0 && mechanisms.indexOf("mic") < 0) mechanisms.push("mic");
      if (lt.indexOf("erosion") >= 0 && mechanisms.indexOf("erosion") < 0) mechanisms.push("erosion");
      if (lt.indexOf("fatigue") >= 0 && mechanisms.indexOf("fatigue") < 0) mechanisms.push("fatigue");

      // Deduplicate mechanisms
      var uniqueMechs: string[] = [];
      for (var mi2 = 0; mi2 < mechanisms.length; mi2++) {
        if (uniqueMechs.indexOf(mechanisms[mi2]) < 0) {
          uniqueMechs.push(mechanisms[mi2]);
        }
      }

      var requestBody = {
        asset_type: (assetData && (assetData.asset_class || assetData.asset_type)) || "",
        service_environment: serviceEnv,
        damage_mechanisms: uniqueMechs,
        wall_loss_percent: wallLossPercent,
        has_cracking: hasCracking,
        is_pressure_boundary: confirmedFlags ? !!confirmedFlags.pressure_boundary_involved : true,
        jurisdiction: ""
      };

      var response = await fetch("/.netlify/functions/authority-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      var result = await response.json();
      setAuthorityLockResult(result);
      return result;
    } catch (err) {
      console.error("Authority lock error:", err);
      return null;
    }
  };

  var callRemainingStrength = async function(parsedData: any, gbData: any) {
    try {
      var nominalWall = 0;
      var measuredMinWall = 0;
      var flawLength = 0;
      var pipeOD = 0;
      var smys = 0;
      var materialGrade = "";
      var designFactor = 0.72;
      var operatingPressure = 0;

      // Try grammar bridge numeric data first
      if (gbData && gbData.extracted && gbData.extracted.numeric) {
        var num = gbData.extracted.numeric;
        if (num.nominal_wall) nominalWall = num.nominal_wall;
        if (num.measured_wall || num.minimum_wall) measuredMinWall = num.measured_wall || num.minimum_wall;
        if (num.flaw_length || num.defect_length) flawLength = num.flaw_length || num.defect_length;
        if (num.diameter_inches) pipeOD = num.diameter_inches;
        if (num.pressure_psi) operatingPressure = num.pressure_psi;
        if (num.wall_loss_percent && nominalWall && !measuredMinWall) {
          measuredMinWall = nominalWall * (1 - num.wall_loss_percent / 100);
        }
      }

      // Try parsed numeric values
      if (parsedData && parsedData.numeric_values) {
        var nv = parsedData.numeric_values;
        if (!nominalWall && nv.nominal_wall) nominalWall = nv.nominal_wall;
        if (!measuredMinWall && nv.measured_wall) measuredMinWall = nv.measured_wall;
        if (!flawLength && nv.flaw_length) flawLength = nv.flaw_length;
        if (!pipeOD && nv.pipe_od) pipeOD = nv.pipe_od;
        if (!operatingPressure && nv.operating_pressure) operatingPressure = nv.operating_pressure;
        if (nv.wall_loss_percent && nominalWall && !measuredMinWall) {
          measuredMinWall = nominalWall * (1 - nv.wall_loss_percent / 100);
        }
      }

      // Try to extract from transcript
      var lt = ((parsedData && parsedData.raw_text) || "").toLowerCase();

      // Extract material grade from transcript
      var gradePatterns = ["x120", "x100", "x90", "x80", "x70", "x65", "x60", "x56", "x52", "x46", "x42"];
      for (var gpi = 0; gpi < gradePatterns.length; gpi++) {
        if (lt.indexOf(gradePatterns[gpi]) >= 0) {
          materialGrade = gradePatterns[gpi].toUpperCase();
          break;
        }
      }

      // Need at minimum nominal_wall and measured_wall to calculate
      if (!nominalWall || !measuredMinWall) {
        console.log("Remaining strength: insufficient measurement data (need nominal + measured wall)");
        return null;
      }

      // Default flaw length if not provided (conservative assumption)
      if (!flawLength) flawLength = 1.0;
      // Default pipe OD if not provided
      if (!pipeOD) pipeOD = 24.0;

      var requestBody = {
        nominal_wall: nominalWall,
        measured_minimum_wall: measuredMinWall,
        flaw_length: flawLength,
        pipe_od: pipeOD,
        smys: smys,
        material_grade: materialGrade,
        design_factor: designFactor,
        operating_pressure: operatingPressure
      };

      var response = await fetch("/.netlify/functions/remaining-strength", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        var result = await response.json();
        setRemainingStrengthResult(result);
        return result;
      }
      return null;
    } catch (err) {
      console.error("Remaining strength error:", err);
      return null;
    }
  };

  // ========================================================================
  // BUILD 2: FAILURE MODE DOMINANCE + DISPOSITION PATHWAY CALLS — v16.4
  // ========================================================================

  var callFailureModeDominance = async function(parsedData: any, gbData: any, confirmedFlags: any, authLockRes: any, remStrengthRes: any) {
    try {
      var mechanisms: string[] = [];
      var wallLossPercent = 0;
      var hasCracking = false;
      var serviceEnv = "";
      var opPressure = 0;
      var nomWall = 0;
      var measWall = 0;
      var od = 0;
      var smysVal = 0;

      if (gbData && gbData.extracted) {
        serviceEnv = gbData.extracted.service_fluid || "";
        if (gbData.extracted.primary_finding) mechanisms.push(gbData.extracted.primary_finding);
        if (gbData.extracted.finding_types) mechanisms = mechanisms.concat(gbData.extracted.finding_types);
        if (gbData.extracted.numeric) {
          wallLossPercent = gbData.extracted.numeric.wall_loss_percent || 0;
          opPressure = gbData.extracted.numeric.pressure_psi || 0;
          nomWall = gbData.extracted.numeric.nominal_wall || 0;
          measWall = gbData.extracted.numeric.measured_wall || gbData.extracted.numeric.minimum_wall || 0;
          od = gbData.extracted.numeric.diameter_inches || 0;
        }
      }

      if (parsedData && parsedData.numeric_values) {
        wallLossPercent = wallLossPercent || parsedData.numeric_values.wall_loss_percent || 0;
      }

      if (confirmedFlags) {
        if (confirmedFlags.crack_confirmed || confirmedFlags.visible_cracking) hasCracking = true;
      }

      var lt = ((parsedData && parsedData.raw_text) || "").toLowerCase();
      if (lt.indexOf("crack") >= 0) hasCracking = true;
      if (lt.indexOf("corrosion") >= 0 && mechanisms.indexOf("corrosion") < 0) mechanisms.push("corrosion");
      if (lt.indexOf("pitting") >= 0 && mechanisms.indexOf("pitting") < 0) mechanisms.push("pitting");
      if (lt.indexOf("wall loss") >= 0 && mechanisms.indexOf("wall_loss") < 0) mechanisms.push("wall_loss");
      if (lt.indexOf("hic") >= 0 && mechanisms.indexOf("hic") < 0) mechanisms.push("hic");
      if (lt.indexOf("sohic") >= 0 && mechanisms.indexOf("sohic") < 0) mechanisms.push("sohic");
      if (lt.indexOf("ssc") >= 0 && mechanisms.indexOf("ssc") < 0) mechanisms.push("ssc");
      if (lt.indexOf("mic") >= 0 && mechanisms.indexOf("mic") < 0) mechanisms.push("mic");
      if (lt.indexOf("fatigue") >= 0 && mechanisms.indexOf("fatigue") < 0) mechanisms.push("fatigue");
      if (lt.indexOf("erosion") >= 0 && mechanisms.indexOf("erosion") < 0) mechanisms.push("erosion");
      if (lt.indexOf("scc") >= 0 && mechanisms.indexOf("scc") < 0) mechanisms.push("scc");
      if (lt.indexOf("cui") >= 0 && mechanisms.indexOf("cui") < 0) mechanisms.push("cui");

      var response = await fetch("/.netlify/functions/failure-mode-dominance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          damage_mechanisms: mechanisms,
          remaining_strength: remStrengthRes,
          authority_lock: authLockRes,
          wall_loss_percent: wallLossPercent,
          has_cracking: hasCracking,
          service_environment: serviceEnv,
          transcript: (parsedData && parsedData.raw_text) || "",
          operating_pressure: opPressure,
          nominal_wall: nomWall,
          measured_minimum_wall: measWall,
          pipe_od: od,
          smys: smysVal
        })
      });
      var result = await response.json();
      setFailureModeDominanceResult(result);
      return result;
    } catch (err) {
      console.error("Failure mode dominance error:", err);
      return null;
    }
  };

  var callDispositionPathway = async function(fmdResult: any, remStrengthRes: any, hardenRes: any, coreResult: any) {
    try {
      var safeEnv = (remStrengthRes && remStrengthRes.safe_envelope) || "";
      var govMode = (fmdResult && fmdResult.governing_failure_mode) || "";
      var govSev = (fmdResult && fmdResult.governing_severity) || "";
      var realState = (hardenRes && hardenRes.unknownStateResult && hardenRes.unknownStateResult.reality_state) || "";
      var dispBlocked = (hardenRes && hardenRes.unknownStateResult && hardenRes.unknownStateResult.unknown_blocks_final_disposition) || false;
      var interFlag = (fmdResult && fmdResult.interaction_flag) || false;
      var interType = (fmdResult && fmdResult.interaction_type) || "";
      var brittleRisk = (fmdResult && fmdResult.cracking_path && fmdResult.cracking_path.brittle_fracture_risk) || false;
      var wallLoss = (remStrengthRes && remStrengthRes.calculations && remStrengthRes.calculations.wall_loss_percent) || 0;
      var opRatio = (remStrengthRes && remStrengthRes.operating_ratio) || 0;
      var pressReduc = (remStrengthRes && remStrengthRes.pressure_reduction_required) || 0;
      var hasCrack = (fmdResult && fmdResult.cracking_path && fmdResult.cracking_path.active) || false;
      var confBand = (coreResult && coreResult.reality_confidence && coreResult.reality_confidence.band) || "";
      var conTier = (coreResult && coreResult.consequence_reality && coreResult.consequence_reality.consequence_tier) || "";

      var response = await fetch("/.netlify/functions/disposition-pathway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          safe_envelope: safeEnv,
          governing_failure_mode: govMode,
          governing_severity: govSev,
          reality_state: realState,
          disposition_blocked: dispBlocked,
          interaction_flag: interFlag,
          interaction_type: interType,
          brittle_fracture_risk: brittleRisk,
          wall_loss_percent: wallLoss,
          operating_ratio: opRatio,
          pressure_reduction_required: pressReduc,
          has_cracking: hasCrack,
          confidence_band: confBand,
          consequence_tier: conTier
        })
      });
      var result = await response.json();
      setDispositionPathwayResult(result);
      return result;
    } catch (err) {
      console.error("Disposition pathway error:", err);
      return null;
    }
  };

  var parsedRef = useRef<any>(null);
  var assetRef = useRef<any>(null);
  var stepsRef = useRef<StepState[]>([]);
  var errorsRef = useRef<string[]>([]);
  var inputTextRef = useRef<string>("");

  useEffect(function() {
    var SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      var recognition = new SR();
      recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
      recognition.onresult = function(event: any) { var ft = ""; for (var i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) ft += event.results[i][0].transcript + " "; } if (ft) setTranscript(function(prev) { return prev + ft; }); };
      recognition.onerror = function() { setIsListening(false); };
      recognition.onend = function() { setIsListening(false); };
      recognitionRef.current = recognition;
    }
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) { alert("Speech recognition not supported. Use Chrome."); return; }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); } else { recognitionRef.current.start(); setIsListening(true); }
  }

  function updateStep(idx: number, updates: Partial<StepState>, current: StepState[]): StepState[] {
    var next = current.slice(); next[idx] = Object.assign({}, next[idx], updates); return next;
  }

  async function handleGenerate(transcriptOverride?: string) {
    var inputText = transcriptOverride || transcript;
    if (!inputText.trim()) return;

    setIsGenerating(true); setPipelinePaused(false); setEvidenceConfirmPending(false);
    setPreliminaryEvidence(null); setErrors([]);
    setParsed(null); setAsset(null); setRealityLock(null);
    setDecisionCore(null); setAiNarrative(null);
    setSuperbrainResult(null); setSuperbrainError(null);
    setGrammarBridgeResult(null);
    setProvenanceResult(null); setProvenanceLoading(false);
    setHardeningResult(null); setHardeningLoading(false);
    setGbEditingField(null); setGbAmendments([]); setGbConfirmed(false);
    setAiQuestions(null); setAiUnderstood(null); setSelectedAnswers({});
    setSaveStatus("idle"); setSavedCaseId(null); setSaveError(null);
    // BUILD 1: Reset authority + strength
    setAuthorityLockResult(null); setRemainingStrengthResult(null);
    // BUILD 2: Reset failure mode + disposition
    setFailureModeDominanceResult(null); setDispositionPathwayResult(null);
    inputTextRef.current = inputText;

    var initialSteps: StepState[] = [
      { label: "AI Incident Parser (GPT-4o)", status: "pending" },
      { label: "Resolve Asset + Domain Gate", status: "pending" },
      { label: "Evidence Provenance (trust classification)", status: "pending" },
      { label: "Authority Lock + Remaining Strength", status: "pending" },
      { label: "Physics-First Decision Core (6 states)", status: "pending" },
      { label: "Superbrain Synthesis (Five Magic Features)", status: "pending" },
      { label: "Reality Hardening (challenge + unknown state)", status: "pending" },
      { label: "Failure Mode Dominance + Disposition Pathway", status: "pending" },
    ];
    var s = initialSteps.slice();
    setSteps(s); stepsRef.current = s;
    var errs: string[] = [];
    var parsedResult: any = null;
    var assetResult: any = null;

    try {
      s = updateStep(0, { status: "running" }, s); s = updateStep(1, { status: "running" }, s); setSteps(s.slice());

      // Grammar Bridge runs silently in parallel — results shown in readback panel
      var gbPromise = callAPI("voice-grammar-bridge", { action: "extract", transcript: inputText }).catch(function() { return null; });

      var [parseRes, assetRes] = await Promise.allSettled([
        callAPI("parse-incident", { transcript: inputText }),
        callAPI("resolve-asset", { raw_text: inputText }),
      ]);

      // Grammar Bridge result (non-blocking)
      try {
        var gbValue = await gbPromise;
        if (gbValue && gbValue.ok) {
          setGrammarBridgeResult(gbValue.result || gbValue);
        }
      } catch (gbErr) { /* Grammar bridge failure is non-blocking */ }

      if (parseRes.status === "fulfilled") {
        parsedResult = parseRes.value.parsed || parseRes.value;
        setParsed(parsedResult);
        if (parseRes.value.needs_input && parseRes.value.questions) {
          setAiQuestions(parseRes.value.questions);
          setAiUnderstood(parseRes.value.understood || "");
          for (var wi = 3; wi < s.length; wi++) s = updateStep(wi, { status: "waiting", detail: "waiting for answers" }, s);
          s = updateStep(0, { status: "done", detail: (parsedResult?.events?.length || 0) + " events" }, s);
          if (assetRes.status === "fulfilled") {
            assetResult = assetRes.value.resolved || assetRes.value;
            setAsset(assetResult);
            s = updateStep(1, { status: "done", detail: assetResult?.asset_class || "" }, s);
          }
          setSteps(s.slice()); stepsRef.current = s; setErrors(errs); errorsRef.current = errs;
          setIsGenerating(false); setPipelinePaused(true);
          return;
        }
        s = updateStep(0, { status: "done", detail: (parsedResult?.events?.length || 0) + " events" }, s);
      } else {
        s = updateStep(0, { status: "error", detail: parseRes.reason?.message }, s);
        errs.push("parse-incident: " + parseRes.reason?.message);
        parsedResult = { events: [], environment: [], numeric_values: {}, raw_text: inputText };
        setParsed(parsedResult);
      }

      if (assetRes.status === "fulfilled") {
        assetResult = assetRes.value.resolved || assetRes.value;
        setAsset(assetResult);
        try {
          var rlRes = await callAPI("reality-lock", {
            transcript: inputText,
            parsed_asset_class: assetResult?.asset_class || "unknown",
            parsed_asset_confidence: assetResult?.confidence || 0
          });
          var rlResult = rlRes.reality_lock || rlRes;
          setRealityLock(rlResult);
          if (rlResult.asset_conflict && rlResult.asset_override) {
            assetResult = { asset_class: rlResult.asset_override, asset_type: rlResult.asset_override, confidence: assetResult?.confidence || 0.5 };
            setAsset(assetResult);
          }
          s = updateStep(1, { status: "done", detail: (assetResult?.asset_class || "") + " | " + (rlResult.detected_domain_label || "domain ok") }, s);
        } catch (rlErr: any) {
          s = updateStep(1, { status: "done", detail: assetResult?.asset_class || "" }, s);
        }
      } else {
        s = updateStep(1, { status: "error" }, s);
        errs.push("resolve-asset: " + assetRes.reason?.message);
        assetResult = { asset_class: "unknown", asset_type: "unknown", confidence: 0.3 };
        setAsset(assetResult);
      }
      setSteps(s.slice());

      parsedRef.current = parsedResult;
      assetRef.current = assetResult;
      stepsRef.current = s;
      errorsRef.current = errs;

      var prelimEvidence = extractPreliminaryEvidence(parsedResult, assetResult);
      setPreliminaryEvidence(prelimEvidence);
      setEvidenceConfirmPending(true);

      for (var ei = 3; ei < s.length; ei++) s = updateStep(ei, { status: "waiting", detail: "waiting for evidence confirmation" }, s);
      setSteps(s.slice()); stepsRef.current = s;
      setErrors(errs); errorsRef.current = errs;
      setIsGenerating(false);
      setTimeout(function() { if (resultsRef.current) resultsRef.current.scrollIntoView({ behavior: "smooth" }); }, 200);

    } catch (e: any) {
      errs.push("Pipeline error: " + e.message);
      setErrors(errs); setIsGenerating(false);
    }
  }

  async function continuePipeline(confirmedFlags: any) {
    setIsGenerating(true); setEvidenceConfirmPending(false);
    var parsedResult = parsedRef.current;
    var assetResult = assetRef.current;
    var inputText = inputTextRef.current;
    var s = stepsRef.current.slice();
    var errs = errorsRef.current.slice();

    try {
      // STEP 2: EVIDENCE PROVENANCE — v16.0
      s = updateStep(2, { status: "running", detail: "classifying evidence trust..." }, s); setSteps(s.slice());
      var provenanceData: any = null;
      try {
        setProvenanceLoading(true);
        var provRes = await callAPI("evidence-provenance", {
          transcript: inputText,
          numeric_values: parsedResult ? parsedResult.numeric_values || {} : {},
          methods: [],
          findings: []
        });
        if (provRes && provRes.ok) {
          provenanceData = provRes;
          setProvenanceResult(provRes);
          var trustLabel = (provRes.provenance_summary ? provRes.provenance_summary.trust_band : "?");
          var evidenceCount = (provRes.evidence ? provRes.evidence.length : 0);
          s = updateStep(2, { status: "done", detail: trustLabel + " trust | " + evidenceCount + " items" }, s);
        } else {
          s = updateStep(2, { status: "done", detail: "no provenance data" }, s);
        }
      } catch (provErr: any) {
        s = updateStep(2, { status: "error", detail: provErr.message }, s);
        errs.push("evidence-provenance: " + provErr.message);
      }
      setProvenanceLoading(false);
      setSteps(s.slice());

      // STEP 3: AUTHORITY LOCK + REMAINING STRENGTH — Build 1
      s = updateStep(3, { status: "running", detail: "resolving governing authority..." }, s); setSteps(s.slice());
      var authResult: any = null;
      try {
        authResult = await callAuthorityLock(assetResult, parsedResult, grammarBridgeResult, confirmedFlags);
        if (authResult && authResult.status === "LOCKED") {
          var codeCount = (authResult.authority_chain || []).length;
          var suppCount = (authResult.supplemental_codes || []).length;
          var authDetail = "LOCKED | " + codeCount + " primary";
          if (suppCount > 0) authDetail = authDetail + " + " + suppCount + " supplemental";
          if (authResult.trigger_b31g) authDetail = authDetail + " | B31G triggered";
          s = updateStep(3, { status: "done", detail: authDetail }, s);

          // Auto-trigger remaining strength if B31G flagged
          if (authResult.trigger_b31g) {
            var strengthResult = await callRemainingStrength(parsedResult, grammarBridgeResult);
            if (strengthResult) {
              authDetail = authDetail + " | MAOP: " + strengthResult.governing_maop + " psi";
              s = updateStep(3, { status: "done", detail: authDetail }, s);
            }
          }
        } else if (authResult) {
          s = updateStep(3, { status: "done", detail: authResult.status + " | " + (authResult.lock_reasons || []).length + " reasons" }, s);
        } else {
          s = updateStep(3, { status: "done", detail: "no authority data" }, s);
        }
      } catch (authErr: any) {
        s = updateStep(3, { status: "error", detail: authErr.message }, s);
        errs.push("authority-lock: " + authErr.message);
      }
      setSteps(s.slice());

      // STEP 4: DECISION CORE
      s = updateStep(4, { status: "running", detail: "6 Klein bottle states..." }, s); setSteps(s.slice());
      var coreResult: any = null;
      try {
        var coreRes = await callAPI("decision-core", {
          parsed: parsedResult,
          asset: assetResult,
          confirmed_flags: confirmedFlags,
          transcript: inputText,
          reality_lock: realityLock,
          evidence_provenance: provenanceData,
          authority_lock: authResult
        });
        coreResult = coreRes.decision_core || coreRes;
        setDecisionCore(coreResult);
        if (coreResult) {
          var txVal = '';
          try { if (transcript) { txVal = String(transcript); } } catch(ex) {}
          // Fire background calls (stored, not rendered)
          callEngineeringCore(coreResult, txVal);
          callArchitectureCore(coreResult, txVal);
          callMaterialsCore(coreResult, txVal);
        }
        var tier = coreResult?.consequence_reality?.consequence_tier || "?";
        var disp = coreResult?.decision_reality?.disposition || "?";
        var elapsed = coreResult?.elapsed_ms || "?";
        if (coreResult?.asset_correction?.corrected) {
          s = updateStep(1, { status: "done", detail: coreResult.asset_correction.corrected_to + " (corrected from " + coreResult.asset_correction.original + ")" }, s);
        }
        s = updateStep(4, { status: "done", detail: tier + " | " + disp + " | " + elapsed + "ms" }, s);
      } catch (e: any) {
        s = updateStep(4, { status: "error", detail: e.message }, s);
        errs.push("decision-core: " + e.message);
      }
      setSteps(s.slice());

      // STEP 5: SUPERBRAIN SYNTHESIS — v15.0
      s = updateStep(5, { status: "running", detail: "GPT-4o constrained by decision-core..." }, s); setSteps(s.slice());
      if (coreResult) {
        try {
          var sbRes = await fetch('/.netlify/functions/superbrain-synthesis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              decision_core: coreResult,
              transcript: inputText
            })
          });
          if (sbRes.ok) {
            var sbData = await sbRes.json();
            setSuperbrainResult(sbData);
            var featureCount = 0;
            if (sbData.synthesis) {
              if (sbData.synthesis.failure_narrative) featureCount++;
              if (sbData.synthesis.contradiction_matrix) featureCount++;
              if (sbData.synthesis.pre_inspection_briefing) featureCount++;
              if (sbData.synthesis.procedure_forensics) featureCount++;
              if (sbData.synthesis.inspector_action_card) featureCount++;
            }
            s = updateStep(5, { status: "done", detail: featureCount + " features synthesized" }, s);
          } else {
            var sbErrText = await sbRes.text();
            setSuperbrainError('Status ' + sbRes.status);
            s = updateStep(5, { status: "error", detail: "status " + sbRes.status }, s);
            errs.push("superbrain-synthesis: " + sbErrText.substring(0, 200));
            // FALLBACK: try old narrative
            try {
              var planRes = await callAPI("voice-incident-plan", { transcript: inputText, decisionResult: coreResult });
              var narrative = planRes?.plan || planRes?.text || planRes?.result || JSON.stringify(planRes);
              setAiNarrative(typeof narrative === "string" ? narrative : JSON.stringify(narrative));
              s = updateStep(5, { status: "done", detail: "fallback narrative" }, s);
            } catch (fallbackErr: any) {
              errs.push("narrative fallback: " + fallbackErr.message);
            }
          }
        } catch (sbEx: any) {
          setSuperbrainError(sbEx.message || String(sbEx));
          s = updateStep(5, { status: "error", detail: sbEx.message }, s);
          errs.push("superbrain-synthesis: " + sbEx.message);
        }
      } else {
        s = updateStep(5, { status: "error", detail: "no decision-core data" }, s);
      }
      setSteps(s.slice());

      // STEP 6: REALITY HARDENING — Sprint 1
      s = updateStep(6, { status: "running", detail: "challenge + unknown state..." }, s); setSteps(s.slice());
      if (coreResult) {
        try {
          setHardeningLoading(true);
          var hardenRes = await runHardeningPipeline(
            inputText,
            parsedResult,
            assetResult,
            grammarBridgeResult,
            provenanceData,
            coreResult.damage_reality || null,
            coreResult.inspection_reality || null,
            coreResult.authority_reality || null,
            coreResult.contradiction_engine || null,
            coreResult.consequence_reality || null,
            coreResult,
            savedCaseId || undefined
          );
          setHardeningResult(hardenRes);
          var rState = hardenRes?.unknownStateResult?.reality_state || "?";
          var tFacts = hardenRes?.trustedFacts?.length || 0;
          s = updateStep(6, { status: "done", detail: rState + " | " + tFacts + " trusted facts" }, s);
        } catch (hErr: any) {
          s = updateStep(6, { status: "error", detail: hErr.message }, s);
          errs.push("hardening: " + hErr.message);
        } finally {
          setHardeningLoading(false);
        }
      } else {
        s = updateStep(6, { status: "error", detail: "no decision-core data" }, s);
      }
      setSteps(s.slice());

      // STEP 7: FAILURE MODE DOMINANCE + DISPOSITION PATHWAY — Build 2
      s = updateStep(7, { status: "running", detail: "evaluating failure modes + disposition..." }, s); setSteps(s.slice());
      try {
        var fmdResult = await callFailureModeDominance(parsedResult, grammarBridgeResult, confirmedFlags, authorityLockResult, remainingStrengthResult);
        if (fmdResult) {
          var govMode = fmdResult.governing_failure_mode || "?";
          var govSev = fmdResult.governing_severity || "?";
          var fmdDetail = govMode + " | " + govSev;
          if (fmdResult.interaction_flag) fmdDetail = fmdDetail + " | INTERACTION";

          var dpResult = await callDispositionPathway(fmdResult, remainingStrengthResult, hardenRes, coreResult);
          if (dpResult) {
            fmdDetail = fmdDetail + " | " + dpResult.disposition;
            s = updateStep(7, { status: "done", detail: fmdDetail }, s);
          } else {
            s = updateStep(7, { status: "done", detail: fmdDetail + " | no disposition" }, s);
          }
        } else {
          s = updateStep(7, { status: "done", detail: "no failure mode data" }, s);
        }
      } catch (fmdErr: any) {
        s = updateStep(7, { status: "error", detail: fmdErr.message }, s);
        errs.push("failure-mode-dominance: " + fmdErr.message);
      }
      setSteps(s.slice());

    } catch (e: any) { errs.push("Pipeline error: " + e.message); }

    setErrors(errs); setIsGenerating(false);
    setTimeout(function() { if (resultsRef.current) resultsRef.current.scrollIntoView({ behavior: "smooth" }); }, 200);
  }

  function handleConfirmEvidence(confirmed: any) { continuePipeline(confirmed); }
  function handleSkipEvidence() { continuePipeline(null); }
  function handleGenerateWithAnswers() {
    var answers = Object.values(selectedAnswers).join(". ") + ".";
    var enriched = transcript + " " + answers;
    setTranscript(enriched); setAiQuestions(null); setSelectedAnswers({}); setPipelinePaused(false);
    handleGenerate(enriched);
  }

  var dc = decisionCore;
  var phy = dc?.physical_reality;
  var dmg = dc?.damage_reality;
  var con = dc?.consequence_reality;
  var auth = dc?.authority_reality;
  var insp = dc?.inspection_reality;
  var comp = dc?.physics_computations;
  var conf = dc?.reality_confidence;
  var dec = dc?.decision_reality;
  var syn = superbrainResult?.synthesis;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 4px 0", color: "#111" }}>FORGED NDT Intelligence OS {"\u2014"} Physics-First Decision Core</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>Describe the inspection scenario. The system starts with physics, not codes. Every answer is inarguable.</p>
      </div>

      <div style={{ marginBottom: "20px", border: "1px solid #d1d5db", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
        <textarea value={transcript} onChange={function(e) { setTranscript(e.target.value); }} placeholder="Describe the scenario \u2014 asset, damage, method, conditions..." style={{ width: "100%", minHeight: "120px", padding: "14px 16px", fontSize: "14px", lineHeight: "1.6", border: "none", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>{transcript.length > 0 ? transcript.split(/\s+/).filter(Boolean).length + " words" : "Speak or type"}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={toggleMic} style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 700, color: isListening ? "#fff" : "#dc2626", backgroundColor: isListening ? "#dc2626" : "#fff", border: "2px solid #dc2626", borderRadius: "6px", cursor: "pointer" }}>{isListening ? "\uD83D\uDD34 Listening..." : "\uD83C\uDF99\uFE0F Mic"}</button>
            <button onClick={function() { handleGenerate(); }} disabled={isGenerating || !transcript.trim()} style={{ padding: "8px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#2563eb", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer" }}>{isGenerating ? "Analyzing..." : "Analyze"}</button>
          </div>
        </div>
      </div>

      {steps.length > 0 && <StepTracker steps={steps} />}

      {errors.length > 0 && (<div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>{errors.map(function(e, i) { return <div key={i} style={{ fontSize: "12px", color: "#dc2626", padding: "2px 0" }}>{e}</div>; })}</div>)}

      <div ref={resultsRef}>

        {/* GRAMMAR BRIDGE INTERACTIVE READBACK — v16.1 */}
        {grammarBridgeResult && evidenceConfirmPending && (
          <div style={{ margin: "0 0 16px 0", padding: "16px", backgroundColor: gbConfirmed ? "#f0fdf4" : "#f0f9ff", border: "1px solid " + (gbConfirmed ? "#bbf7d0" : "#bae6fd"), borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: gbConfirmed ? "#16a34a" : "#0369a1" }}>
                {gbConfirmed ? "\u2705 Readback Confirmed" : "\uD83C\uDF99\uFE0F Voice Grammar Bridge \u2014 Review & Edit"}
              </div>
              <div style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "4px", backgroundColor: grammarBridgeResult.completeness === "COMPLETE" ? "#dcfce7" : grammarBridgeResult.completeness === "NEAR_COMPLETE" ? "#fef9c3" : "#fee2e2", color: grammarBridgeResult.completeness === "COMPLETE" ? "#166534" : grammarBridgeResult.completeness === "NEAR_COMPLETE" ? "#854d0e" : "#991b1b", fontWeight: 600 }}>
                {grammarBridgeResult.completeness} ({grammarBridgeResult.field_count ? grammarBridgeResult.field_count.extracted + "/" + grammarBridgeResult.field_count.total_required : ""})
              </div>
            </div>
            <div style={{ fontSize: "14px", color: "#1e3a5f", lineHeight: "1.6", padding: "10px 12px", backgroundColor: "#fff", borderRadius: "6px", border: "1px solid #e0f2fe", marginBottom: "12px" }}>
              {grammarBridgeResult.readback || "No readback generated"}
            </div>

            {/* EDITABLE FIELD GRID */}
            {grammarBridgeResult.extracted && !gbConfirmed && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "12px" }}>
                {[
                  { key: "asset_type", label: "Asset", color: "#7c3aed", bg: "#f5f3ff", options: ["piping", "pressure_vessel", "pipeline", "tank", "bridge", "rail_bridge", "offshore_platform", "boiler", "heat_exchanger"] },
                  { key: "material", label: "Material", color: "#6b21a8", bg: "#faf5ff", options: ["carbon_steel", "alloy_steel", "stainless_steel", "duplex", "nickel_alloy", "aluminum", "titanium", "cast_iron"] },
                  { key: "primary_finding", label: "Primary Finding", color: "#92400e", bg: "#fffbeb", options: ["wall_loss", "crack", "pitting", "corrosion", "deformation", "leak", "erosion", "cui", "fatigue", "scc", "fire_damage", "creep"] },
                  { key: "service_fluid", label: "Service", color: "#3730a3", bg: "#e0e7ff", options: ["amine", "hydrogen", "h2s", "crude", "steam", "water", "caustic", "acid", "ammonia", "natural_gas", "refined_product"] },
                  { key: "primary_location", label: "Location", color: "#0e7490", bg: "#ecfeff", options: ["elbow", "weld", "nozzle", "flange", "support", "intrados", "extrados", "tee", "bottom", "connection", "gusset", "web", "haz"] },
                  { key: "orientation", label: "Orientation", color: "#4338ca", bg: "#eef2ff", options: ["horizontal", "vertical", "inclined", "overhead", "underground"] }
                ].map(function(fieldDef, fdi) {
                  var currentVal = grammarBridgeResult.extracted[fieldDef.key];
                  var isEditing = gbEditingField === fieldDef.key;
                  return (
                    <div key={fdi} style={{ position: "relative" }}>
                      <div onClick={function() { setGbEditingField(isEditing ? null : fieldDef.key); }} style={{ padding: "8px 10px", borderRadius: "6px", backgroundColor: currentVal ? fieldDef.bg : "#f9fafb", border: "1px solid " + (currentVal ? fieldDef.color + "40" : "#e5e7eb"), cursor: "pointer", minHeight: "52px" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "2px" }}>{fieldDef.label}</div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: currentVal ? fieldDef.color : "#9ca3af" }}>
                          {currentVal ? currentVal.replace(/_/g, " ") : "\u2014 tap to add"}
                        </div>
                      </div>
                      {isEditing && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, backgroundColor: "#fff", border: "1px solid #d1d5db", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: "200px", overflowY: "auto", marginTop: "2px" }}>
                          {fieldDef.options.map(function(opt, oi) {
                            var isCurrent = currentVal === opt;
                            return (
                              <div key={oi} onClick={function() { handleGbAmend(fieldDef.key, opt); }} style={{ padding: "8px 12px", fontSize: "12px", cursor: "pointer", backgroundColor: isCurrent ? fieldDef.bg : "transparent", fontWeight: isCurrent ? 700 : 400, color: isCurrent ? fieldDef.color : "#374151", borderBottom: "1px solid #f3f4f6" }}>
                                {opt.replace(/_/g, " ")}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* NDE METHODS + FINDINGS (read-only badges) */}
            {grammarBridgeResult.extracted && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {grammarBridgeResult.extracted.nde_methods && grammarBridgeResult.extracted.nde_methods.map(function(m: string, mi: number) {
                  return <span key={"m" + mi} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>{m}</span>;
                })}
                {grammarBridgeResult.extracted.finding_types && grammarBridgeResult.extracted.finding_types.map(function(f: string, fi: number) {
                  return <span key={"f" + fi} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 500 }}>{f.replace(/_/g, " ")}</span>;
                })}
                {grammarBridgeResult.extracted.locations && grammarBridgeResult.extracted.locations.map(function(l: string, li: number) {
                  return <span key={"l" + li} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#ecfeff", color: "#0e7490", fontWeight: 500 }}>{l.replace(/_/g, " ")}</span>;
                })}
              </div>
            )}

            {/* NUMERIC VALUES */}
            {grammarBridgeResult.extracted && grammarBridgeResult.extracted.numeric && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                {grammarBridgeResult.extracted.numeric.diameter_inches && <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#f3f4f6", color: "#374151" }}>{grammarBridgeResult.extracted.numeric.diameter_inches}" dia</span>}
                {grammarBridgeResult.extracted.numeric.wall_loss_percent && <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: 600 }}>{grammarBridgeResult.extracted.numeric.wall_loss_percent}% wall loss</span>}
                {grammarBridgeResult.extracted.numeric.temperature_f && <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#f3f4f6", color: "#374151" }}>{grammarBridgeResult.extracted.numeric.temperature_f}{"\u00B0"}F</span>}
                {grammarBridgeResult.extracted.numeric.pressure_psi && <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#f3f4f6", color: "#374151" }}>{grammarBridgeResult.extracted.numeric.pressure_psi} psi</span>}
                {grammarBridgeResult.extracted.numeric.service_years && <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", backgroundColor: "#f3f4f6", color: "#374151" }}>{grammarBridgeResult.extracted.numeric.service_years} yrs</span>}
              </div>
            )}

            {/* RISK FLAGS */}
            {grammarBridgeResult.risk_flags && grammarBridgeResult.risk_flags.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                {grammarBridgeResult.risk_flags.map(function(rf: any, ri: number) {
                  var rfBg = rf.severity === "critical" ? "#fef2f2" : rf.severity === "high" ? "#fffbeb" : "#f0f9ff";
                  var rfBorder = rf.severity === "critical" ? "#fecaca" : rf.severity === "high" ? "#fde68a" : "#bae6fd";
                  var rfColor = rf.severity === "critical" ? "#991b1b" : rf.severity === "high" ? "#92400e" : "#0369a1";
                  var rfIcon = rf.severity === "critical" ? "\uD83D\uDED1" : rf.severity === "high" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
                  return (
                    <div key={ri} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: rfBg, border: "1px solid " + rfBorder, borderRadius: "4px", color: rfColor }}>
                      {rfIcon} {rf.message}
                    </div>
                  );
                })}
              </div>
            )}

            {/* MISSING FIELDS */}
            {grammarBridgeResult.missing_required && grammarBridgeResult.missing_required.length > 0 && !gbConfirmed && (
              <div style={{ padding: "8px 10px", backgroundColor: "#fffbeb", borderRadius: "4px", border: "1px solid #fde68a", marginBottom: "10px", fontSize: "12px", color: "#92400e" }}>
                <strong>Missing:</strong> {grammarBridgeResult.missing_required.join(", ").replace(/_/g, " ")} {"\u2014"} <em>tap a field above to add</em>
              </div>
            )}

            {/* AMENDMENT TRAIL */}
            {gbAmendments.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Amendment Trail ({gbAmendments.length})</div>
                {gbAmendments.map(function(am: any, ai: number) {
                  return (
                    <div key={ai} style={{ fontSize: "11px", padding: "4px 8px", marginBottom: "2px", backgroundColor: "#fefce8", borderRadius: "3px", borderLeft: "2px solid #ca8a04", color: "#374151" }}>
                      <strong>{am.field.replace(/_/g, " ")}:</strong> set to <strong>{am.value.replace(/_/g, " ")}</strong>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CONFIRM BUTTON */}
            {!gbConfirmed && (
              <button onClick={handleGbConfirm} style={{ width: "100%", padding: "10px", fontSize: "13px", fontWeight: 700, color: "#fff", backgroundColor: "#0369a1", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                {"\u2705"} Confirm Readback
              </button>
            )}
          </div>
        )}

        {evidenceConfirmPending && preliminaryEvidence && (
          <EvidenceConfirmationCard evidence={preliminaryEvidence} onConfirm={handleConfirmEvidence} onSkip={handleSkipEvidence} isGenerating={isGenerating} />
        )}

        {pipelinePaused && aiQuestions && aiQuestions.length > 0 && (
          <Card title="AI Needs More Information" icon={"\uD83E\uDD14"} collapsible={false}>
            {aiUnderstood && <div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px", padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "3px solid #16a34a" }}><strong>Understood:</strong> {aiUnderstood}</div>}
            {aiQuestions.map(function(q: any, i: number) {
              var qKey = "q" + i; var selected = selectedAnswers[qKey] || "";
              return (
                <div key={i} style={{ marginBottom: "14px", padding: "10px 12px", backgroundColor: selected ? "#f0fdf4" : "#fafafa", borderRadius: "6px", borderLeft: selected ? "3px solid #16a34a" : "3px solid #2563eb" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>{i + 1}. {q.question}</div>
                  {q.options && q.options.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                      {q.options.map(function(opt: string, oi: number) {
                        var isSel = selected === opt;
                        return <button key={oi} onClick={function() { setSelectedAnswers(function(prev: any) { var n = Object.assign({}, prev); if (isSel) delete n[qKey]; else n[qKey] = opt; return n; }); }} style={{ padding: "6px 14px", fontSize: "13px", fontWeight: isSel ? 700 : 400, backgroundColor: isSel ? "#16a34a" : "#fff", color: isSel ? "#fff" : "#1e40af", border: isSel ? "2px solid #16a34a" : "2px solid #bfdbfe", borderRadius: "6px", cursor: "pointer" }}>{opt}</button>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(selectedAnswers).length > 0 && (
              <button onClick={handleGenerateWithAnswers} disabled={isGenerating} style={{ width: "100%", padding: "10px 28px", fontSize: "15px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#16a34a", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer", marginTop: "12px" }}>{"\u2705"} Generate with Answers</button>
            )}
          </Card>
        )}

        {/* ACTION BUTTONS */}
        {dc && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={function() { generateInspectionReport({ transcript: transcript, parsed: parsed, asset: asset, decisionCore: dc, aiNarrative: aiNarrative, superbrainResult: superbrainResult, provenanceResult: provenanceResult }); }} style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: "#1e40af", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                {"\uD83D\uDCC4"} Export PDF
              </button>
              {saveStatus === "saved" ? (
                <div style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: "#16a34a", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {"\u2705"} Saved {"\u2014"} {savedCaseId}
                </div>
              ) : (
                <button onClick={handleSaveToCase} disabled={saveStatus === "saving"} style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: saveStatus === "saving" ? "#9ca3af" : "#16a34a", border: "none", borderRadius: "6px", cursor: saveStatus === "saving" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {saveStatus === "saving" ? "\u23F3 Saving..." : "\uD83D\uDCBE Save to Cases"}
                </button>
              )}
            </div>
            {saveStatus === "saved" && (
              <div style={{ marginTop: "8px", padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#16a34a" }}>{"\u2705"} Case {savedCaseId} saved</span>
                <a href="/cases" style={{ fontSize: "13px", fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>View Cases {"\u2192"}</a>
              </div>
            )}
            {saveStatus === "error" && (
              <div style={{ marginTop: "8px", padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", color: "#dc2626" }}>
                {"\u274c"} {saveError}
              </div>
            )}
          </div>
        )}

        {/* CONFIDENCE BAND */}
        {conf && (
          <div style={{ marginBottom: "16px", padding: "14px 18px", backgroundColor: conf.band === "TRUSTED" || conf.band === "HIGH" ? "#f0fdf4" : conf.band === "GUARDED" ? "#fffbeb" : "#fef2f2", border: "2px solid " + bandColor(conf.band), borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>{conf.band === "TRUSTED" || conf.band === "HIGH" ? "\u2705" : conf.band === "GUARDED" ? "\u26A0\uFE0F" : "\uD83D\uDED1"}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "16px", color: bandColor(conf.band) }}>Reality Confidence: {conf.band}</div>
                  <div style={{ fontSize: "12px", color: "#374151" }}>Overall: {Math.round(conf.overall * 100)}% {"\u2014"} {conf.certainty_state === "blocked" ? "Disposition BLOCKED" : conf.certainty_state === "escalated" ? "Escalation Required" : "Decision Eligible"}</div>
                </div>
              </div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: bandColor(conf.band) }}>{Math.round(conf.overall * 100)}%</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "8px" }}>
              {[
                { label: "Physics", value: conf.physics_confidence },
                { label: "Damage", value: conf.damage_confidence },
                { label: "Consequence", value: conf.consequence_confidence },
                { label: "Authority", value: conf.authority_confidence },
                { label: "Inspection", value: conf.inspection_confidence },
              ].map(function(dim, i) {
                var pctVal = Math.round(dim.value * 100);
                var c = pctVal >= 70 ? "#16a34a" : pctVal >= 50 ? "#ca8a04" : "#dc2626";
                return (
                  <div key={i} style={{ textAlign: "center", padding: "6px", backgroundColor: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>{dim.label}</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: c }}>{pctVal}%</div>
                  </div>
                );
              })}
            </div>
            {conf.limiting_factors && conf.limiting_factors.length > 0 && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#6b7280" }}>
                <strong>Limiting:</strong> {conf.limiting_factors.join(" | ")}
              </div>
            )}
          </div>
        )}

        {/* CONSEQUENCE */}
        {con && (
          <Card title={"Consequence: " + con.consequence_tier} icon={con.consequence_tier === "CRITICAL" ? "\uD83D\uDED1" : con.consequence_tier === "HIGH" ? "\u26A0\uFE0F" : "\u2139\uFE0F"} collapsible={false}>
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "12px", fontWeight: 800, fontSize: "18px", color: "#fff", backgroundColor: tierColor(con.consequence_tier), textAlign: "center" }}>
              {con.consequence_tier} CONSEQUENCE {"\u2014"} {con.failure_mode.replace(/_/g, " ").toUpperCase()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div style={{ padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Human Impact</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>{con.human_impact}</div>
              </div>
              <div style={{ padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Damage State</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: con.damage_state === "TRANSITION_RISK" ? "#dc2626" : con.damage_state === "APPROACHING_THRESHOLD" ? "#ea580c" : "#111" }}>{(con.damage_state || "STABLE").replace(/_/g, " ")}</div>
              </div>
              <div style={{ padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Degradation</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: con.degradation_certainty === "CONFIRMED" ? "#dc2626" : con.degradation_certainty === "SUSPECTED" ? "#ea580c" : "#16a34a" }}>{con.degradation_certainty || "UNVERIFIED"}</div>
              </div>
              <div style={{ padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Monitoring</div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{con.monitoring_urgency || "Routine"}</div>
              </div>
            </div>
            {con.failure_physics && <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151", marginBottom: "10px", padding: "10px 12px", backgroundColor: "#f0f4ff", borderRadius: "6px", borderLeft: "3px solid #2563eb" }}><strong>Failure Physics:</strong> {con.failure_physics}</div>}
            {con.damage_trajectory && <div style={{ fontSize: "12px", color: "#374151", marginBottom: "8px" }}><strong>Trajectory:</strong> {con.damage_trajectory}</div>}
            {con.consequence_basis && con.consequence_basis.map(function(b: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#374151", padding: "2px 0" }}>{b}</div>; })}
          </Card>
        )}

        {/* DECISION */}
        {dec && (
          <Card title={"Decision: " + (dec.disposition || "").replace(/_/g, " ").toUpperCase()} icon={dec.disposition === "no_go" ? "\uD83D\uDED1" : dec.disposition === "hold_for_review" ? "\u23F8\uFE0F" : dec.disposition === "engineering_review_required" ? "\u26A0\uFE0F" : "\u2705"} collapsible={false}>
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "12px", fontWeight: 800, fontSize: "16px", color: "#fff", backgroundColor: dec.disposition === "no_go" ? "#dc2626" : dec.disposition === "repair_before_restart" ? "#ea580c" : dec.disposition === "hold_for_review" || dec.disposition === "engineering_review_required" ? "#ca8a04" : "#16a34a", textAlign: "center" }}>
              {(dec.disposition || "").replace(/_/g, " ").toUpperCase()}
            </div>
            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px" }}>{dec.disposition_basis}</div>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Precedence Gates</div>
              {dec.gates && dec.gates.map(function(g: any, i: number) {
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", marginBottom: "3px", backgroundColor: g.result === "BLOCKED" ? "#fef2f2" : g.result === "ESCALATED" ? "#fffbeb" : "#f0fdf4", borderRadius: "4px" }}>
                    <span style={{ fontSize: "14px" }}>{gateIcon(g.result)}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: "12px", color: gateColor(g.result) }}>{g.gate.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "8px" }}>{g.reason}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {dec.hard_locks && dec.hard_locks.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginBottom: "6px" }}>Hard Locks ({dec.hard_locks.length})</div>
                {dec.hard_locks.map(function(hl: any, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#fef2f2", borderRadius: "4px", borderLeft: "3px solid #dc2626" }}><strong>{hl.code}:</strong> {hl.reason} <span style={{ fontSize: "11px", color: "#6b7280" }}>({hl.physics_basis})</span></div>;
                })}
              </div>
            )}
          </Card>
        )}

        {/* ================================================================ */}
        {/* SUPERBRAIN INTELLIGENCE — FIVE MAGIC FEATURES                    */}
        {/* ================================================================ */}

        {syn && (
          <div style={{ marginTop: "8px", marginBottom: "8px", padding: "8px 16px", backgroundColor: "#1e40af", borderRadius: "6px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>{"\uD83E\uDDE0"}</span>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#fff" }}>Superbrain Intelligence</span>
            <span style={{ fontSize: "11px", color: "#93c5fd" }}>5 features synthesized from decision-core v2.5</span>
          </div>
        )}

        {/* FEATURE 1: FAILURE NARRATIVE */}
        {syn && syn.failure_narrative && (
          <Card title="Failure Narrative" icon={"\uD83D\uDCD6"} accent="#2563eb" collapsible={true} defaultCollapsed={false}>
            <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#1a1a1a", whiteSpace: "pre-wrap" }}>{syn.failure_narrative}</div>
          </Card>
        )}

        {/* FEATURE 5: INSPECTOR ACTION CARD */}
        {syn && syn.inspector_action_card && syn.inspector_action_card.length > 0 && (
          <Card title="Inspector Action Card" icon={"\u2705"} accent="#16a34a" collapsible={true} defaultCollapsed={false}>
            {syn.inspector_action_card.map(function(action: any, i: number) {
              return (
                <div key={i} style={{ padding: "10px 12px", marginBottom: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", borderLeft: "3px solid #16a34a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 800, fontSize: "16px", color: "#16a34a", backgroundColor: "#f0fdf4", width: "28px", height: "28px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#111" }}>{action.step}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px", paddingLeft: "36px" }}>{action.rationale}</div>
                  <div style={{ paddingLeft: "36px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <div style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "#f0fdf4", borderRadius: "4px", borderLeft: "2px solid #16a34a" }}>
                      <strong style={{ color: "#16a34a" }}>If confirmed:</strong> <span style={{ color: "#374151" }}>{action.threshold_if_positive}</span>
                    </div>
                    <div style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "#fef2f2", borderRadius: "4px", borderLeft: "2px solid #dc2626" }}>
                      <strong style={{ color: "#dc2626" }}>If not found:</strong> <span style={{ color: "#374151" }}>{action.threshold_if_negative}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* FEATURE 3: PRE-INSPECTION BRIEFING */}
        {syn && syn.pre_inspection_briefing && (
          <Card title="Pre-Inspection Briefing" icon={"\uD83C\uDFAF"} accent="#7c3aed" collapsible={true} defaultCollapsed={false} status="What to Look For">
            {syn.pre_inspection_briefing.target_zones && syn.pre_inspection_briefing.target_zones.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", marginBottom: "6px" }}>Target Zones</div>
                {syn.pre_inspection_briefing.target_zones.map(function(z: string, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#f5f3ff", borderRadius: "4px", borderLeft: "3px solid #7c3aed", color: "#374151" }}>{z}</div>;
                })}
              </div>
            )}
            {syn.pre_inspection_briefing.expected_flaws && syn.pre_inspection_briefing.expected_flaws.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Expected Flaw Morphology</div>
                {syn.pre_inspection_briefing.expected_flaws.map(function(f: string, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#f9fafb", borderRadius: "4px", color: "#374151" }}>{f}</div>;
                })}
              </div>
            )}
            {syn.pre_inspection_briefing.method_recommendations && syn.pre_inspection_briefing.method_recommendations.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Method Recommendations</div>
                {syn.pre_inspection_briefing.method_recommendations.map(function(m: string, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#eff6ff", borderRadius: "4px", borderLeft: "3px solid #2563eb", color: "#374151" }}>{m}</div>;
                })}
              </div>
            )}
            {syn.pre_inspection_briefing.sensitivity_settings && (
              <div style={{ fontSize: "12px", color: "#374151", marginBottom: "8px" }}><strong>Sensitivity:</strong> {syn.pre_inspection_briefing.sensitivity_settings}</div>
            )}
            {syn.pre_inspection_briefing.watch_items && syn.pre_inspection_briefing.watch_items.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#ea580c", textTransform: "uppercase", marginBottom: "6px" }}>Watch Items</div>
                {syn.pre_inspection_briefing.watch_items.map(function(w: string, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#fffbeb", borderRadius: "4px", borderLeft: "3px solid #ea580c", color: "#374151" }}>{w}</div>;
                })}
              </div>
            )}
          </Card>
        )}

        {/* FEATURE 2: CONTRADICTION MATRIX */}
        {syn && syn.contradiction_matrix && syn.contradiction_matrix.length > 0 && (
          <Card title="Contradiction Matrix" icon={"\u26A0\uFE0F"} accent="#dc2626" collapsible={true} defaultCollapsed={true} status="Code vs Physics">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#fef2f2" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #fecaca", fontWeight: 700, color: "#991b1b" }}>Framework</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "2px solid #fecaca", fontWeight: 700, color: "#991b1b" }}>Verdict</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #fecaca", fontWeight: 700, color: "#991b1b" }}>Basis</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #fecaca", fontWeight: 700, color: "#991b1b" }}>Limitation</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #fecaca", fontWeight: 700, color: "#991b1b" }}>Gap Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {syn.contradiction_matrix.map(function(row: any, i: number) {
                    var vColor = (row.verdict || "").indexOf("ACCEPT") !== -1 ? "#16a34a" : "#dc2626";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "6px 10px", fontWeight: 600 }}>{row.framework}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: vColor }}>{row.verdict}</td>
                        <td style={{ padding: "6px 10px", color: "#374151" }}>{row.basis}</td>
                        <td style={{ padding: "6px 10px", color: "#6b7280" }}>{row.limitation}</td>
                        <td style={{ padding: "6px 10px", color: "#dc2626", fontWeight: 600 }}>{row.gap_reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* FEATURE 4: PROCEDURE FORENSICS */}
        {syn && syn.procedure_forensics && (
          <Card title="Procedure Forensics" icon={"\uD83D\uDD0D"} accent="#ea580c" collapsible={true} defaultCollapsed={true} status="What Went Wrong">
            {syn.procedure_forensics.likely_causes && syn.procedure_forensics.likely_causes.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#ea580c", textTransform: "uppercase", marginBottom: "6px" }}>Likely Root Causes</div>
                {syn.procedure_forensics.likely_causes.map(function(c: string, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#fff7ed", borderRadius: "4px", borderLeft: "3px solid #ea580c", color: "#374151" }}>{c}</div>;
                })}
              </div>
            )}
            {syn.procedure_forensics.procedural_gaps && syn.procedure_forensics.procedural_gaps.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Procedural Gaps</div>
                {syn.procedure_forensics.procedural_gaps.map(function(g: string, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: "#fef2f2", borderRadius: "4px", color: "#991b1b" }}>{g}</div>;
                })}
              </div>
            )}
            {syn.procedure_forensics.reverse_inference_chain && syn.procedure_forensics.reverse_inference_chain.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Reverse Inference Chain</div>
                {syn.procedure_forensics.reverse_inference_chain.map(function(step: string, i: number) {
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "12px", color: "#ea580c", minWidth: "20px" }}>{i + 1}.</span>
                      <span style={{ fontSize: "12px", color: "#374151" }}>{step}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* REVIEWER BRIEF */}
        {syn && syn.reviewer_brief && (
          <Card title="Reviewer Brief" icon={"\uD83D\uDCCB"} accent="#0891b2" collapsible={true} defaultCollapsed={true} status="For Engineering Review">
            <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#1a1a1a", whiteSpace: "pre-wrap", padding: "8px 12px", backgroundColor: "#ecfeff", borderRadius: "6px", borderLeft: "3px solid #0891b2" }}>{syn.reviewer_brief}</div>
          </Card>
        )}


        {/* EVIDENCE PROVENANCE — v16.0 */}
        {provenanceResult && provenanceResult.provenance_summary && (
          <Card title="Evidence Provenance" icon={"\uD83D\uDD17"} accent="#0d9488" collapsible={true} defaultCollapsed={false} status={provenanceResult.provenance_summary.trust_band + " trust"}>
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: provenanceResult.provenance_summary.trust_band === "HIGH" ? "#f0fdf4" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#fffbeb" : "#fef2f2", border: "1px solid " + (provenanceResult.provenance_summary.trust_band === "HIGH" ? "#bbf7d0" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#fde68a" : "#fecaca") }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: provenanceResult.provenance_summary.trust_band === "HIGH" ? "#16a34a" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#ca8a04" : "#dc2626" }}>
                  Evidence Trust: {provenanceResult.provenance_summary.trust_band}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                  {provenanceResult.provenance_summary.total_evidence_items} items | Dominant: {provenanceResult.provenance_summary.dominant_source} | Measured: {Math.round(provenanceResult.provenance_summary.measured_fraction * 100)}%
                </div>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: provenanceResult.provenance_summary.trust_band === "HIGH" ? "#16a34a" : provenanceResult.provenance_summary.trust_band === "MODERATE" ? "#ca8a04" : "#dc2626" }}>
                {Math.round(provenanceResult.provenance_summary.average_trust_weight * 100)}%
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "12px" }}>
              {[
                { key: "MEASURED", color: "#16a34a", icon: "\uD83D\uDCCF" },
                { key: "OBSERVED", color: "#2563eb", icon: "\uD83D\uDC41\uFE0F" },
                { key: "REPORTED", color: "#ca8a04", icon: "\uD83D\uDCDD" },
                { key: "INFERRED", color: "#9333ea", icon: "\uD83E\uDD14" }
              ].map(function(item, idx) {
                var cnt = (provenanceResult.provenance_summary.counts || {})[item.key] || 0;
                return (
                  <div key={idx} style={{ textAlign: "center", padding: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>{item.icon} {item.key}</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: item.color }}>{cnt}</div>
                  </div>
                );
              })}
            </div>
            {provenanceResult.evidence && provenanceResult.evidence.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Evidence Items</div>
                {provenanceResult.evidence.map(function(ev: any, ei: number) {
                  var provColor = ev.provenance === "MEASURED" ? "#16a34a" : ev.provenance === "OBSERVED" ? "#2563eb" : ev.provenance === "REPORTED" ? "#ca8a04" : ev.provenance === "INFERRED" ? "#9333ea" : "#dc2626";
                  var bgColor = ev.provenance === "MEASURED" ? "#f0fdf4" : ev.provenance === "OBSERVED" ? "#eff6ff" : ev.provenance === "REPORTED" ? "#fffbeb" : ev.provenance === "INFERRED" ? "#faf5ff" : "#fef2f2";
                  return (
                    <div key={ei} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", marginBottom: "3px", backgroundColor: bgColor, borderRadius: "4px", borderLeft: "3px solid " + provColor }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: provColor, backgroundColor: provColor + "18", padding: "2px 6px", borderRadius: "3px", minWidth: "70px", textAlign: "center" }}>{ev.provenance}</span>
                      <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{(ev.claim || "").replace(/_/g, " ")}</span>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>trust: {Math.round((ev.provenance_weight || 0) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {provenanceResult.measurement_reality && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Measurement Reality</div>
                <div style={{ padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", backgroundColor: provenanceResult.measurement_reality.overall_adequacy === "ADEQUATE" ? "#f0fdf4" : provenanceResult.measurement_reality.overall_adequacy === "PARTIAL" ? "#fffbeb" : "#fef2f2", borderLeft: "3px solid " + (provenanceResult.measurement_reality.overall_adequacy === "ADEQUATE" ? "#16a34a" : provenanceResult.measurement_reality.overall_adequacy === "PARTIAL" ? "#ca8a04" : "#dc2626") }}>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: provenanceResult.measurement_reality.overall_adequacy === "ADEQUATE" ? "#16a34a" : provenanceResult.measurement_reality.overall_adequacy === "PARTIAL" ? "#ca8a04" : "#dc2626" }}>
                    Method Adequacy: {provenanceResult.measurement_reality.overall_adequacy}
                  </span>
                </div>
                {provenanceResult.measurement_reality.unanswered_gaps && provenanceResult.measurement_reality.unanswered_gaps.length > 0 && (
                  <div>
                    {provenanceResult.measurement_reality.unanswered_gaps.map(function(gap: any, gi: number) {
                      var gapColor = gap.severity === "critical" ? "#dc2626" : "#ca8a04";
                      var gapBg = gap.severity === "critical" ? "#fef2f2" : "#fffbeb";
                      return (
                        <div key={gi} style={{ fontSize: "12px", padding: "6px 10px", marginBottom: "3px", backgroundColor: gapBg, borderRadius: "4px", borderLeft: "3px solid " + gapColor, color: "#374151" }}>
                          <strong style={{ color: gapColor }}>{gap.severity === "critical" ? "\uD83D\uDED1" : "\u26A0\uFE0F"} {gap.question}</strong>
                          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{gap.message}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {provenanceResult.provenance_summary.recommendation && (
              <div style={{ marginTop: "10px", padding: "8px 12px", backgroundColor: "#fffbeb", borderRadius: "6px", borderLeft: "3px solid #ca8a04", fontSize: "12px", color: "#92400e" }}>
                {"\u26A0\uFE0F"} {provenanceResult.provenance_summary.recommendation}
              </div>
            )}
          </Card>
        )}

        {/* LIVE PHYSICS STATE */}
        {syn && syn.live_physics_state && (
          <Card title="Live Physics State" icon={"\uD83D\uDCCA"} accent="#6d28d9" collapsible={true} defaultCollapsed={true}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ padding: "8px 12px", backgroundColor: "#f5f3ff", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase" }}>FAD Position</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginTop: "4px" }}>{syn.live_physics_state.fad_position || "NOT CALCULATED"}</div>
              </div>
              <div style={{ padding: "8px 12px", backgroundColor: "#f5f3ff", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase" }}>Remaining Life</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginTop: "4px" }}>{syn.live_physics_state.remaining_life || "NOT CALCULATED"}</div>
              </div>
              <div style={{ padding: "8px 12px", backgroundColor: "#f5f3ff", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase" }}>Threshold Proximity</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginTop: "4px" }}>{syn.live_physics_state.threshold_proximity || "NOT CALCULATED"}</div>
              </div>
              <div style={{ padding: "8px 12px", backgroundColor: "#f5f3ff", borderRadius: "6px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase" }}>Gate Status</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginTop: "4px" }}>{typeof syn.live_physics_state.gate_status === "string" ? syn.live_physics_state.gate_status : JSON.stringify(syn.live_physics_state.gate_status)}</div>
              </div>
            </div>
            {syn.live_physics_state.critical_values && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#374151", padding: "6px 10px", backgroundColor: "#f9fafb", borderRadius: "4px" }}>
                <strong>Critical Values:</strong> {typeof syn.live_physics_state.critical_values === "string" ? syn.live_physics_state.critical_values : JSON.stringify(syn.live_physics_state.critical_values)}
              </div>
            )}
          </Card>
        )}

        {/* EVIDENCE TRACE (AUDIT) */}
        {syn && syn.evidence_trace && syn.evidence_trace.length > 0 && (
          <Card title="Evidence Trace" icon={"\uD83D\uDD17"} accent="#4b5563" collapsible={true} defaultCollapsed={true} status={syn.evidence_trace.length + " claims traced"}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "2px solid #d1d5db", fontWeight: 700, color: "#374151" }}>Claim</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "2px solid #d1d5db", fontWeight: 700, color: "#374151" }}>Source Field</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "2px solid #d1d5db", fontWeight: 700, color: "#374151" }}>Confidence</th>
                    <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "2px solid #d1d5db", fontWeight: 700, color: "#374151" }}>Class</th>
                  </tr>
                </thead>
                <tbody>
                  {syn.evidence_trace.map(function(et: any, i: number) {
                    var confColor = et.confidence === "HIGH" ? "#16a34a" : et.confidence === "MEDIUM" ? "#ca8a04" : "#dc2626";
                    var classColor = et.claim_class === "OBSERVED" ? "#16a34a" : et.claim_class === "CALCULATED" ? "#2563eb" : et.claim_class === "INFERRED" ? "#ca8a04" : "#6d28d9";
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "5px 8px", color: "#374151" }}>{et.claim}</td>
                        <td style={{ padding: "5px 8px", color: "#6b7280", fontFamily: "monospace", fontSize: "10px" }}>{et.source_field}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: confColor }}>{et.confidence}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center" }}>
                          <span style={{ fontSize: "9px", fontWeight: 700, color: classColor, backgroundColor: classColor + "15", padding: "2px 6px", borderRadius: "3px" }}>{et.claim_class}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* SUPERBRAIN LOADING / ERROR */}
        {superbrainLoading && (
          <div style={{ padding: "16px", textAlign: "center", color: "#2563eb", fontSize: "14px" }}>
            {"\u23F3"} Synthesizing Five Magic Features...
          </div>
        )}
        {superbrainError && !syn && (
          <div style={{ padding: "12px 16px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", color: "#92400e" }}>{"\u26A0\uFE0F"} Superbrain synthesis unavailable: {superbrainError}</div>
          </div>
        )}

        {/* ================================================================ */}
        {/* DECISION CORE DETAIL (collapsed by default)                      */}
        {/* ================================================================ */}

        {dc && (
          <div style={{ marginTop: "8px", marginBottom: "8px", padding: "6px 16px", backgroundColor: "#6b7280", borderRadius: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>Decision Core Detail</span>
          </div>
        )}

        {phy && (
          <Card title="Physical Reality" icon={"\u269B\uFE0F"} status={"confidence: " + Math.round(phy.physics_confidence * 100) + "%"} defaultCollapsed={true}>
            <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151", marginBottom: "12px", padding: "10px 12px", backgroundColor: "#f0f4ff", borderRadius: "6px", borderLeft: "3px solid #2563eb" }}>{phy.physics_summary}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div style={{ padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Stress State</div>
                <div style={{ fontSize: "12px" }}>Loads: {phy.stress.primary_load_types.join(", ") || "none identified"}</div>
                <div style={{ fontSize: "12px" }}>Cyclic: {phy.stress.cyclic_loading ? "\u2705 " + (phy.stress.cyclic_source || "yes") : "\u274c No"}</div>
                <div style={{ fontSize: "12px" }}>Stress concentration: {phy.stress.stress_concentration_present ? "\u2705 " + phy.stress.stress_concentration_locations.join(", ") : "\u274c No"}</div>
                <div style={{ fontSize: "12px" }}>Load path: {phy.stress.load_path_criticality}</div>
              </div>
              <div style={{ padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "4px" }}>Environment</div>
                <div style={{ fontSize: "12px" }}>Corrosive: {phy.chemical.corrosive_environment ? "\u2705 " + phy.chemical.environment_agents.join(", ") : "\u274c No"}</div>
                <div style={{ fontSize: "12px" }}>Thermal: {phy.thermal.fire_exposure ? "\uD83D\uDD25 Fire exposure" : phy.thermal.creep_range ? "\u2622\uFE0F Creep range" : "Normal"}</div>
                <div style={{ fontSize: "12px" }}>Pressure cycling: {phy.energy.pressure_cycling ? "\u2705 Yes" : "\u274c No"}</div>
                <div style={{ fontSize: "12px" }}>Stored energy: {phy.energy.stored_energy_significant ? "\u26A0\uFE0F Significant" : "Low"}</div>
              </div>
            </div>
            {phy.field_interaction && phy.field_interaction.hotspots.length > 0 && (
              <div style={{ padding: "10px 12px", backgroundColor: phy.field_interaction.interaction_level === "HIGH" ? "#fef2f2" : "#fffbeb", borderRadius: "6px", borderLeft: "3px solid " + (phy.field_interaction.interaction_level === "HIGH" ? "#dc2626" : "#ca8a04") }}>
                <div style={{ fontWeight: 700, fontSize: "12px", color: phy.field_interaction.interaction_level === "HIGH" ? "#dc2626" : "#92400e", marginBottom: "4px" }}>Field Interaction: {phy.field_interaction.interaction_level} ({phy.field_interaction.interaction_score}/100)</div>
                {phy.field_interaction.warnings.map(function(w: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#374151", padding: "2px 0" }}>{w}</div>; })}
              </div>
            )}
          </Card>
        )}

        {dmg && (
          <Card title="Damage Reality" icon={"\uD83E\uDDEA"} status={(dmg.validated_mechanisms?.length || 0) + " validated, " + (dmg.rejected_mechanisms?.length || 0) + " impossible"} defaultCollapsed={true}>
            {dmg.primary_mechanism && (
              <div style={{ padding: "10px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "3px solid #16a34a", marginBottom: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#16a34a" }}>Primary: {dmg.primary_mechanism.name}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>Physics basis: {dmg.primary_mechanism.physics_basis}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>Reality: {dmg.primary_mechanism.reality_state} (score: {dmg.primary_mechanism.reality_score}) | Severity: {dmg.primary_mechanism.severity}</div>
              </div>
            )}
            {dmg.validated_mechanisms && dmg.validated_mechanisms.length > 1 && (
              <div style={{ marginBottom: "12px" }}>
                {dmg.validated_mechanisms.slice(1).map(function(m: any, i: number) {
                  return <div key={i} style={{ fontSize: "12px", padding: "4px 10px", marginBottom: "3px", backgroundColor: "#f9fafb", borderRadius: "4px" }}>{m.name} ({m.reality_state}, score: {m.reality_score}) {"\u2014"} {m.physics_basis}</div>;
                })}
              </div>
            )}
            {dmg.rejected_mechanisms && dmg.rejected_mechanisms.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginBottom: "6px" }}>Physically Impossible ({dmg.rejected_mechanisms.length})</div>
                {dmg.rejected_mechanisms.slice(0, 5).map(function(m: any, i: number) {
                  return <div key={i} style={{ fontSize: "11px", padding: "3px 10px", marginBottom: "2px", backgroundColor: "#fef2f2", borderRadius: "4px", color: "#991b1b", opacity: 0.8 }}>{m.name}: {m.rejection_reason}</div>;
                })}
                {dmg.rejected_mechanisms.length > 5 && <div style={{ fontSize: "11px", color: "#6b7280", padding: "3px 10px" }}>...and {dmg.rejected_mechanisms.length - 5} more rejected</div>}
              </div>
            )}
          </Card>
        )}

        {auth && (
          <Card title="Authority Reality" icon={"\uD83D\uDCDC"} status={auth.primary_authority} defaultCollapsed={true}>
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>Primary: {auth.primary_authority}</div>
            {auth.secondary_authorities && auth.secondary_authorities.length > 0 && <div style={{ fontSize: "12px", color: "#374151", marginBottom: "6px" }}>Secondary: {auth.secondary_authorities.join(", ")}</div>}
            <div style={{ fontSize: "12px", color: "#374151", padding: "8px 12px", backgroundColor: "#f0f4ff", borderRadius: "6px", marginBottom: "8px" }}>{auth.physics_code_alignment}</div>
            {auth.code_gaps && auth.code_gaps.length > 0 && (
              <div style={{ marginTop: "6px" }}>
                {auth.code_gaps.map(function(g: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#dc2626", padding: "2px 0" }}>{"\u274c"} {g}</div>; })}
              </div>
            )}
          </Card>
        )}

        {insp && (
          <Card title="Inspection Reality" icon={"\uD83D\uDD2C"} status={insp.sufficiency_verdict} defaultCollapsed={true}>
            <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "12px", fontWeight: 700, fontSize: "14px", color: "#fff", backgroundColor: insp.sufficiency_verdict === "BLOCKED" ? "#dc2626" : insp.sufficiency_verdict === "INSUFFICIENT" ? "#ea580c" : "#16a34a", textAlign: "center" }}>
              {insp.sufficiency_verdict} {"\u2014"} {insp.proposed_methods.length > 0 ? insp.proposed_methods.join(", ") : "No methods in transcript"}
            </div>
            <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151", marginBottom: "12px" }}>{insp.physics_reason}</div>
            {insp.missing_coverage && insp.missing_coverage.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                {insp.missing_coverage.map(function(m: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#991b1b", padding: "4px 10px", marginBottom: "3px", backgroundColor: "#fef2f2", borderRadius: "4px" }}>{"\u274c"} {m}</div>; })}
              </div>
            )}
            {insp.best_method && (
              <div style={{ padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#16a34a" }}>Best Method: {insp.best_method.method} (score: {insp.best_method.overall_score}/100)</div>
              </div>
            )}
          </Card>
        )}

        {dec && dec.guided_recovery && dec.guided_recovery.length > 0 && (
          <Card title="Guided Recovery" icon={"\uD83D\uDEE0\uFE0F"} status={dec.guided_recovery.length + " actions"} defaultCollapsed={true}>
            {dec.guided_recovery.map(function(r: any, i: number) {
              return (
                <div key={i} style={{ padding: "10px 12px", marginBottom: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", borderLeft: "3px solid #2563eb" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 800, fontSize: "14px", color: "#2563eb" }}>#{r.priority}</span>
                    <span style={{ fontWeight: 700, fontSize: "13px" }}>{r.action}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Physics: {r.physics_reason}</div>
                  <div style={{ fontSize: "11px", color: "#374151" }}>Who: {r.who}</div>
                </div>
              );
            })}
          </Card>
        )}

        {comp && (comp.fatigue.enabled || comp.critical_flaw.enabled || comp.wall_loss.enabled || comp.leak_vs_burst.enabled) && (
          <Card title="Physics Computations" icon={"\uD83D\uDCCA"} status="Paris Law, Critical Flaw, Wall Loss" defaultCollapsed={true}>
            {comp.fatigue.enabled && (
              <div style={{ marginBottom: "10px", padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>Fatigue Crack Growth (Paris Law)</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>{comp.fatigue.narrative}</div>
              </div>
            )}
            {comp.critical_flaw.enabled && (
              <div style={{ marginBottom: "10px", padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>Critical Flaw Threshold</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>{comp.critical_flaw.narrative}</div>
              </div>
            )}
            {comp.wall_loss.enabled && (
              <div style={{ marginBottom: "10px", padding: "8px 12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>Wall Loss Remaining Life</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>{comp.wall_loss.narrative}</div>
              </div>
            )}
            {comp.leak_vs_burst.enabled && (
              <div style={{ padding: "8px 12px", backgroundColor: comp.leak_vs_burst.tendency === "BURST_FAVORED" ? "#fef2f2" : "#f9fafb", borderRadius: "6px" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>Leak vs Burst Tendency</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>{comp.leak_vs_burst.narrative}</div>
              </div>
            )}
          </Card>
        )}

        {/* FALLBACK: AI NARRATIVE (if superbrain failed) */}
        {aiNarrative && !syn && (
          <Card title="AI Narrative Summary (Fallback)" icon={"\uD83E\uDD16"} status="GPT-4o constrained by physics core" defaultCollapsed={true}>
            <div style={{ fontSize: "13px", lineHeight: "1.7", color: "#374151", whiteSpace: "pre-wrap" }}>{aiNarrative}</div>
          </Card>
        )}

        {dec && dec.decision_trace && dec.decision_trace.length > 0 && (
          <Card title="Decision Trace (Audit)" icon={"\uD83D\uDCCB"} defaultCollapsed={true}>
            {dec.decision_trace.map(function(t: string, i: number) {
              var isLock = t.indexOf("HARD LOCK") !== -1;
              var isBlocked = t.indexOf("BLOCKED") !== -1;
              var isPhysics = t.indexOf("PHYSICS") !== -1;
              return <div key={i} style={{ fontSize: "12px", color: isLock ? "#dc2626" : isBlocked ? "#ea580c" : isPhysics ? "#2563eb" : "#374151", fontWeight: (isLock || isBlocked) ? 700 : 400, padding: "3px 0" }}>{i + 1}. {t}</div>;
            })}
          </Card>
        )}

        {/* HARDENING SPRINT 1 + BUILD 1: Authority Lock + Remaining Strength + Reality Challenge + Unknown State + Trusted Facts */}
        <HardeningResultsPanel
          challengeResult={hardeningResult?.challengeResult || null}
          unknownStateResult={hardeningResult?.unknownStateResult || null}
          trustedFacts={hardeningResult?.trustedFacts || []}
          visible={hardeningResult !== null || authorityLockResult !== null || remainingStrengthResult !== null || failureModeDominanceResult !== null || dispositionPathwayResult !== null}
          authorityLockResult={authorityLockResult}
          remainingStrengthResult={remainingStrengthResult}
          failureModeDominanceResult={failureModeDominanceResult}
          dispositionPathwayResult={dispositionPathwayResult}
        />

      </div>
    </div>
  );
}
