// DEPLOY100b — generateReport.ts
// Generates a print-ready HTML inspection report from Decision Core output
// Opens in new browser window for Save as PDF / Print
// NO TEMPLATE LITERALS — STRING CONCATENATION ONLY

export function generateInspectionReport(data: {
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

  // Print button
  html += "<button class='print-btn no-print' onclick='window.print()'>Save as PDF / Print</button>";

  // HEADER
  html += "<div class='header'>";
  html += "<h1>FORGED NDT Intelligence OS</h1>";
  html += "<div style='font-size: 14px; font-weight: 700; margin-bottom: 4px;'>Physics-First Inspection Plan Report</div>";
  html += "<div class='subtitle'>Case: " + esc(caseRef) + " | " + esc(dateStr) + " " + esc(timeStr) + "</div>";
  html += "<div class='subtitle'>Engine: physics-first-decision-core v2.0 | Elapsed: " + (dc.elapsed_ms || "?") + "ms</div>";
  html += "</div>";

  // META GRID
  html += "<div class='meta-grid'>";
  html += "<div class='meta-box'><div class='meta-label'>Asset Classification</div><div class='meta-value'>" + esc(data.asset?.asset_class || "unknown") + " (" + Math.round((data.asset?.confidence || 0) * 100) + "% confidence)</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Consequence Tier</div><div class='meta-value' style='color:" + tierColor + "'>" + esc(con.consequence_tier) + " - " + esc(con.failure_mode).replace(/_/g, " ") + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Disposition</div><div class='meta-value'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Primary Authority</div><div class='meta-value'>" + esc(auth.primary_authority) + "</div></div>";
  html += "</div>";

  // REALITY CONFIDENCE
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

  // CONSEQUENCE REALITY
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

  // PHYSICAL REALITY
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

  // DAMAGE REALITY
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

  // INSPECTION REALITY
  html += "<div class='section'>";
  html += "<div class='section-title'>Inspection Reality</div>";
  var inspColor = insp.sufficiency_verdict === "BLOCKED" ? "#dc2626" : insp.sufficiency_verdict === "INSUFFICIENT" ? "#ea580c" : "#16a34a";
  html += "<div class='banner' style='background:" + inspColor + "'>" + esc(insp.sufficiency_verdict) + " - " + esc((insp.proposed_methods || []).join(", ") || "No methods proposed") + "</div>";
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

  // DECISION REALITY + GATES
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

  // GUIDED RECOVERY
  if (dec.guided_recovery && dec.guided_recovery.length > 0) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Guided Recovery (" + dec.guided_recovery.length + " actions)</div>";
    for (var ri2 = 0; ri2 < dec.guided_recovery.length; ri2++) {
      var r = dec.guided_recovery[ri2];
      html += "<div class='recovery-item'><strong>#" + r.priority + " " + esc(r.action) + "</strong><br/>Physics: " + esc(r.physics_reason) + "<br/>Who: " + esc(r.who) + "</div>";
    }
    html += "</div>";
  }

  // AI NARRATIVE
  if (data.aiNarrative) {
    html += "<div class='section'>";
    html += "<div class='section-title'>AI Narrative Summary (GPT-4o constrained by physics core)</div>";
    html += "<div class='narrative'>" + esc(data.aiNarrative) + "</div>";
    html += "</div>";
  }

  // ORIGINAL TRANSCRIPT
  html += "<div class='section'>";
  html += "<div class='section-title'>Original Input Transcript</div>";
  html += "<div style='padding:10px;background:#f9fafb;border-radius:6px;font-size:11px;white-space:pre-wrap;border:1px solid #e5e7eb;'>" + esc(data.transcript) + "</div>";
  html += "</div>";

  // SIGNATURES
  html += "<div class='sig-line'>";
  html += "<div class='sig-box'><div class='sig-label'>Inspector</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "<div class='sig-box'><div class='sig-label'>Reviewed By</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "</div>";

  // FOOTER
  html += "<div style='margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;'>";
  html += "Generated by FORGED NDT Intelligence OS - " + esc(dateStr) + " " + esc(timeStr) + " - " + esc(caseRef);
  html += "<br/>Engine: physics-first-decision-core v2.0 | Klein Bottle Architecture | " + (dc.klein_bottle_states || 6) + " states";
  html += "</div>";

  html += "</body></html>";

  // Open in new window
  var reportWindow = window.open("", "_blank");
  if (reportWindow) {
    reportWindow.document.write(html);
    reportWindow.document.close();
  } else {
    alert("Pop-up blocked. Please allow pop-ups for this site.");
  }
}
