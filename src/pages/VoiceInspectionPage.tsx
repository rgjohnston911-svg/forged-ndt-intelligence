// DEPLOY111 — VoiceInspectionPage.tsx v14.0
// v14.0: Save to Case Manager button + engine version v2.3
// FIX: voice-incident-plan call now passes decisionResult directly (DEPLOY107 path 1)
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

import React, { useState, useRef, useEffect } from "react";

function generateInspectionReport(data: {
  transcript: string;
  parsed: any;
  asset: any;
  decisionCore: any;
  aiNarrative: string | null;
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

  var now = new Date();
  var dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  var timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  var caseRef = "FORGED-" + now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");

  var tierColor = con.consequence_tier === "CRITICAL" ? "#dc2626" : con.consequence_tier === "HIGH" ? "#ea580c" : con.consequence_tier === "MEDIUM" ? "#ca8a04" : "#16a34a";
  var bandColor = conf.band === "TRUSTED" || conf.band === "HIGH" ? "#16a34a" : conf.band === "GUARDED" ? "#ca8a04" : "#dc2626";

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
  html += "</style></head><body>";

  html += "<button class='print-btn no-print' onclick='window.print()'>Save as PDF / Print</button>";

  html += "<div class='header'>";
  html += "<h1>FORGED NDT Intelligence OS</h1>";
  html += "<div style='font-size: 14px; font-weight: 700; margin-bottom: 4px;'>Physics-First Inspection Plan Report</div>";
  html += "<div class='subtitle'>Case: " + esc(caseRef) + " | " + esc(dateStr) + " " + esc(timeStr) + "</div>";
  html += "<div class='subtitle'>Engine: physics-first-decision-core v2.3 | Elapsed: " + (dc.elapsed_ms || "?") + "ms</div>";
  html += "</div>";

  html += "<div class='meta-grid'>";
  var displayAssetClass = data.asset?.asset_class || "unknown";
  var assetNote = "";
  if (dc.asset_correction && dc.asset_correction.corrected) {
    displayAssetClass = dc.asset_correction.corrected_to;
    assetNote = " (corrected from " + esc(dc.asset_correction.original) + ")";
  }
  html += "<div class='meta-box'><div class='meta-label'>Asset Classification</div><div class='meta-value'>" + esc(displayAssetClass) + assetNote + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Consequence Tier</div><div class='meta-value' style='color:" + tierColor + "'>" + esc(con.consequence_tier) + " - " + esc(con.failure_mode).replace(/_/g, " ") + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Disposition</div><div class='meta-value'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Primary Authority</div><div class='meta-value'>" + esc(auth.primary_authority) + "</div></div>";
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Reality Confidence</div>";
  html += "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>";
  html += "<div><strong style='color:" + bandColor + ";font-size:14px;'>" + esc(conf.band) + "</strong> (" + Math.round(conf.overall * 100) + "%)</div>";
  html += "</div>";
  html += "<div class='confidence-grid'>";
  var confDims = [
    { label: "Physics", value: conf.physics_confidence },
    { label: "Damage", value: conf.damage_confidence },
    { label: "Consequence", value: conf.consequence_confidence },
    { label: "Authority", value: conf.authority_confidence },
    { label: "Inspection", value: conf.inspection_confidence },
  ];
  for (var ci = 0; ci < confDims.length; ci++) {
    var pct = Math.round(confDims[ci].value * 100);
    var cc = pct >= 70 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626";
    html += "<div class='conf-box'><div class='conf-label'>" + confDims[ci].label + "</div><div class='conf-value' style='color:" + cc + "'>" + pct + "%</div></div>";
  }
  html += "</div>";
  if (conf.limiting_factors && conf.limiting_factors.length > 0) {
    html += "<div style='font-size:10px;color:#6b7280;'>Limiting: " + esc(conf.limiting_factors.join(" | ")) + "</div>";
  }
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Consequence Reality</div>";
  html += "<div class='banner' style='background:" + tierColor + "'>" + esc(con.consequence_tier) + " CONSEQUENCE</div>";
  html += "<div class='info-row'><span class='info-label'>Failure Mode</span><span class='info-value'>" + esc(con.failure_mode).replace(/_/g, " ") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Human Impact</span><span class='info-value'>" + esc(con.human_impact) + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Damage State</span><span class='info-value'>" + esc(con.damage_state || "STABLE") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Monitoring Urgency</span><span class='info-value'>" + esc(con.monitoring_urgency || "Routine") + "</span></div>";
  if (con.failure_physics) html += "<div style='margin-top:8px;padding:8px 10px;background:#f0f4ff;border-radius:4px;border-left:3px solid #2563eb;font-size:11px;'><strong>Failure Physics:</strong> " + esc(con.failure_physics) + "</div>";
  if (con.damage_trajectory) html += "<div style='margin-top:6px;font-size:11px;'><strong>Trajectory:</strong> " + esc(con.damage_trajectory) + "</div>";
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Physical Reality (confidence: " + Math.round(phy.physics_confidence * 100) + "%)</div>";
  html += "<div style='padding:8px 10px;background:#f0f4ff;border-radius:4px;border-left:3px solid #2563eb;margin-bottom:8px;font-size:11px;'>" + esc(phy.physics_summary) + "</div>";
  html += "<div class='info-row'><span class='info-label'>Load Types</span><span class='info-value'>" + esc((phy.stress.primary_load_types || []).join(", ") || "none") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Cyclic Loading</span><span class='info-value'>" + (phy.stress.cyclic_loading ? "YES - " + esc(phy.stress.cyclic_source) : "No") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Stress Concentration</span><span class='info-value'>" + (phy.stress.stress_concentration_present ? "YES - " + esc((phy.stress.stress_concentration_locations || []).join(", ")) : "No") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Corrosive Environment</span><span class='info-value'>" + (phy.chemical.corrosive_environment ? "YES - " + esc((phy.chemical.environment_agents || []).join(", ")) : "No") + "</span></div>";
  html += "<div class='info-row'><span class='info-label'>Stored Energy</span><span class='info-value'>" + (phy.energy.stored_energy_significant ? "Significant" : "Low") + "</span></div>";
  if (phy.field_interaction && phy.field_interaction.hotspots.length > 0) {
    html += "<div style='margin-top:8px;padding:8px 10px;background:" + (phy.field_interaction.interaction_level === "HIGH" ? "#fef2f2" : "#fffbeb") + ";border-radius:4px;border-left:3px solid " + (phy.field_interaction.interaction_level === "HIGH" ? "#dc2626" : "#ca8a04") + ";'>";
    html += "<strong>Field Interaction: " + esc(phy.field_interaction.interaction_level) + " (" + phy.field_interaction.interaction_score + "/100)</strong><br/>";
    for (var fi = 0; fi < phy.field_interaction.warnings.length; fi++) html += "<span style='font-size:10px;'>" + esc(phy.field_interaction.warnings[fi]) + "</span><br/>";
    html += "</div>";
  }
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Damage Reality (" + (dmg.validated_mechanisms?.length || 0) + " validated, " + (dmg.rejected_mechanisms?.length || 0) + " impossible)</div>";
  if (dmg.primary_mechanism) {
    html += "<div class='mech-valid'><strong>Primary: " + esc(dmg.primary_mechanism.name) + "</strong> (" + esc(dmg.primary_mechanism.reality_state) + ", score: " + dmg.primary_mechanism.reality_score + ")<br/>Physics: " + esc(dmg.primary_mechanism.physics_basis) + "</div>";
  }
  if (dmg.validated_mechanisms && dmg.validated_mechanisms.length > 1) {
    for (var vi = 1; vi < dmg.validated_mechanisms.length; vi++) {
      var vm = dmg.validated_mechanisms[vi];
      html += "<div class='mech-valid' style='border-left-color:#ca8a04;'>" + esc(vm.name) + " (" + esc(vm.reality_state) + ") - " + esc(vm.physics_basis) + "</div>";
    }
  }
  if (dmg.rejected_mechanisms && dmg.rejected_mechanisms.length > 0) {
    html += "<div style='font-size:10px;font-weight:700;color:#dc2626;margin:8px 0 4px 0;'>PHYSICALLY IMPOSSIBLE (" + dmg.rejected_mechanisms.length + ")</div>";
    for (var ri = 0; ri < Math.min(dmg.rejected_mechanisms.length, 8); ri++) {
      var rm = dmg.rejected_mechanisms[ri];
      html += "<div class='mech-reject'>" + esc(rm.name) + ": " + esc(rm.rejection_reason) + "</div>";
    }
    if (dmg.rejected_mechanisms.length > 8) html += "<div style='font-size:10px;color:#6b7280;'>...and " + (dmg.rejected_mechanisms.length - 8) + " more rejected</div>";
  }
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Inspection Reality</div>";
  var inspColor = insp.sufficiency_verdict === "BLOCKED" ? "#dc2626" : insp.sufficiency_verdict === "INSUFFICIENT" ? "#ea580c" : "#16a34a";
  html += "<div class='banner' style='background:" + inspColor + "'>" + esc(insp.sufficiency_verdict) + " - " + esc((insp.proposed_methods || []).join(", ") || (insp.recommended_package && insp.recommended_package.length > 0 ? "Recommended: " + insp.recommended_package.join(" + ") : "No methods in transcript")) + "</div>";
  html += "<div style='font-size:11px;margin-bottom:8px;'>" + esc(insp.physics_reason) + "</div>";
  if (insp.missing_coverage && insp.missing_coverage.length > 0) {
    for (var mi = 0; mi < insp.missing_coverage.length; mi++) html += "<div class='gap-item'>" + esc(insp.missing_coverage[mi]) + "</div>";
  }
  if (insp.best_method) {
    html += "<div style='margin-top:8px;padding:8px 10px;background:#f0fdf4;border-radius:4px;border-left:3px solid #16a34a;'><strong>Best Method: " + esc(insp.best_method.method) + " (score: " + insp.best_method.overall_score + "/100)</strong></div>";
  }
  if (insp.constraint_analysis && insp.constraint_analysis.truth_quality !== "HIGH") {
    html += "<div style='margin-top:8px;padding:8px 10px;background:#fffbeb;border-radius:4px;border-left:3px solid #ca8a04;font-size:10px;'><strong>Truth Quality: " + esc(insp.constraint_analysis.truth_quality) + "</strong> (" + insp.constraint_analysis.constraint_score + "/100)</div>";
  }
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Decision</div>";
  var decColor = dec.disposition === "no_go" ? "#dc2626" : dec.disposition === "hold_for_review" || dec.disposition === "engineering_review_required" ? "#ca8a04" : "#16a34a";
  html += "<div class='banner' style='background:" + decColor + "'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div>";
  html += "<div style='font-size:11px;margin-bottom:10px;'>" + esc(dec.disposition_basis) + "</div>";
  if (dec.gates && dec.gates.length > 0) {
    html += "<div style='font-size:10px;font-weight:700;color:#6b7280;margin-bottom:4px;'>PRECEDENCE GATES</div>";
    for (var gi = 0; gi < dec.gates.length; gi++) {
      var g = dec.gates[gi];
      var gc = g.result === "PASS" ? "gate-pass" : g.result === "BLOCKED" ? "gate-block" : g.result === "ESCALATED" ? "gate-warn" : "gate-info";
      var gIcon = g.result === "PASS" ? "PASS" : g.result === "BLOCKED" ? "BLOCKED" : g.result === "ESCALATED" ? "ESCALATED" : "INFO";
      html += "<div class='gate-row " + gc + "'><strong>[" + gIcon + "]</strong> <span style='font-weight:600;'>" + esc(g.gate).replace(/_/g, " ") + "</span> <span style='color:#6b7280;margin-left:6px;'>" + esc(g.reason) + "</span></div>";
    }
  }
  html += "</div>";

  if (dec.guided_recovery && dec.guided_recovery.length > 0) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Guided Recovery (" + dec.guided_recovery.length + " actions)</div>";
    for (var ri2 = 0; ri2 < dec.guided_recovery.length; ri2++) {
      var r = dec.guided_recovery[ri2];
      html += "<div class='recovery-item'><strong>#" + r.priority + " " + esc(r.action) + "</strong><br/>Physics: " + esc(r.physics_reason) + "<br/>Who: " + esc(r.who) + "</div>";
    }
    html += "</div>";
  }

  if (data.aiNarrative) {
    html += "<div class='section'>";
    html += "<div class='section-title'>AI Narrative Summary (GPT-4o constrained by physics core)</div>";
    html += "<div class='narrative'>" + esc(data.aiNarrative) + "</div>";
    html += "</div>";
  }

  html += "<div class='section'>";
  html += "<div class='section-title'>Original Input Transcript</div>";
  html += "<div style='padding:10px;background:#f9fafb;border-radius:6px;font-size:11px;white-space:pre-wrap;border:1px solid #e5e7eb;'>" + esc(data.transcript) + "</div>";
  html += "</div>";

  html += "<div class='sig-line'>";
  html += "<div class='sig-box'><div class='sig-label'>Inspector</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "<div class='sig-box'><div class='sig-label'>Reviewed By</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "</div>";

  html += "<div style='margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;'>";
  html += "Generated by FORGED NDT Intelligence OS - " + esc(dateStr) + " " + esc(timeStr) + " - " + esc(caseRef);
  html += "<br/>Engine: physics-first-decision-core v2.3 | Klein Bottle Architecture | " + (dc.klein_bottle_states || 6) + " states";
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
// SAVE TO CASE MANAGER — v14.0
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
    sb_engine_version: (dcResult.engine_version || "v2.3"),
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
function Card({ title, icon, children, status, collapsible, defaultCollapsed }: { title: string; icon: string; children: React.ReactNode; status?: string; collapsible?: boolean; defaultCollapsed?: boolean }) {
  var [collapsed, setCollapsed] = useState(defaultCollapsed || false);
  var canCollapse = collapsible !== false;
  return (
    <div style={{ marginBottom: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
      <div onClick={function() { if (canCollapse) setCollapsed(!collapsed); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#f9fafb", borderBottom: collapsed ? "none" : "1px solid #e5e7eb", cursor: canCollapse ? "pointer" : "default", userSelect: "none" }}>
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
  var [showExpertMode, setShowExpertMode] = useState(false);
  var [architectureResult, setArchitectureResult] = useState<any>(null);
  var [architectureLoading, setArchitectureLoading] = useState(false);
  var [materialsResult, setMaterialsResult] = useState<any>(null);
  var [materialsLoading, setMaterialsLoading] = useState(false);
  var [showLayer3, setShowLayer3] = useState(false);
  var [aiNarrative, setAiNarrative] = useState<string | null>(null);
  var [errors, setErrors] = useState<string[]>([]);
  var [isListening, setIsListening] = useState(false);
  var recognitionRef = useRef<any>(null);
  var [aiQuestions, setAiQuestions] = useState<any[] | null>(null);
  var [aiUnderstood, setAiUnderstood] = useState<string | null>(null);
  var [selectedAnswers, setSelectedAnswers] = useState<any>({});
  var [pipelinePaused, setPipelinePaused] = useState(false);
  var resultsRef = useRef<HTMLDivElement>(null);

  // SAVE TO CASE MANAGER STATE — v14.0
  var [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  var [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  var [saveError, setSaveError] = useState<string | null>(null);

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
    setAiQuestions(null); setAiUnderstood(null); setSelectedAnswers({});
    setSaveStatus("idle"); setSavedCaseId(null); setSaveError(null);
    inputTextRef.current = inputText;

    var initialSteps: StepState[] = [
      { label: "AI Incident Parser (GPT-4o)", status: "pending" },
      { label: "Resolve Asset + Domain Gate", status: "pending" },
      { label: "Physics-First Decision Core (6 states)", status: "pending" },
      { label: "AI Narrative (GPT-4o)", status: "pending" },
    ];
    var s = initialSteps.slice();
    setSteps(s); stepsRef.current = s;
    var errs: string[] = [];
    var parsedResult: any = null;
    var assetResult: any = null;

    try {
      s = updateStep(0, { status: "running" }, s); s = updateStep(1, { status: "running" }, s); setSteps(s.slice());

      var [parseRes, assetRes] = await Promise.allSettled([
        callAPI("parse-incident", { transcript: inputText }),
        callAPI("resolve-asset", { raw_text: inputText }),
      ]);

      if (parseRes.status === "fulfilled") {
        parsedResult = parseRes.value.parsed || parseRes.value;
        setParsed(parsedResult);
        if (parseRes.value.needs_input && parseRes.value.questions) {
          setAiQuestions(parseRes.value.questions);
          setAiUnderstood(parseRes.value.understood || "");
          for (var wi = 2; wi < s.length; wi++) s = updateStep(wi, { status: "waiting", detail: "waiting for answers" }, s);
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

      for (var ei = 2; ei < s.length; ei++) s = updateStep(ei, { status: "waiting", detail: "waiting for evidence confirmation" }, s);
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
      s = updateStep(2, { status: "running", detail: "6 Klein bottle states..." }, s); setSteps(s.slice());
      var coreResult: any = null;
      try {
        var coreRes = await callAPI("decision-core", {
          parsed: parsedResult,
          asset: assetResult,
          confirmed_flags: confirmedFlags,
          transcript: inputText,
          reality_lock: realityLock
        });
        coreResult = coreRes.decision_core || coreRes;
        setDecisionCore(coreResult);
        if (coreResult) {
          var txVal = '';
          try { if (transcript) { txVal = String(transcript); } } catch(ex) {}
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
        s = updateStep(2, { status: "done", detail: tier + " | " + disp + " | " + elapsed + "ms" }, s);
      } catch (e: any) {
        s = updateStep(2, { status: "error", detail: e.message }, s);
        errs.push("decision-core: " + e.message);
      }
      setSteps(s.slice());

      s = updateStep(3, { status: "running" }, s); setSteps(s.slice());
      try {
        var planRes = await callAPI("voice-incident-plan", { transcript: inputText, decisionResult: coreResult });
        var narrative = planRes?.plan || planRes?.text || planRes?.result || JSON.stringify(planRes);
        setAiNarrative(typeof narrative === "string" ? narrative : JSON.stringify(narrative));
        s = updateStep(3, { status: "done", detail: "narrative generated" }, s);
      } catch (e: any) {
        s = updateStep(3, { status: "error", detail: e.message }, s);
        errs.push("narrative: " + e.message);
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

        {dc && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={function() { generateInspectionReport({ transcript: transcript, parsed: parsed, asset: asset, decisionCore: dc, aiNarrative: aiNarrative }); }} style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: "#1e40af", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
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
                var pct = Math.round(dim.value * 100);
                var c = pct >= 70 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626";
                return (
                  <div key={i} style={{ textAlign: "center", padding: "6px", backgroundColor: "#fff", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>{dim.label}</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: c }}>{pct}%</div>
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

        {phy && (
          <Card title="Physical Reality" icon={"\u269B\uFE0F"} status={"confidence: " + Math.round(phy.physics_confidence * 100) + "%"}>
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
          <Card title="Damage Reality" icon={"\uD83E\uDDEA"} status={(dmg.validated_mechanisms?.length || 0) + " validated, " + (dmg.rejected_mechanisms?.length || 0) + " impossible"}>
            {dmg.primary_mechanism && (
              <div style={{ padding: "10px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", borderLeft: "3px solid #16a34a", marginBottom: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#16a34a" }}>Primary: {dmg.primary_mechanism.name}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>Physics basis: {dmg.primary_mechanism.physics_basis}</div>
                <div style={{ fontSize: "12px", color: "#374151" }}>Reality: {dmg.primary_mechanism.reality_state} (score: {dmg.primary_mechanism.reality_score}) | Severity: {dmg.primary_mechanism.severity}</div>
                {dmg.primary_mechanism.evidence_for.length > 0 && <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px" }}>Evidence: {dmg.primary_mechanism.evidence_for.join(", ")}</div>}
                {dmg.primary_mechanism.evidence_against && dmg.primary_mechanism.evidence_against.length > 0 && <div style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px" }}>Uncertainty: {dmg.primary_mechanism.evidence_against.join("; ")}</div>}
              </div>
            )}
            {dmg.validated_mechanisms && dmg.validated_mechanisms.length > 1 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Other Validated Mechanisms</div>
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
            {auth.design_state_warning && <div style={{ fontSize: "12px", color: "#ea580c", fontWeight: 700, padding: "6px 12px", backgroundColor: "#fffbeb", borderRadius: "6px", marginBottom: "6px" }}>{"\u26A0\uFE0F"} {auth.design_state_warning}</div>}
            {auth.code_gaps && auth.code_gaps.length > 0 && (
              <div style={{ marginTop: "6px" }}>
                {auth.code_gaps.map(function(g: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#dc2626", padding: "2px 0" }}>{"\u274c"} {g}</div>; })}
              </div>
            )}
          </Card>
        )}

        {insp && (
          <Card title="Inspection Reality" icon={"\uD83D\uDD2C"} status={insp.sufficiency_verdict + " | " + (insp.proposed_methods.length > 0 ? insp.proposed_methods.join(", ") : insp.recommended_package && insp.recommended_package.length > 0 ? "Recommended: " + insp.recommended_package.join(", ") : "None")}>
            <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "12px", fontWeight: 700, fontSize: "14px", color: "#fff", backgroundColor: insp.sufficiency_verdict === "BLOCKED" ? "#dc2626" : insp.sufficiency_verdict === "INSUFFICIENT" ? "#ea580c" : "#16a34a", textAlign: "center" }}>
              {insp.sufficiency_verdict === "BLOCKED" ? "\uD83D\uDED1 DISPOSITION BLOCKED" : insp.sufficiency_verdict === "INSUFFICIENT" ? "\u26A0\uFE0F INSUFFICIENT" : "\u2705 SUFFICIENT"} {"\u2014"} {insp.proposed_methods.length > 0 ? insp.proposed_methods.join(", ") : "No methods in transcript"}
            </div>
            {insp.recommended_package && insp.recommended_package.length > 0 && insp.proposed_methods.length === 0 && (
              <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "12px", fontWeight: 700, fontSize: "14px", color: "#fff", backgroundColor: "#2563eb", textAlign: "center" }}>
                {"\uD83D\uDCCB"} RECOMMENDED: {insp.recommended_package.join(" + ")}
              </div>
            )}
            <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#374151", marginBottom: "12px" }}>{insp.physics_reason}</div>
            {insp.missing_coverage && insp.missing_coverage.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", marginBottom: "4px" }}>Physics Gaps</div>
                {insp.missing_coverage.map(function(m: string, i: number) { return <div key={i} style={{ fontSize: "12px", color: "#991b1b", padding: "4px 10px", marginBottom: "3px", backgroundColor: "#fef2f2", borderRadius: "4px" }}>{"\u274c"} {m}</div>; })}
              </div>
            )}
            {insp.best_method && (
              <div style={{ padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: "6px", marginBottom: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#16a34a" }}>Best Method: {insp.best_method.method} (score: {insp.best_method.overall_score}/100)</div>
                <div style={{ fontSize: "11px", color: "#374151" }}>{insp.best_method.physics_principle}</div>
                {insp.best_method.blind_spots && insp.best_method.blind_spots.length > 0 && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>Blind spots: {insp.best_method.blind_spots.join("; ")}</div>}
                {insp.best_method.complementary_methods && insp.best_method.complementary_methods.length > 0 && <div style={{ fontSize: "11px", color: "#1e40af", marginTop: "2px" }}>Complementary: {insp.best_method.complementary_methods.join(", ")}</div>}
              </div>
            )}
            {insp.constraint_analysis && insp.constraint_analysis.truth_quality !== "HIGH" && (
              <div style={{ padding: "8px 12px", backgroundColor: insp.constraint_analysis.truth_quality === "UNRELIABLE" ? "#fef2f2" : "#fffbeb", borderRadius: "6px", borderLeft: "3px solid " + (insp.constraint_analysis.truth_quality === "UNRELIABLE" ? "#dc2626" : "#ca8a04") }}>
                <div style={{ fontWeight: 700, fontSize: "12px", color: insp.constraint_analysis.truth_quality === "UNRELIABLE" ? "#dc2626" : "#92400e" }}>Truth Quality: {insp.constraint_analysis.truth_quality} ({insp.constraint_analysis.constraint_score}/100)</div>
                {insp.constraint_analysis.warnings.map(function(w: string, i: number) { return <div key={i} style={{ fontSize: "11px", color: "#374151", padding: "2px 0" }}>{w}</div>; })}
              </div>
            )}
          </Card>
        )}

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

        {dec && dec.guided_recovery && dec.guided_recovery.length > 0 && (
          <Card title="Guided Recovery" icon={"\uD83D\uDEE0\uFE0F"} status={dec.guided_recovery.length + " actions to resolve"}>
            <div style={{ fontSize: "12px", color: "#374151", marginBottom: "10px" }}>These are the specific actions needed to resolve blocked gates and move toward disposition.</div>
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

        {dec && dec.phased_strategy && dec.phased_strategy.length > 0 && (
          <Card title="Phased Inspection Strategy" icon={"\uD83D\uDCCB"} status="4-phase plan" defaultCollapsed={true}>
            {dec.phased_strategy.map(function(phase: any, i: number) {
              return (
                <div key={i} style={{ padding: "10px 12px", marginBottom: "10px", backgroundColor: i === 0 ? "#fef2f2" : "#f9fafb", borderRadius: "6px", borderLeft: "3px solid " + (i === 0 ? "#dc2626" : i === 1 ? "#ea580c" : i === 2 ? "#ca8a04" : "#16a34a") }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>Phase {phase.phase}: {phase.name}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>{phase.objective}</div>
                  {phase.actions.map(function(a: string, ai: number) { return <div key={ai} style={{ fontSize: "12px", color: "#374151", padding: "2px 0", paddingLeft: "8px" }}>{ai + 1}. {a}</div>; })}
                  <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "6px", fontWeight: 600 }}>Gate: {phase.gate} | Time: {phase.time_frame}</div>
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
                {comp.fatigue.delta_k && <div style={{ fontSize: "11px", color: "#6b7280" }}>{"\u0394"}K = {comp.fatigue.delta_k} MPa{"\u221A"}m{comp.fatigue.days_to_critical ? " | Days to critical: " + comp.fatigue.days_to_critical : ""}</div>}
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
                <div style={{ fontSize: "11px", color: "#6b7280" }}>Tendency: {comp.leak_vs_burst.tendency} | Through-wall risk: {comp.leak_vs_burst.through_wall_risk} | Fracture risk: {comp.leak_vs_burst.fracture_risk}</div>
              </div>
            )}
          </Card>
        )}

        {aiNarrative && (
          <Card title="AI Narrative Summary" icon={"\uD83E\uDD16"} status="GPT-4o constrained by physics core" defaultCollapsed={true}>
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

      </div>
    </div>
  );
}
