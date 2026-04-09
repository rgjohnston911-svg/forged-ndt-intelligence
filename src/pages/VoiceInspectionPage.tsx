// DEPLOY176 — src/pages/VoiceInspectionPage.tsx v16.6m
// v16.6m: HARD CONFIDENCE GATE + FORCED REALITY ENFORCEMENT LAYER
//
// DEPLOY176 closes four of the five gaps called out by GPT eval across
// three consecutive scenarios: evidence enforcement, mechanism-specific
// method mapping, disposition authority escalation on structural
// instability, and the "report produced at 36% confidence" problem.
//
// LOCKED CONFIG (per scoping Q&A):
//   1. Hard Confidence Gate: 0.60 threshold, HIGH + CRITICAL tiers only.
//      Decision-core internal gate UNCHANGED at 0.58. Intentional
//      asymmetry: detect early at 0.58, decide carefully at 0.60.
//   2. Report mode: PROVISIONAL - failure narrative, contradiction
//      matrix, and mechanism hypotheses remain VISIBLE when the gate
//      fires. Final disposition and inspector action card are BLOCKED.
//   3. Mechanism coverage: all 17 MECH_DEFS mechanisms, no subset.
//   4. Decision-core.ts untouched. This is a DPR + frontend deploy.
//
// SCOPE (this file):
//   1. callDispositionPathway fetch body extended with three new fields:
//      - reality_confidence_overall (from coreResult.reality_confidence.overall)
//      - structural_path (from fmdResult.structural_path)
//      - validated_mechanisms (from coreResult.damage_reality.validated_mechanisms)
//   2. PDF render: new branch for dpr.disposition === "HOLD_FOR_INPUT_ENFORCEMENT"
//      - PROVISIONAL banner with gate math
//      - Required Evidence Ledger section (per mechanism)
//      - Required Inspection Plan section (per mechanism)
//      - Inspector action card suppressed
//   3. PDF render: new branch for dpr.disposition === "IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW"
//      - Emergency structural header
//      - Operating restrictions block (explicit)
//      - Structural actions with capacity loss state + indicators
//   4. Inspector action card: suppressed for both new dispositions
//   5. Failure narrative + contradiction matrix: wrapped in PROVISIONAL
//      tint when the confidence gate fires (reasoning visible but
//      explicitly marked as unverified working analysis)
//   6. Version bump v16.6l -> v16.6m across header, subtitle, footer,
//      HARDENING DIAGNOSTIC label, h1, inline diagnostic box
//
// BACKEND COORDINATION:
// Requires DEPLOY176 DPR v1.1 deployed first. DPR v1.1 is null-safe
// against v16.6l: if the frontend is still passing v1.0 fields only,
// the new fields default to null/empty and the gate cannot fire, so
// behavior is identical to DPR v1.0. Deploy backend first, confirm no
// regression on Scenario 3, then deploy this frontend.
//
// CARRIES FORWARD FROM v16.6l (DEPLOY170.3):
//   - Pipeline reorder (superbrain runs last with full engine bundle)
//   - Engine bundle passthrough to superbrain v1.2
//   - Paragraph-format numeric extraction (DEPLOY170.1)
//   - RSR-null and FTR-null transparency rendering (DEPLOY170.1)
//   - NPS schedule inference (DEPLOY170)
//   - All prior patches
//
// NO TEMPLATE LITERALS -- STRING CONCATENATION ONLY

import React, { useState, useRef, useEffect } from "react";
import { runHardeningPipeline } from "../utils/hardening-pipeline";
import PhotoAnalysisCard from "../PhotoAnalysisCard";

// ============================================================================
// DEPLOY170: NPS SCHEDULE TABLE (ASME B36.10M)
// ============================================================================
// Module-level constant. Covers NPS 1/2" through 24" for STD/Sch40,
// XS/Sch80, Sch160, and XXS. Values in inches. OD is fixed by NPS;
// wall thickness varies with schedule. For NPS 14 and larger, STD is
// universally 0.375" regardless of diameter (classic B36.10M behavior).
// Source: ASME B36.10M / ASTM A106 / API 5L pipe dimensional tables.
//
// XXS values of 0 mean "not defined for this NPS in B36.10M" -- the
// inference will skip XXS for those sizes and fall through to STD.
var NPS_SCHEDULE_TABLE: any = {
  "0.5":  { od: 0.840,  std: 0.109, xs: 0.147, s160: 0.188, xxs: 0.294 },
  "0.75": { od: 1.050,  std: 0.113, xs: 0.154, s160: 0.219, xxs: 0.308 },
  "1":    { od: 1.315,  std: 0.133, xs: 0.179, s160: 0.250, xxs: 0.358 },
  "1.25": { od: 1.660,  std: 0.140, xs: 0.191, s160: 0.250, xxs: 0.382 },
  "1.5":  { od: 1.900,  std: 0.145, xs: 0.200, s160: 0.281, xxs: 0.400 },
  "2":    { od: 2.375,  std: 0.154, xs: 0.218, s160: 0.344, xxs: 0.436 },
  "2.5":  { od: 2.875,  std: 0.203, xs: 0.276, s160: 0.375, xxs: 0.552 },
  "3":    { od: 3.500,  std: 0.216, xs: 0.300, s160: 0.438, xxs: 0.600 },
  "4":    { od: 4.500,  std: 0.237, xs: 0.337, s160: 0.531, xxs: 0.674 },
  "6":    { od: 6.625,  std: 0.280, xs: 0.432, s160: 0.719, xxs: 0.864 },
  "8":    { od: 8.625,  std: 0.322, xs: 0.500, s160: 0.906, xxs: 0.875 },
  "10":   { od: 10.750, std: 0.365, xs: 0.500, s160: 1.125, xxs: 0 },
  "12":   { od: 12.750, std: 0.375, xs: 0.500, s160: 1.312, xxs: 0 },
  "14":   { od: 14.000, std: 0.375, xs: 0.500, s160: 1.406, xxs: 0 },
  "16":   { od: 16.000, std: 0.375, xs: 0.500, s160: 1.594, xxs: 0 },
  "18":   { od: 18.000, std: 0.375, xs: 0.500, s160: 1.781, xxs: 0 },
  "20":   { od: 20.000, std: 0.375, xs: 0.500, s160: 1.969, xxs: 0 },
  "24":   { od: 24.000, std: 0.375, xs: 0.500, s160: 2.344, xxs: 0 }
};

// ============================================================================
// DEPLOY170: NPS -> nominal wall inference helper
// ============================================================================
// Parses NPS size and schedule from a transcript. Returns an object with
// nominal wall thickness, NPS key, schedule label, and OD -- or null if
// no NPS size can be recognized.
//
// Parser order:
//   1. Mixed-fraction NPS: "1-1/2 inch", "2-1/2 inch" (two captured ints)
//   2. Simple fraction: "1/2 inch", "3/4 inch"
//   3. Integer or decimal: "16 inch", "16-inch", 16", "nps 16", "2.5 inch"
//
// Schedule detection (checked in order of specificity):
//   - "sch 160" / "schedule 160"   -> Sch 160
//   - "xxs" / "double extra strong" -> XXS (only if table has a non-zero value)
//   - "sch 80" / "schedule 80" / "xs" / "extra strong" -> XS / Sch 80
//   - "sch 40" / "schedule 40" / "std" / "standard wall" -> Sch 40 / STD
//   - default: STD (most common in process piping)
//
// Returns null if NPS is absent OR NPS is present but not in the table.
// Never returns zero or negative nominal.
function inferNominalWallFromNPS(transcriptRaw: string): any {
  if (!transcriptRaw) return null;
  var t = String(transcriptRaw).toLowerCase();

  var npsKey: string | null = null;

  // 1. Mixed fraction: "1-1/2 inch", "2 1/2 inch"
  var fracMatch = t.match(/(?:nps\s+)?(\d+)[-\s](\d)\s*\/\s*(\d)(?:\s*(?:inch|in\b|"))?/);
  if (fracMatch) {
    var whole = parseFloat(fracMatch[1]);
    var numer = parseFloat(fracMatch[2]);
    var denom = parseFloat(fracMatch[3]);
    if (denom > 0 && !isNaN(whole) && !isNaN(numer)) {
      var mixedVal = whole + (numer / denom);
      npsKey = String(mixedVal);
    }
  }

  // 2. Simple fraction: "1/2 inch", "3/4 inch"
  if (!npsKey) {
    var simpleFrac = t.match(/(?:nps\s+)?(\d)\s*\/\s*(\d)\s*(?:inch|in\b|")/);
    if (simpleFrac) {
      var sn = parseFloat(simpleFrac[1]);
      var sd = parseFloat(simpleFrac[2]);
      if (sd > 0 && !isNaN(sn)) npsKey = String(sn / sd);
    }
  }

  // 3. Integer or decimal: "16 inch", "16-inch", 16", "nps 16", "2.5 inch"
  if (!npsKey) {
    var intMatch = t.match(/(?:nps\s+)?(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:inch|in\b|")/);
    if (intMatch) {
      var iv = parseFloat(intMatch[1]);
      if (iv > 0 && iv < 100) npsKey = String(iv);
    }
  }

  if (!npsKey) return null;
  var row = NPS_SCHEDULE_TABLE[npsKey];
  if (!row) return null;

  // Schedule detection. Default: STD.
  var schedule = "STD / Sch 40";
  var nominal = row.std;

  if (t.indexOf("sch 160") >= 0 || t.indexOf("schedule 160") >= 0 || t.indexOf("sch.160") >= 0 || t.indexOf("sch-160") >= 0) {
    schedule = "Sch 160";
    nominal = row.s160;
  } else if ((t.indexOf("xxs") >= 0 || t.indexOf("double extra strong") >= 0) && row.xxs > 0) {
    schedule = "XXS";
    nominal = row.xxs;
  } else if (t.indexOf("sch 80") >= 0 || t.indexOf("schedule 80") >= 0 || t.indexOf("sch.80") >= 0 || t.indexOf("sch-80") >= 0 || t.indexOf("extra strong") >= 0 || t.match(/\bxs\b/)) {
    schedule = "XS / Sch 80";
    nominal = row.xs;
  } else if (t.indexOf("sch 40") >= 0 || t.indexOf("schedule 40") >= 0 || t.indexOf("sch.40") >= 0 || t.indexOf("sch-40") >= 0 || t.indexOf("standard wall") >= 0) {
    schedule = "Sch 40 / STD";
    nominal = row.std;
  }

  if (!nominal || nominal <= 0) return null;

  return {
    nominal: nominal,
    nps_size: npsKey,
    schedule: schedule,
    od: row.od,
    source: "inferred_from_nps_schedule (ASME B36.10M, " + schedule + ")"
  };
}

function generateInspectionReport(data: {
  transcript: string;
  parsed: any;
  asset: any;
  decisionCore: any;
  aiNarrative: string | null;
  superbrainResult: any;
  provenanceResult?: any;
  authorityLockResult?: any;
  remainingStrengthResult?: any;
  failureModeDominanceResult?: any;
  dispositionPathwayResult?: any;
  failureTimelineResult?: any;
  photoAnalysisResult?: any;
  errors?: string[];
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

  var alr = data.authorityLockResult || null;
  var rsr = data.remainingStrengthResult || null;
  var fmd = data.failureModeDominanceResult || null;
  var dpr = data.dispositionPathwayResult || null;
  var ftr = data.failureTimelineResult || null;
  var par = data.photoAnalysisResult || null;

  var displayFailureMode = (con && con.failure_mode) || "unknown";
  var failureModeSource = "decision-core";
  if (fmd && fmd.governing_failure_mode && fmd.governing_failure_mode !== "NONE") {
    displayFailureMode = fmd.governing_failure_mode.toLowerCase().replace(/_/g, " ");
    failureModeSource = "FMD v1.3.2";
  }

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
  html += "<div class='subtitle'>v16.6m | Engine: decision-core v2.5.4 + Authority Lock v1.0 + Remaining Strength v1.1 + FMD v1.3.2 + Disposition Pathway v1.1 + Failure Timeline v1.1 + Photo Analysis v1.4 + Superbrain v1.2 + Provenance v1.0 | Elapsed: " + (dc.elapsed_ms || "?") + "ms</div>";
  html += "</div>";

  html += "<div class='meta-grid'>";
  var displayAssetClass = data.asset?.asset_class || "unknown";
  var assetNote = "";
  if (dc.asset_correction && dc.asset_correction.corrected) {
    displayAssetClass = dc.asset_correction.corrected_to;
    assetNote = " (corrected from " + esc(dc.asset_correction.original) + ")";
  }
  html += "<div class='meta-box'><div class='meta-label'>Asset Classification</div><div class='meta-value'>" + esc(displayAssetClass) + assetNote + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Consequence Tier</div><div class='meta-value' style='color:" + tierColorVal + "'>" + esc(con.consequence_tier) + " - " + esc(displayFailureMode) + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Disposition</div><div class='meta-value'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div></div>";
  html += "<div class='meta-box'><div class='meta-label'>Primary Authority</div><div class='meta-value'>" + esc(auth.primary_authority) + "</div></div>";
  html += "</div>";

  // HARDENING DIAGNOSTIC
  html += "<div class='section' style='border:3px solid #000;padding:12px;background:#fffbe6;'>";
  html += "<div style='font-size:14px;font-weight:900;color:#000;margin-bottom:8px;'>HARDENING DIAGNOSTIC (v16.6m)</div>";
  html += "<div style='font-size:10px;color:#000;margin-bottom:10px;font-weight:700;'>Engine state snapshot at PDF generation time.</div>";

  var diagEngines = [
    { name: "AUTHORITY LOCK (alr)", obj: alr },
    { name: "REMAINING STRENGTH (rsr)", obj: rsr },
    { name: "FAILURE MODE DOMINANCE (fmd)", obj: fmd },
    { name: "DISPOSITION PATHWAY (dpr)", obj: dpr },
    { name: "FAILURE TIMELINE (ftr)", obj: ftr },
    { name: "PHOTO ANALYSIS (par)", obj: par }
  ];
  for (var di = 0; di < diagEngines.length; di++) {
    var de = diagEngines[di];
    var present = de.obj !== null && de.obj !== undefined;
    var badgeBg = present ? "#16a34a" : "#dc2626";
    var badgeText = present ? "PRESENT" : "NULL";
    html += "<div style='padding:6px 10px;margin-bottom:4px;background:#fff;border:1px solid #000;border-radius:3px;'>";
    html += "<div style='display:flex;align-items:center;gap:8px;'>";
    html += "<span style='display:inline-block;padding:2px 8px;font-size:10px;font-weight:900;color:#fff;background:" + badgeBg + ";border-radius:3px;'>" + badgeText + "</span>";
    html += "<span style='font-size:11px;font-weight:700;color:#000;'>" + esc(de.name) + "</span>";
    html += "</div>";
    if (present) {
      var keys: string[] = [];
      try { keys = Object.keys(de.obj); } catch(e) { keys = []; }
      html += "<div style='font-size:9px;color:#374151;margin-top:3px;font-family:monospace;word-break:break-all;'>keys: " + esc(keys.join(", ")) + "</div>";
    }
    html += "</div>";
  }

  if (data.errors && data.errors.length > 0) {
    html += "<div style='margin-top:10px;padding:8px;background:#fff;border:2px solid #dc2626;border-radius:3px;'>";
    html += "<div style='font-size:11px;font-weight:900;color:#dc2626;margin-bottom:4px;'>CAUGHT ERRORS (" + data.errors.length + ")</div>";
    for (var dei3 = 0; dei3 < data.errors.length; dei3++) {
      html += "<div style='font-size:10px;color:#991b1b;padding:2px 0;font-family:monospace;word-break:break-all;'>" + esc(data.errors[dei3]) + "</div>";
    }
    html += "</div>";
  } else {
    html += "<div style='margin-top:8px;font-size:10px;color:#16a34a;font-weight:700;'>No caught errors in errors[] array.</div>";
  }
  html += "</div>";

  if (alr) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Authority Lock Chain</div>";
    if (alr.status) {
      var lockColor = alr.status === "LOCKED" ? "#16a34a" : alr.status === "PARTIAL" ? "#ea580c" : "#dc2626";
      html += "<div class='banner' style='background:" + lockColor + "'>" + esc(alr.status) + " AUTHORITY LOCK</div>";
    }
    if (alr.confidence !== undefined && alr.confidence !== null && alr.confidence !== "") {
      // DEPLOY166.2: defensive confidence rendering
      var confLabel = "";
      if (typeof alr.confidence === "number" && !isNaN(alr.confidence)) {
        if (alr.confidence >= 0 && alr.confidence <= 1) {
          confLabel = Math.round(alr.confidence * 100) + "%";
        } else if (alr.confidence > 1 && alr.confidence <= 100) {
          confLabel = Math.round(alr.confidence) + "%";
        } else {
          confLabel = String(alr.confidence);
        }
      } else if (typeof alr.confidence === "string") {
        confLabel = alr.confidence;
      } else {
        var coerced = Number(alr.confidence);
        if (!isNaN(coerced)) {
          confLabel = (coerced >= 0 && coerced <= 1) ? (Math.round(coerced * 100) + "%") : (Math.round(coerced) + "%");
        }
      }
      if (confLabel) {
        html += "<div class='info-row'><span class='info-label'>Confidence</span><span class='info-value'>" + esc(confLabel) + "</span></div>";
      }
    }
    if (alr.authority_chain && alr.authority_chain.length > 0) {
      for (var ali = 0; ali < alr.authority_chain.length; ali++) {
        var ga = alr.authority_chain[ali] || {};
        var gaId = ga.code || ga.standard || ga.name || ga.id || ga.title || "authority";
        var gaLabel = ga.title || ga.description || ga.full_name || "";
        var gaRole = ga.role || ga.purpose || ga.applicability || "";
        html += "<div class='sb-item'><strong>" + esc(gaId) + "</strong>";
        if (gaLabel && gaLabel !== gaId) html += " - " + esc(gaLabel);
        if (gaRole) html += " <span style='color:#6b7280;font-size:10px;'>[" + esc(gaRole) + "]</span>";
        html += "</div>";
      }
    }
    if (alr.supplemental_codes && alr.supplemental_codes.length > 0) {
      html += "<div style='margin-top:6px;font-size:10px;font-weight:700;color:#6b7280;'>SUPPLEMENTAL</div>";
      for (var asi = 0; asi < alr.supplemental_codes.length; asi++) {
        var sa = alr.supplemental_codes[asi] || {};
        var saId = sa.code || sa.standard || sa.name || sa.id || sa.title || "code";
        var saLabel = sa.title || sa.description || sa.full_name || "";
        var saRole = sa.role || sa.purpose || sa.applicability || "";
        html += "<div class='sb-item' style='border-left-color:#ea580c;'><strong>" + esc(saId) + "</strong>";
        if (saLabel && saLabel !== saId) html += " - " + esc(saLabel);
        if (saRole) html += " <span style='color:#6b7280;font-size:10px;'>[" + esc(saRole) + "]</span>";
        html += "</div>";
      }
    }
    var triggerBadges = [];
    if (alr.trigger_b31g) triggerBadges.push("B31G");
    if (alr.trigger_crack_assessment) triggerBadges.push("CRACK ASSESSMENT");
    if (alr.trigger_sour_service) triggerBadges.push("SOUR SERVICE");
    if (triggerBadges.length > 0) {
      html += "<div style='margin-top:8px;padding:6px 10px;background:#eff6ff;border-radius:4px;font-size:10px;'>";
      html += "<strong style='color:#1e40af;'>TRIGGERS:</strong> ";
      for (var tbi = 0; tbi < triggerBadges.length; tbi++) {
        html += "<span style='display:inline-block;padding:1px 6px;margin-right:4px;background:#dbeafe;border-radius:3px;font-weight:700;color:#1e40af;'>" + esc(triggerBadges[tbi]) + "</span>";
      }
      html += "</div>";
    }
    if (alr.lock_reasons && alr.lock_reasons.length > 0) {
      html += "<div style='margin-top:6px;font-size:10px;color:#6b7280;'>";
      html += "<strong>LOCK REASONS:</strong> ";
      for (var lri = 0; lri < alr.lock_reasons.length; lri++) {
        var lr = alr.lock_reasons[lri];
        var lrText = (typeof lr === "string") ? lr : (lr && (lr.reason || lr.description || JSON.stringify(lr)));
        html += "<div style='padding:2px 0;'>- " + esc(lrText) + "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
  }

  if (rsr) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Remaining Strength (B31G)</div>";

    // DEPLOY166 RSR banner guardrail
    var rsrBannerGuardrail = false;
    var rsrGuardrailReason = "";
    if (fmd) {
      if (fmd.cracking_path && fmd.cracking_path.active) {
        rsrBannerGuardrail = true;
        rsrGuardrailReason = "cracking path active";
      } else if (fmd.interaction_flag) {
        rsrBannerGuardrail = true;
        rsrGuardrailReason = "mechanism interaction flag set";
      }
    }
    var envColor;
    if (rsrBannerGuardrail && rsr.safe_envelope === "WITHIN") {
      envColor = "#ca8a04";
    } else {
      envColor = rsr.safe_envelope === "WITHIN" ? "#16a34a" : rsr.safe_envelope === "MARGINAL" ? "#ea580c" : rsr.safe_envelope === "EXCEEDS" ? "#dc2626" : "#6b7280";
    }
    if (rsr.safe_envelope) {
      var bannerText = esc(rsr.safe_envelope) + " SAFE ENVELOPE";
      if (rsrBannerGuardrail && rsr.safe_envelope === "WITHIN") {
        bannerText = "WITHIN PRESSURE ENVELOPE ONLY &mdash; NOT GOVERNING";
      }
      html += "<div class='banner' style='background:" + envColor + "'>" + bannerText + "</div>";
      if (rsrBannerGuardrail) {
        html += "<div style='font-size:10px;color:#92400e;font-style:italic;margin-bottom:8px;text-align:center;'>Pressure envelope cannot disposition this asset: " + esc(rsrGuardrailReason) + ". See FMD and DPR sections.</div>";
      }
    }

    if (rsr.data_quality) html += "<div class='info-row'><span class='info-label'>Data Quality Tier</span><span class='info-value'>" + esc(rsr.data_quality) + "</span></div>";
    if (rsr.governing_maop) html += "<div class='info-row'><span class='info-label'>Governing MAOP</span><span class='info-value'>" + esc(rsr.governing_maop) + " psi (" + esc(rsr.governing_method || "B31G") + ")</span></div>";
    if (rsr.operating_pressure) html += "<div class='info-row'><span class='info-label'>Operating Pressure</span><span class='info-value'>" + esc(rsr.operating_pressure) + " psi</span></div>";
    if (rsr.operating_ratio) html += "<div class='info-row'><span class='info-label'>Operating Ratio</span><span class='info-value'>" + Math.round(rsr.operating_ratio * 100) + "%</span></div>";
    if (rsr.severity_tier && rsr.severity_tier !== "UNKNOWN") html += "<div class='info-row'><span class='info-label'>Severity Tier</span><span class='info-value'>" + esc(rsr.severity_tier) + "</span></div>";
    if (rsr.pressure_reduction_required && rsr.pressure_reduction_required > 0) html += "<div class='gap-item'>Pressure reduction required: " + esc(rsr.pressure_reduction_required) + " psi</div>";
    if (rsr.calculations) {
      var calc = rsr.calculations;
      if (calc.wall_loss_percent !== undefined) html += "<div class='info-row'><span class='info-label'>Wall Loss</span><span class='info-value'>" + Number(calc.wall_loss_percent).toFixed(1) + "%</span></div>";
      if (calc.folias_factor !== undefined) html += "<div class='info-row'><span class='info-label'>Folias Factor (M)</span><span class='info-value'>" + Number(calc.folias_factor).toFixed(3) + "</span></div>";
      if (calc.b31g_folias_factor !== undefined) html += "<div class='info-row'><span class='info-label'>B31G Folias Factor</span><span class='info-value'>" + Number(calc.b31g_folias_factor).toFixed(3) + "</span></div>";
    }
    if (rsr.recommendation && !rsrBannerGuardrail) html += "<div style='margin-top:8px;padding:8px 10px;background:#f9fafb;border-left:3px solid " + envColor + ";border-radius:4px;font-size:11px;'>" + esc(rsr.recommendation) + "</div>";
    if (rsr.derivation_notes && rsr.derivation_notes.length > 0) {
      html += "<div style='margin-top:8px;font-size:10px;color:#6b7280;font-weight:700;'>DERIVATION NOTES</div>";
      for (var dni = 0; dni < rsr.derivation_notes.length; dni++) {
        html += "<div style='font-size:10px;color:#6b7280;padding:2px 0;'>- " + esc(rsr.derivation_notes[dni]) + "</div>";
      }
    }
    html += "</div>";
  }

  // ========================================================================
  // DEPLOY170.1: RSR-NULL TRANSPARENCY RENDERING
  // ========================================================================
  // When RSR returned null (input data genuinely insufficient), render an
  // explicit "NOT RUN" section instead of silently omitting. Universal:
  // fires whenever rsr is null, regardless of asset class or scenario.
  // Graceful degradation is now visible, not silent.
  if (!rsr) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Remaining Strength (B31G)</div>";
    html += "<div class='banner' style='background:#6b7280'>NOT RUN &mdash; INPUT DATA INSUFFICIENT</div>";
    html += "<div style='font-size:11px;color:#374151;padding:10px 12px;background:#f9fafb;border-radius:4px;border-left:3px solid #6b7280;margin-bottom:10px;'>";
    html += "The ASME B31G / Modified B31G metal-loss screen was not executed because the transcript did not contain sufficient thickness measurement data. This is graceful degradation, not an engine failure. Provide the inputs below and re-run to obtain a remaining strength assessment.";
    html += "</div>";
    html += "<div style='font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:4px;'>Required Inputs</div>";
    html += "<div style='font-size:11px;color:#374151;padding:3px 14px;'>&bull; <strong>Nominal wall thickness</strong> &mdash; e.g. \"nominal wall: 0.500 in\", an explicit NPS size (16 inch, sch 40), or a stated schedule</div>";
    html += "<div style='font-size:11px;color:#374151;padding:3px 14px;'>&bull; <strong>Measured minimum wall</strong> OR <strong>wall loss percentage</strong> &mdash; e.g. \"0.262 in minimum\" or \"42% wall loss\"</div>";
    html += "<div style='font-size:11px;color:#374151;padding:3px 14px;'>&bull; <strong>Pipe diameter</strong> &mdash; NPS size or outside diameter in inches</div>";
    html += "<div style='font-size:11px;color:#374151;padding:3px 14px;'>&bull; <strong>Operating pressure</strong> &mdash; recommended, not strictly required for screen</div>";
    html += "<div style='font-size:10px;color:#92400e;font-style:italic;margin-top:10px;padding:8px 10px;background:#fffbe6;border-left:3px solid #ca8a04;border-radius:3px;'>Downstream engines (Failure Mode Dominance, Failure Timeline, Disposition Pathway) may still run on available data and produce a conservative disposition without B31G support.</div>";
    html += "</div>";
  }

  if (fmd) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Failure Mode Dominance</div>";
    var fmdModeColor = fmd.governing_failure_mode === "STRUCTURAL_INSTABILITY" ? "#dc2626"
      : fmd.governing_failure_mode === "CRACKING" ? "#a855f7"
      : fmd.governing_failure_mode === "CORROSION" ? "#ea580c"
      : fmd.governing_failure_mode === "COMPOUND" ? "#dc2626"
      : "#6b7280";
    var fmdLabel = (fmd.governing_failure_mode || "NONE").replace(/_/g, " ");
    html += "<div class='banner' style='background:" + fmdModeColor + "'>GOVERNING: " + esc(fmdLabel) + "</div>";
    if (fmd.governing_severity) html += "<div class='info-row'><span class='info-label'>Severity</span><span class='info-value'>" + esc(fmd.governing_severity) + "</span></div>";
    if (fmd.governing_failure_pressure) html += "<div class='info-row'><span class='info-label'>Failure Pressure</span><span class='info-value'>" + esc(fmd.governing_failure_pressure) + " psi</span></div>";
    if (fmd.governing_code_reference) html += "<div class='info-row'><span class='info-label'>Assessment Code</span><span class='info-value'>" + esc(fmd.governing_code_reference) + "</span></div>";
    if (fmd.governing_basis) html += "<div style='margin-top:8px;padding:8px 10px;background:#f0f4ff;border-radius:4px;border-left:3px solid #2563eb;font-size:11px;'><strong>Basis:</strong> " + esc(fmd.governing_basis) + "</div>";

    var sp = fmd.structural_path;
    if (sp && sp.active) {
      html += "<div style='margin-top:10px;padding:10px 12px;background:#fef2f2;border:2px solid #fecaca;border-radius:6px;'>";
      html += "<div style='font-size:11px;font-weight:700;color:#dc2626;margin-bottom:6px;'>STRUCTURAL INSTABILITY PATH (active)</div>";
      if (sp.capacity_loss_state && sp.capacity_loss_state !== "none") {
        html += "<div class='info-row'><span class='info-label'>Capacity State</span><span class='info-value' style='color:#dc2626;font-weight:700;'>" + esc((sp.capacity_loss_state || "").replace(/_/g, " ")) + "</span></div>";
      }
      if (sp.indicators) {
        var inds = [];
        if (sp.indicators.tilt) inds.push("TILT/LEAN");
        if (sp.indicators.settlement) inds.push("SETTLEMENT");
        if (sp.indicators.buckling) inds.push("BUCKLING");
        if (sp.indicators.deformation) inds.push("DEFORMATION");
        if (inds.length > 0) html += "<div class='info-row'><span class='info-label'>Indicators</span><span class='info-value'>" + esc(inds.join(", ")) + "</span></div>";
      }
      if (sp.assessment_method && sp.assessment_method !== "none") html += "<div class='info-row'><span class='info-label'>Assessment</span><span class='info-value'>" + esc(sp.assessment_method) + "</span></div>";
      if (sp.mechanisms && sp.mechanisms.length > 0) html += "<div class='info-row'><span class='info-label'>Mechanisms</span><span class='info-value'>" + esc(sp.mechanisms.join(", ")) + "</span></div>";
      html += "</div>";
    }

    var cp = fmd.corrosion_path;
    if (cp && cp.active) {
      html += "<div style='margin-top:8px;padding:8px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;'>";
      html += "<div style='font-size:10px;font-weight:700;color:#ea580c;margin-bottom:4px;'>CORROSION PATH (active)</div>";
      if (cp.severity && cp.severity !== "none") html += "<div class='info-row'><span class='info-label'>Severity</span><span class='info-value'>" + esc(cp.severity) + "</span></div>";
      if (cp.failure_pressure) html += "<div class='info-row'><span class='info-label'>Failure Pressure</span><span class='info-value'>" + esc(cp.failure_pressure) + " psi</span></div>";
      if (cp.wall_loss_percent > 0) html += "<div class='info-row'><span class='info-label'>Wall Loss</span><span class='info-value'>" + Number(cp.wall_loss_percent).toFixed(1) + "%</span></div>";
      html += "</div>";
    }

    var ckp = fmd.cracking_path;
    if (ckp && ckp.active) {
      html += "<div style='margin-top:8px;padding:8px 10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;'>";
      html += "<div style='font-size:10px;font-weight:700;color:#a855f7;margin-bottom:4px;'>CRACKING PATH (active)</div>";
      if (ckp.severity && ckp.severity !== "none") html += "<div class='info-row'><span class='info-label'>Severity</span><span class='info-value'>" + esc(ckp.severity) + "</span></div>";
      if (ckp.brittle_fracture_risk) html += "<div class='gap-item'>BRITTLE FRACTURE RISK - sudden failure with no leak-before-break warning</div>";
      html += "</div>";
    }

    if (fmd.interaction_flag) {
      html += "<div style='margin-top:10px;padding:10px 12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;'>";
      html += "<div style='font-size:11px;font-weight:700;color:#dc2626;'>MECHANISM INTERACTION: " + esc(fmd.interaction_type || "PARALLEL") + "</div>";
      html += "<div style='font-size:11px;color:#991b1b;'>" + esc(fmd.interaction_detail || "") + "</div>";
      html += "</div>";
    }
    html += "</div>";
  }

  // DEPLOY176: HOLD_FOR_INPUT_ENFORCEMENT (hard confidence gate fired)
  // PROVISIONAL mode per locked config - reasoning stays visible, final
  // disposition is blocked, inspector action card is suppressed, and the
  // Required Evidence Ledger + Required Inspection Plan are rendered.
  if (dpr && dpr.disposition === "HOLD_FOR_INPUT_ENFORCEMENT") {
    html += "<div class='section'>";
    html += "<div class='section-title'>Disposition Pathway</div>";
    html += "<div class='banner' style='background:#b45309;border:3px solid #78350f;'>PROVISIONAL &mdash; NOT A DISPOSITION</div>";
    html += "<div style='margin-top:6px;padding:8px 10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;font-size:11px;color:#78350f;'>";
    html += "<strong>Hard Confidence Gate is active.</strong> This report presents reasoning and hypotheses, but <strong>no final disposition is issued.</strong> Pass/fail, repair/replace, and continue-service judgments are blocked until the required inputs listed below are collected and the case is re-evaluated.";
    html += "</div>";

    // Gate math box
    var em = dpr.enforcement_metadata || {};
    var confAtGate = (typeof em.confidence_at_gate === "number") ? em.confidence_at_gate.toFixed(2) : "unknown";
    var threshAtGate = (typeof em.threshold === "number") ? em.threshold.toFixed(2) : "0.60";
    var consTierAtGate = em.consequence_tier || "unknown";
    html += "<div style='margin-top:10px;padding:10px 12px;background:#fff;border:2px solid #b45309;border-radius:6px;'>";
    html += "<div style='font-size:10px;font-weight:800;color:#78350f;text-transform:uppercase;margin-bottom:6px;'>Gate Math</div>";
    html += "<div class='info-row'><span class='info-label'>Consequence Tier</span><span class='info-value' style='font-weight:800;color:#b45309;'>" + esc(consTierAtGate) + "</span></div>";
    html += "<div class='info-row'><span class='info-label'>Overall Confidence</span><span class='info-value' style='font-weight:800;color:#b45309;'>" + esc(confAtGate) + "</span></div>";
    html += "<div class='info-row'><span class='info-label'>Enforcement Threshold</span><span class='info-value'>" + esc(threshAtGate) + "</span></div>";
    html += "<div style='font-size:10px;color:#78350f;margin-top:6px;font-style:italic;'>Rule: consequence_tier in (HIGH, CRITICAL) AND reality_confidence_overall &lt; 0.60. Decision-core detects signals at 0.58; enforcement layer decides at 0.60. Detect early, decide carefully.</div>";
    html += "</div>";

    if (dpr.disposition_basis) {
      html += "<div style='margin-top:8px;padding:8px 10px;background:#f9fafb;border-radius:4px;border-left:3px solid #b45309;font-size:11px;'>" + esc(dpr.disposition_basis) + "</div>";
    }

    // Required Evidence Ledger
    var rel = dpr.required_evidence_ledger;
    if (rel && rel.length > 0) {
      html += "<div style='margin-top:14px;padding:10px 12px;background:#fef3c7;border:2px solid #b45309;border-radius:6px;'>";
      html += "<div style='font-size:12px;font-weight:800;color:#78350f;text-transform:uppercase;margin-bottom:8px;'>Required Evidence Ledger</div>";
      html += "<div style='font-size:10px;color:#78350f;margin-bottom:8px;'>Each unresolved mechanism below must be confirmed or ruled out before a disposition can be issued.</div>";
      for (var rli = 0; rli < rel.length; rli++) {
        var relEntry = rel[rli];
        html += "<div style='margin-top:10px;padding:8px 10px;background:#fff;border-left:3px solid #b45309;border-radius:4px;'>";
        html += "<div style='font-size:11px;font-weight:800;color:#111;'>" + esc(relEntry.mechanism_name || relEntry.mechanism_id || "unknown") + "</div>";
        var stateStr = (relEntry.reality_state || "unverified").toUpperCase();
        var scoreStr = (typeof relEntry.reality_score === "number") ? " (score " + relEntry.reality_score.toFixed(2) + ")" : "";
        html += "<div style='font-size:9px;color:#b45309;font-weight:700;margin-bottom:6px;'>Current state: " + esc(stateStr) + esc(scoreStr) + "</div>";
        if (relEntry.confirmation_evidence && relEntry.confirmation_evidence.length > 0) {
          html += "<div style='font-size:10px;font-weight:700;color:#374151;margin-top:4px;'>Confirmation evidence required:</div>";
          for (var cei = 0; cei < relEntry.confirmation_evidence.length; cei++) {
            html += "<div style='font-size:10px;color:#374151;padding:1px 0 1px 12px;'>&bull; " + esc(relEntry.confirmation_evidence[cei]) + "</div>";
          }
        }
        if (relEntry.rule_out_evidence && relEntry.rule_out_evidence.length > 0) {
          html += "<div style='font-size:10px;font-weight:700;color:#374151;margin-top:4px;'>OR rule-out evidence:</div>";
          for (var roi = 0; roi < relEntry.rule_out_evidence.length; roi++) {
            html += "<div style='font-size:10px;color:#374151;padding:1px 0 1px 12px;'>&bull; " + esc(relEntry.rule_out_evidence[roi]) + "</div>";
          }
        }
        if (relEntry.severity_quantifiers && relEntry.severity_quantifiers.length > 0) {
          html += "<div style='font-size:10px;font-weight:700;color:#374151;margin-top:4px;'>Severity quantifiers (if confirmed):</div>";
          for (var sqi = 0; sqi < relEntry.severity_quantifiers.length; sqi++) {
            html += "<div style='font-size:10px;color:#374151;padding:1px 0 1px 12px;'>&bull; " + esc(relEntry.severity_quantifiers[sqi]) + "</div>";
          }
        }
        html += "</div>";
      }
      html += "</div>";
    }

    // Required Inspection Plan
    var rip = dpr.required_inspection_plan;
    if (rip && rip.length > 0) {
      html += "<div style='margin-top:14px;padding:10px 12px;background:#fef3c7;border:2px solid #b45309;border-radius:6px;'>";
      html += "<div style='font-size:12px;font-weight:800;color:#78350f;text-transform:uppercase;margin-bottom:8px;'>Required Inspection Plan (Mechanism-Specific)</div>";
      html += "<div style='font-size:10px;color:#78350f;margin-bottom:8px;'>These methods address the specific physics of each candidate mechanism. This is not a generic \"add VT + UT + PAUT\" recommendation.</div>";
      for (var rpi = 0; rpi < rip.length; rpi++) {
        var rpEntry = rip[rpi];
        html += "<div style='margin-top:10px;padding:8px 10px;background:#fff;border-left:3px solid #b45309;border-radius:4px;'>";
        html += "<div style='font-size:11px;font-weight:800;color:#111;'>" + esc(rpEntry.mechanism_name || rpEntry.mechanism_id || "unknown") + "</div>";
        if (rpEntry.methods && rpEntry.methods.length > 0) {
          for (var mpi = 0; mpi < rpEntry.methods.length; mpi++) {
            var methEntry = rpEntry.methods[mpi];
            html += "<div style='margin-top:5px;padding-left:12px;'>";
            html += "<div style='font-size:10px;font-weight:700;color:#374151;'>&bull; " + esc(methEntry.method || "") + "</div>";
            if (methEntry.physics_basis) {
              html += "<div style='font-size:9px;color:#6b7280;padding-left:12px;font-style:italic;'>" + esc(methEntry.physics_basis) + "</div>";
            }
            html += "</div>";
          }
        }
        html += "</div>";
      }
      html += "</div>";
    }

    if (dpr.temporary_controls && dpr.temporary_controls.length > 0) {
      html += "<div style='margin-top:10px;padding:8px 10px;background:#f9fafb;border-left:3px solid #6b7280;border-radius:4px;'>";
      html += "<div style='font-size:10px;font-weight:700;color:#374151;margin-bottom:4px;'>OPERATIONS UNCHANGED</div>";
      for (var tci = 0; tci < dpr.temporary_controls.length; tci++) {
        html += "<div style='font-size:10px;color:#374151;padding:1px 0;'>&bull; " + esc(dpr.temporary_controls[tci]) + "</div>";
      }
      html += "</div>";
    }

    if (dpr.escalation_triggers && dpr.escalation_triggers.length > 0) {
      html += "<div style='margin-top:8px;padding:8px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;'>";
      html += "<div style='font-size:10px;font-weight:700;color:#991b1b;margin-bottom:4px;'>ESCALATION TRIGGERS</div>";
      for (var eti = 0; eti < dpr.escalation_triggers.length; eti++) {
        html += "<div style='font-size:10px;color:#991b1b;padding:1px 0;'>&bull; " + esc(dpr.escalation_triggers[eti]) + "</div>";
      }
      html += "</div>";
    }

    html += "<div style='margin-top:12px;padding:10px 12px;background:#f9fafb;border:1px dashed #9ca3af;border-radius:4px;font-size:10px;color:#374151;font-style:italic;'>";
    html += "Re-run this assessment after the required evidence is collected to obtain a full disposition. Until then, the failure narrative, contradiction matrix, and mechanism hypotheses on this report are working analysis, not a decision.";
    html += "</div>";

    html += "</div>";
  }

  // DEPLOY176: IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW (structural escalation)
  // Runs when FMD structural_path is active with capacity loss. This is
  // a confirmed physical emergency, not a data gap, so it gets a full
  // action card with explicit operating restrictions.
  else if (dpr && dpr.disposition === "IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW") {
    html += "<div class='section'>";
    html += "<div class='section-title'>Disposition Pathway</div>";
    html += "<div class='banner' style='background:#991b1b;border:3px solid #450a0a;'>IMMEDIATE STRUCTURAL INTEGRITY REVIEW</div>";
    html += "<div style='margin-top:6px;padding:10px 12px;background:#fef2f2;border:2px solid #dc2626;border-radius:6px;font-size:11px;color:#991b1b;'>";
    html += "<strong>EMERGENCY.</strong> Structural instability is active with measurable capacity loss. This is not an evidence-gathering problem &mdash; the supporting structure has already deviated from its designed load path, and the pressure boundary integrity depends on that structure. Operating restrictions below are effective immediately.";
    html += "</div>";

    var semd = dpr.enforcement_metadata || {};
    if (semd.capacity_loss_state) {
      html += "<div style='margin-top:10px;padding:10px 12px;background:#fff;border:2px solid #991b1b;border-radius:6px;'>";
      html += "<div style='font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;margin-bottom:6px;'>Structural State</div>";
      html += "<div class='info-row'><span class='info-label'>Capacity Loss State</span><span class='info-value' style='font-weight:800;color:#991b1b;'>" + esc(String(semd.capacity_loss_state).toUpperCase().replace(/_/g, " ")) + "</span></div>";
      if (semd.structural_indicators && semd.structural_indicators.length > 0) {
        html += "<div class='info-row'><span class='info-label'>Indicators</span><span class='info-value'>" + esc(semd.structural_indicators.join(", ")) + "</span></div>";
      }
      html += "</div>";
    }

    if (dpr.urgency) html += "<div class='info-row'><span class='info-label'>Urgency</span><span class='info-value' style='color:#991b1b;font-weight:800;'>" + esc(dpr.urgency) + "</span></div>";
    if (dpr.disposition_basis) html += "<div style='margin-top:8px;padding:8px 10px;background:#f9fafb;border-radius:4px;border-left:3px solid #991b1b;font-size:11px;'>" + esc(dpr.disposition_basis) + "</div>";

    if (dpr.temporary_controls && dpr.temporary_controls.length > 0) {
      html += "<div style='margin-top:12px;padding:10px 12px;background:#fef2f2;border:2px solid #dc2626;border-radius:6px;'>";
      html += "<div style='font-size:12px;font-weight:800;color:#991b1b;text-transform:uppercase;margin-bottom:6px;'>Operating Restrictions (Effective Immediately)</div>";
      for (var stci = 0; stci < dpr.temporary_controls.length; stci++) {
        html += "<div style='font-size:11px;color:#991b1b;padding:2px 0;font-weight:600;'>&bull; " + esc(dpr.temporary_controls[stci]) + "</div>";
      }
      html += "</div>";
    }

    if (dpr.actions && dpr.actions.length > 0) {
      html += "<div style='margin-top:12px;font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;'>Required Structural Actions (" + dpr.actions.length + ")</div>";
      for (var sdai = 0; sdai < dpr.actions.length; sdai++) {
        var sact = dpr.actions[sdai];
        html += "<div class='recovery-item' style='border-left:3px solid #991b1b;'>";
        html += "<strong>#" + esc(sact.priority || (sdai + 1)) + " " + esc(sact.action || "") + "</strong>";
        if (sact.timeframe) html += " <span style='color:#dc2626;font-size:10px;font-weight:700;'>[" + esc(sact.timeframe) + "]</span>";
        if (sact.detail) html += "<br/><span style='font-size:10px;'>" + esc(sact.detail) + "</span>";
        if (sact.who) html += "<br/><span style='font-size:9px;color:#6b7280;'>Responsible: " + esc(sact.who) + "</span>";
        html += "</div>";
      }
    }

    if (dpr.escalation_triggers && dpr.escalation_triggers.length > 0) {
      html += "<div style='margin-top:10px;padding:8px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;'>";
      html += "<div style='font-size:10px;font-weight:700;color:#991b1b;margin-bottom:4px;'>ESCALATION TRIGGERS</div>";
      for (var seti = 0; seti < dpr.escalation_triggers.length; seti++) {
        html += "<div style='font-size:10px;color:#991b1b;padding:1px 0;'>&bull; " + esc(dpr.escalation_triggers[seti]) + "</div>";
      }
      html += "</div>";
    }

    html += "</div>";
  }

  else if (dpr) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Disposition Pathway</div>";
    var dispColor = dpr.disposition === "IMMEDIATE_ACTION" ? "#dc2626"
      : dpr.disposition === "HOLD_FOR_DATA" ? "#ea580c"
      : dpr.disposition === "ENGINEERING_ASSESSMENT" ? "#a855f7"
      : dpr.disposition === "MONITOR" ? "#2563eb"
      : dpr.disposition === "CONTINUE_SERVICE" ? "#16a34a"
      : "#6b7280";
    html += "<div class='banner' style='background:" + dispColor + "'>" + esc((dpr.disposition || "").replace(/_/g, " ")) + "</div>";
    if (dpr.urgency) html += "<div class='info-row'><span class='info-label'>Urgency</span><span class='info-value' style='color:" + dispColor + ";font-weight:700;'>" + esc(dpr.urgency) + "</span></div>";
    if (dpr.interval) html += "<div class='info-row'><span class='info-label'>Re-Inspection Interval</span><span class='info-value'>" + esc(dpr.interval) + "</span></div>";
    if (dpr.disposition_basis) html += "<div style='margin-top:8px;padding:8px 10px;background:#f9fafb;border-radius:4px;border-left:3px solid " + dispColor + ";font-size:11px;'>" + esc(dpr.disposition_basis) + "</div>";
    if (dpr.actions && dpr.actions.length > 0) {
      html += "<div style='margin-top:10px;font-size:10px;font-weight:700;color:#374151;'>REQUIRED ACTIONS (" + dpr.actions.length + ")</div>";
      for (var dai = 0; dai < dpr.actions.length; dai++) {
        var act = dpr.actions[dai];
        html += "<div class='recovery-item'>";
        html += "<strong>#" + esc(act.priority || (dai + 1)) + " " + esc(act.action || "") + "</strong>";
        if (act.timeframe) html += " <span style='color:#dc2626;font-size:10px;font-weight:700;'>[" + esc(act.timeframe) + "]</span>";
        if (act.detail) html += "<br/><span style='font-size:10px;'>" + esc(act.detail) + "</span>";
        html += "</div>";
      }
    }
    html += "</div>";
  }

  if (ftr) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Failure Timeline</div>";
    var ftrColor = ftr.urgency === "EMERGENCY" || ftr.urgency === "CRITICAL" ? "#dc2626"
      : ftr.urgency === "PRIORITY" ? "#ea580c"
      : ftr.urgency === "ELEVATED" ? "#2563eb"
      : "#16a34a";
    if (ftr.governing_time_years !== null && ftr.governing_time_years !== undefined) {
      var timeLabel = ftr.governing_time_years === 0 ? "EXPIRED"
        : ftr.governing_time_years < 1 ? Number(ftr.governing_time_years * 12).toFixed(1) + " months"
        : Number(ftr.governing_time_years).toFixed(1) + " years";
      html += "<div class='banner' style='background:" + ftrColor + "'>GOVERNING REMAINING LIFE: " + esc(timeLabel) + "</div>";
    }
    if (ftr.governing_failure_mode) html += "<div class='info-row'><span class='info-label'>Governing Mode</span><span class='info-value'>" + esc(ftr.governing_failure_mode) + "</span></div>";
    if (ftr.urgency) html += "<div class='info-row'><span class='info-label'>Urgency</span><span class='info-value' style='color:" + ftrColor + ";font-weight:700;'>" + esc(ftr.urgency) + "</span></div>";
    if (ftr.recommended_inspection_interval_years !== null && ftr.recommended_inspection_interval_years !== undefined) {
      html += "<div class='info-row'><span class='info-label'>Next Inspection (max)</span><span class='info-value'>" + Number(ftr.recommended_inspection_interval_years).toFixed(2) + " years</span></div>";
    }
    if (ftr.governing_basis) html += "<div style='margin-top:8px;padding:8px 10px;background:#f9fafb;border-left:3px solid " + ftrColor + ";border-radius:4px;font-size:11px;'>" + esc(ftr.governing_basis) + "</div>";

    if (ftr.progression_state) {
      var psColor;
      var psLabel = ftr.progression_state.toUpperCase().replace(/_/g, " ");
      switch (ftr.progression_state) {
        case "unstable_critical": psColor = "#dc2626"; break;
        case "accelerating":      psColor = "#ea580c"; break;
        case "active_likely":     psColor = "#ca8a04"; break;
        case "active_possible":   psColor = "#2563eb"; break;
        case "stable_known":      psColor = "#16a34a"; break;
        case "dormant_possible":  psColor = "#6b7280"; break;
        case "insufficient_data": psColor = "#9ca3af"; break;
        default:                  psColor = "#6b7280";
      }
      html += "<div style='margin-top:10px;padding:8px 12px;background:#fff;border:2px solid " + psColor + ";border-radius:6px;'>";
      html += "<div style='font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:3px;'>Progression State</div>";
      html += "<div style='font-size:13px;font-weight:800;color:" + psColor + ";'>" + esc(psLabel) + "</div>";
      if (ftr.progression_state_basis) {
        html += "<div style='font-size:10px;color:#374151;margin-top:3px;font-style:italic;'>" + esc(ftr.progression_state_basis) + "</div>";
      }
      html += "</div>";
    }

    if (ftr.corrosion_timeline && ftr.corrosion_timeline.enabled && ftr.corrosion_timeline.method !== "none") {
      var ct = ftr.corrosion_timeline;
      html += "<div style='margin-top:8px;padding:6px 10px;background:#f9fafb;border-radius:4px;font-size:10px;'>";
      html += "<strong style='color:#374151;'>CORROSION TIMELINE:</strong> ";
      if (ct.corrosion_rate_mpy) html += Number(ct.corrosion_rate_mpy).toFixed(2) + " mpy";
      if (ct.method) html += " <span style='color:#6b7280;'>[" + esc(ct.method) + "]</span>";
      if (ct.confidence && ct.confidence !== "none") html += " <span style='color:#6b7280;'>(" + esc(ct.confidence) + ")</span>";
      if (ct.remaining_life_years !== null && ct.remaining_life_years !== undefined) {
        html += " &mdash; remaining life " + Number(ct.remaining_life_years).toFixed(1) + " yr to " + Number(ct.retirement_wall || 0).toFixed(4) + " in retirement";
      }
      if (ct.notes && ct.notes.length > 0) {
        for (var cni = 0; cni < ct.notes.length; cni++) {
          html += "<div style='font-size:9px;color:#6b7280;padding:1px 0;'>- " + esc(ct.notes[cni]) + "</div>";
        }
      }
      html += "</div>";
    }
    html += "</div>";
  }

  // ========================================================================
  // DEPLOY170.1: FTR-NULL TRANSPARENCY RENDERING
  // ========================================================================
  // Same pattern as RSR-null: when FTR returned null, explain what's
  // missing instead of silent omission. Universal graceful degradation.
  if (!ftr) {
    html += "<div class='section'>";
    html += "<div class='section-title'>Failure Timeline</div>";
    html += "<div class='banner' style='background:#6b7280'>NOT RUN &mdash; INPUT DATA INSUFFICIENT</div>";
    html += "<div style='font-size:11px;color:#374151;padding:10px 12px;background:#f9fafb;border-radius:4px;border-left:3px solid #6b7280;margin-bottom:10px;'>";
    html += "The failure timeline projection was not executed because the transcript did not contain sufficient data to quantify a progression rate for any active mechanism. This is graceful degradation, not an engine failure.";
    html += "</div>";
    html += "<div style='font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:4px;'>Required Inputs (at least one pathway)</div>";
    html += "<div style='font-size:11px;color:#374151;padding:3px 14px;margin-bottom:6px;'><strong>Corrosion pathway:</strong> nominal wall + measured wall (or wall loss %) + service age, OR explicit corrosion rate (e.g. \"8.75 mpy\"), OR thickness history</div>";
    html += "<div style='font-size:11px;color:#374151;padding:3px 14px;'><strong>Cracking pathway:</strong> crack length + depth + critical flaw size, OR stress range (ksi) + cycles per day</div>";
    html += "<div style='font-size:10px;color:#92400e;font-style:italic;margin-top:10px;padding:8px 10px;background:#fffbe6;border-left:3px solid #ca8a04;border-radius:3px;'>Disposition may still be issued conservatively by the Disposition Pathway engine based on severity and mechanism confirmation, but no quantified remaining-life projection will appear.</div>";
    html += "</div>";
  }

  if (par && par.analysis) {
    var pa = par.analysis;
    html += "<div class='section'>";
    html += "<div class='section-title'>Photo Analysis (GPT-4o Vision)</div>";
    if (par.image_quality) html += "<div class='info-row'><span class='info-label'>Image Quality</span><span class='info-value'>" + esc(par.image_quality) + "</span></div>";
    if (pa.asset_identification) html += "<div class='info-row'><span class='info-label'>Asset Identified</span><span class='info-value'>" + esc(pa.asset_identification) + "</span></div>";
    if (pa.material_degradation_severity && pa.material_degradation_severity !== "NONE") html += "<div class='info-row'><span class='info-label'>Material Degradation</span><span class='info-value'>" + esc(pa.material_degradation_severity) + "</span></div>";
    if (par.transcript_addendum) html += "<div style='margin-top:8px;padding:8px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:11px;'>" + esc(par.transcript_addendum) + "</div>";
    html += "</div>";
  }

  if (sb && sb.synthesis) {
    var syn = sb.synthesis;
    // DEPLOY176: detect PROVISIONAL mode (hard confidence gate fired) and
    // structural emergency (both suppress the generic inspector action card)
    var isProvisional = dpr && dpr.disposition === "HOLD_FOR_INPUT_ENFORCEMENT";
    var isStructuralEmergency = dpr && dpr.disposition === "IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW";
    var suppressActionCard = isProvisional || isStructuralEmergency;

    if (syn.failure_narrative) {
      if (isProvisional) {
        html += "<div class='section'>";
        html += "<div class='section-title'>Failure Narrative</div>";
        html += "<div style='margin-bottom:8px;padding:6px 10px;background:#fffbeb;border:2px dashed #b45309;border-radius:4px;font-size:10px;font-weight:700;color:#78350f;text-transform:uppercase;'>PROVISIONAL &mdash; HYPOTHESIS ONLY &mdash; NOT A DISPOSITION</div>";
        html += "<div class='narrative' style='opacity:0.92;'>" + esc(syn.failure_narrative) + "</div>";
        html += "<div style='margin-top:6px;font-size:9px;color:#78350f;font-style:italic;'>This narrative is working analysis, not a conclusion. Treat as hypothesis pending the required evidence listed in the Disposition Pathway section.</div>";
        html += "</div>";
      } else {
        html += "<div class='section'><div class='section-title'>Failure Narrative</div><div class='narrative'>" + esc(syn.failure_narrative) + "</div></div>";
      }
    }
    if (syn.contradiction_matrix && syn.contradiction_matrix.length > 0) {
      if (isProvisional) {
        html += "<div class='section'>";
        html += "<div class='section-title'>Contradiction Matrix</div>";
        html += "<div style='margin-bottom:8px;padding:6px 10px;background:#fffbeb;border:2px dashed #b45309;border-radius:4px;font-size:10px;font-weight:700;color:#78350f;text-transform:uppercase;'>PROVISIONAL &mdash; UNVERIFIED FRAMEWORK COMPARISON</div>";
        html += "<table class='sb-table' style='opacity:0.92;'><tr><th>Framework</th><th>Verdict</th><th>Basis</th><th>Gap</th></tr>";
        for (var ci = 0; ci < syn.contradiction_matrix.length; ci++) {
          var cm = syn.contradiction_matrix[ci];
          html += "<tr><td><strong>" + esc(cm.framework) + "</strong></td><td>" + esc(cm.verdict) + "</td><td>" + esc(cm.basis) + "</td><td>" + esc(cm.gap_reason) + "</td></tr>";
        }
        html += "</table>";
        html += "</div>";
      } else {
        html += "<div class='section'><div class='section-title'>Contradiction Matrix</div>";
        html += "<table class='sb-table'><tr><th>Framework</th><th>Verdict</th><th>Basis</th><th>Gap</th></tr>";
        for (var ci2 = 0; ci2 < syn.contradiction_matrix.length; ci2++) {
          var cm2 = syn.contradiction_matrix[ci2];
          html += "<tr><td><strong>" + esc(cm2.framework) + "</strong></td><td>" + esc(cm2.verdict) + "</td><td>" + esc(cm2.basis) + "</td><td>" + esc(cm2.gap_reason) + "</td></tr>";
        }
        html += "</table></div>";
      }
    }
    // DEPLOY176: Inspector Action Card suppressed when a specialized
    // disposition path is active (HOLD_FOR_INPUT_ENFORCEMENT renders no
    // actions because disposition is blocked; IMMEDIATE_STRUCTURAL_INTEGRITY_REVIEW
    // has its own action block in the Disposition Pathway section).
    if (!suppressActionCard && syn.inspector_action_card && syn.inspector_action_card.length > 0) {
      html += "<div class='section'><div class='section-title'>Inspector Action Card</div>";
      for (var ac = 0; ac < syn.inspector_action_card.length; ac++) {
        var action = syn.inspector_action_card[ac];
        html += "<div class='recovery-item'><strong>#" + (ac + 1) + " " + esc(action.step) + "</strong><br/>" + esc(action.rationale) + "</div>";
      }
      html += "</div>";
    }
    if (syn.reviewer_brief) {
      if (isProvisional) {
        html += "<div class='section'><div class='section-title'>Reviewer Brief</div>";
        html += "<div style='margin-bottom:6px;padding:4px 8px;background:#fffbeb;border:1px dashed #b45309;border-radius:3px;font-size:9px;font-weight:700;color:#78350f;text-transform:uppercase;'>PROVISIONAL SUMMARY</div>";
        html += "<div class='narrative' style='opacity:0.92;'>" + esc(syn.reviewer_brief) + "</div></div>";
      } else {
        html += "<div class='section'><div class='section-title'>Reviewer Brief</div><div class='narrative'>" + esc(syn.reviewer_brief) + "</div></div>";
      }
    }
  }

  html += "<div class='section'>";
  html += "<div class='section-title'>Reality Confidence</div>";
  html += "<div><strong style='color:" + bandColorVal + ";font-size:14px;'>" + esc(conf.band) + "</strong> (" + Math.round(conf.overall * 100) + "%)</div>";
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
  html += "</div></div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Consequence Reality</div>";
  html += "<div class='banner' style='background:" + tierColorVal + "'>" + esc(con.consequence_tier) + " CONSEQUENCE</div>";
  html += "<div class='info-row'><span class='info-label'>Failure Mode</span><span class='info-value'>" + esc(displayFailureMode) + " <span style='color:#6b7280;font-size:9px;'>[" + esc(failureModeSource) + "]</span></span></div>";
  html += "<div class='info-row'><span class='info-label'>Human Impact</span><span class='info-value'>" + esc(con.human_impact) + "</span></div>";
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Decision</div>";
  var decColor = dec.disposition === "no_go" ? "#dc2626" : dec.disposition === "hold_for_review" || dec.disposition === "engineering_review_required" ? "#ca8a04" : "#16a34a";
  html += "<div class='banner' style='background:" + decColor + "'>" + esc(dec.disposition).replace(/_/g, " ").toUpperCase() + "</div>";
  html += "<div style='font-size:11px;margin-bottom:10px;'>" + esc(dec.disposition_basis) + "</div>";
  if (dec.gates && dec.gates.length > 0) {
    for (var gi = 0; gi < dec.gates.length; gi++) {
      var g = dec.gates[gi];
      var gc = g.result === "PASS" ? "gate-pass" : g.result === "BLOCKED" ? "gate-block" : g.result === "ESCALATED" ? "gate-warn" : "gate-info";
      html += "<div class='gate-row " + gc + "'><strong>[" + g.result + "]</strong> " + esc(g.gate).replace(/_/g, " ") + " <span style='color:#6b7280;'>" + esc(g.reason) + "</span></div>";
    }
  }
  html += "</div>";

  html += "<div class='section'>";
  html += "<div class='section-title'>Original Input Transcript</div>";
  html += "<div style='padding:10px;background:#f9fafb;border-radius:6px;font-size:11px;white-space:pre-wrap;border:1px solid #e5e7eb;'>" + esc(data.transcript) + "</div>";
  html += "</div>";

  html += "<div class='sig-line'>";
  html += "<div class='sig-box'><div class='sig-label'>Inspector</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "<div class='sig-box'><div class='sig-label'>Reviewed By</div><div style='height:24px;'></div><div class='sig-label'>Date</div></div>";
  html += "</div>";

  html += "<div style='margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;font-size:9px;color:#9ca3af;'>";
  html += "Generated by FORGED NDT Intelligence OS v16.6m - " + esc(dateStr) + " " + esc(timeStr) + " - " + esc(caseRef);
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

var API_BASE = "/api";
async function callAPI(endpoint: string, body: any): Promise<any> {
  var res = await fetch(API_BASE + "/" + endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) { var text = await res.text(); throw new Error(endpoint + " failed (" + res.status + "): " + text); }
  return res.json();
}

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
    case_id: caseId, case_name: title, title: title, status: "open", inspector_name: "Field Inspector",
    asset_type: displayAsset, asset_name: displayAsset, asset_class: displayAsset, location: "Field",
    description: transcriptText, applicable_standard: (auth.primary_authority || "API 570"),
    consequence_tier: (con.consequence_tier || "MEDIUM"),
    superbrain_disposition: (dec.disposition || "hold_for_review"),
    confidence_band: (conf.band || "LOW"), confidence_overall: (conf.overall || 0),
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
    sb_engine_version: (dcResult.engine_version || "v2.5.4"),
    sb_last_eval: now.toISOString()
  };

  try {
    var res = await fetch(SUPABASE_URL + "/rest/v1/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Prefer": "return=minimal" },
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
        <div style={{ fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>These flags were auto-extracted. Correct any errors before proceeding.</div>
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
  var [aiNarrative, setAiNarrative] = useState<string | null>(null);
  var [errors, setErrors] = useState<string[]>([]);
  var [isListening, setIsListening] = useState(false);
  var recognitionRef = useRef<any>(null);
  var [aiQuestions, setAiQuestions] = useState<any[] | null>(null);
  var [aiUnderstood, setAiUnderstood] = useState<string | null>(null);
  var [selectedAnswers, setSelectedAnswers] = useState<any>({});
  var [pipelinePaused, setPipelinePaused] = useState(false);
  var resultsRef = useRef<HTMLDivElement>(null);
  var [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  var [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  var [saveError, setSaveError] = useState<string | null>(null);
  var [superbrainResult, setSuperbrainResult] = useState<any>(null);
  var [superbrainLoading, setSuperbrainLoading] = useState(false);
  var [superbrainError, setSuperbrainError] = useState<string | null>(null);
  var [grammarBridgeResult, setGrammarBridgeResult] = useState<any>(null);
  var [provenanceResult, setProvenanceResult] = useState<any>(null);
  var [provenanceLoading, setProvenanceLoading] = useState(false);
  var [hardeningResult, setHardeningResult] = useState<any>(null);
  var [hardeningLoading, setHardeningLoading] = useState(false);
  var [gbEditingField, setGbEditingField] = useState<string | null>(null);
  var [gbAmendments, setGbAmendments] = useState<any[]>([]);
  var [gbConfirmed, setGbConfirmed] = useState(false);
  var [authorityLockResult, setAuthorityLockResult] = useState<any>(null);
  var [remainingStrengthResult, setRemainingStrengthResult] = useState<any>(null);
  var [failureModeDominanceResult, setFailureModeDominanceResult] = useState<any>(null);
  var [dispositionPathwayResult, setDispositionPathwayResult] = useState<any>(null);
  var [failureTimelineResult, setFailureTimelineResult] = useState<any>(null);

  var handleSaveToCase = async function() {
    if (!decisionCore) return;
    setSaveStatus("saving"); setSaveError(null);
    var result = await saveCaseToSupabase(transcript, parsed, asset, decisionCore);
    if (result.success) { setSaveStatus("saved"); setSavedCaseId(result.caseId); }
    else { setSaveStatus("error"); setSaveError(result.error || "Unknown error"); }
  };

  var handleGbConfirm = function() { setGbConfirmed(true); setGbEditingField(null); };

  var callAuthorityLock = async function(assetData: any, parsedData: any, gbData: any, confirmedFlags: any) {
    try {
      var mechanisms: string[] = [];
      var wallLossPercent = 0;
      var hasCracking = false;
      var serviceEnv = "";
      if (gbData && gbData.extracted) {
        serviceEnv = gbData.extracted.service_fluid || "";
        if (gbData.extracted.primary_finding) mechanisms.push(gbData.extracted.primary_finding);
        if (gbData.extracted.finding_types) mechanisms = mechanisms.concat(gbData.extracted.finding_types);
        if (gbData.extracted.numeric && gbData.extracted.numeric.wall_loss_percent) wallLossPercent = gbData.extracted.numeric.wall_loss_percent;
      }
      if (parsedData) {
        if (parsedData.environment) {
          for (var ei2 = 0; ei2 < parsedData.environment.length; ei2++) {
            var envItem = (parsedData.environment[ei2] || "").toLowerCase();
            if (envItem.indexOf("sour") >= 0 || envItem.indexOf("h2s") >= 0) serviceEnv = serviceEnv || "sour";
          }
        }
        if (parsedData.numeric_values && parsedData.numeric_values.wall_loss_percent) wallLossPercent = wallLossPercent || parsedData.numeric_values.wall_loss_percent;
      }
      if (confirmedFlags) { if (confirmedFlags.crack_confirmed || confirmedFlags.visible_cracking) hasCracking = true; }
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
      var uniqueMechs: string[] = [];
      for (var mi2 = 0; mi2 < mechanisms.length; mi2++) { if (uniqueMechs.indexOf(mechanisms[mi2]) < 0) uniqueMechs.push(mechanisms[mi2]); }
      var requestBody = {
        asset_type: (assetData && (assetData.asset_class || assetData.asset_type)) || "",
        service_environment: serviceEnv, damage_mechanisms: uniqueMechs,
        wall_loss_percent: wallLossPercent, has_cracking: hasCracking,
        is_pressure_boundary: confirmedFlags ? !!confirmedFlags.pressure_boundary_involved : true, jurisdiction: ""
      };
      var response = await fetch("/.netlify/functions/authority-lock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
      if (!response.ok) {
        var bodyText = await response.text();
        setErrors(function(prev) { return prev.concat(["authority-lock HTTP " + response.status + ": " + bodyText.substring(0, 300)]); });
        return null;
      }
      var result = await response.json();
      setAuthorityLockResult(result);
      return result;
    } catch (err: any) {
      console.error("Authority lock error:", err);
      setErrors(function(prev) { return prev.concat(["authority-lock THREW: " + (err && err.message ? err.message : String(err))]); });
      return null;
    }
  };

  var callRemainingStrength = async function(parsedData: any, gbData: any) {
    try {
      var nominalWall = 0, measuredMinWall = 0, flawLength = 0, pipeOD = 0, diameterInches = 0, wallLossPercent = 0;
      var smys = 0, materialGrade = "", designFactor = 0.72, operatingPressure = 0;
      if (gbData && gbData.extracted && gbData.extracted.numeric) {
        var num = gbData.extracted.numeric;
        if (num.nominal_wall) nominalWall = num.nominal_wall;
        if (num.measured_wall || num.minimum_wall) measuredMinWall = num.measured_wall || num.minimum_wall;
        if (num.flaw_length || num.defect_length) flawLength = num.flaw_length || num.defect_length;
        if (num.diameter_inches) { pipeOD = num.diameter_inches; diameterInches = num.diameter_inches; }
        if (num.pressure_psi) operatingPressure = num.pressure_psi;
        if (num.wall_loss_percent) wallLossPercent = num.wall_loss_percent;
      }
      if (gbData && gbData.extracted) {
        if (gbData.extracted.material) materialGrade = String(gbData.extracted.material);
        if (!materialGrade && gbData.extracted.material_grade) materialGrade = String(gbData.extracted.material_grade);
      }
      if (parsedData && parsedData.numeric_values) {
        var nv = parsedData.numeric_values;
        if (!nominalWall && nv.nominal_wall) nominalWall = nv.nominal_wall;
        if (!measuredMinWall && nv.measured_wall) measuredMinWall = nv.measured_wall;
        if (!flawLength && nv.flaw_length) flawLength = nv.flaw_length;
        if (!pipeOD && nv.pipe_od) { pipeOD = nv.pipe_od; diameterInches = nv.pipe_od; }
        if (!diameterInches && nv.diameter_inches) { diameterInches = nv.diameter_inches; if (!pipeOD) pipeOD = nv.diameter_inches; }
        if (!operatingPressure && nv.operating_pressure) operatingPressure = nv.operating_pressure;
        if (!wallLossPercent && nv.wall_loss_percent) wallLossPercent = nv.wall_loss_percent;
      }
      var lt = ((parsedData && parsedData.raw_text) || "").toLowerCase();
      var gradePatterns = ["x120", "x100", "x90", "x80", "x70", "x65", "x60", "x56", "x52", "x46", "x42"];
      for (var gpi = 0; gpi < gradePatterns.length; gpi++) {
        if (!materialGrade && lt.indexOf(gradePatterns[gpi]) >= 0) { materialGrade = gradePatterns[gpi].toUpperCase(); break; }
      }
      if (!materialGrade) {
        if (lt.indexOf("a106") >= 0 && (lt.indexOf("grade b") >= 0 || lt.indexOf("gr b") >= 0 || lt.indexOf("gr. b") >= 0)) materialGrade = "A106_GR_B";
        else if (lt.indexOf("a106") >= 0 && (lt.indexOf("grade a") >= 0 || lt.indexOf("gr a") >= 0)) materialGrade = "A106_GR_A";
        else if (lt.indexOf("a106") >= 0 && (lt.indexOf("grade c") >= 0 || lt.indexOf("gr c") >= 0)) materialGrade = "A106_GR_C";
        else if (lt.indexOf("a106") >= 0) materialGrade = "A106";
        else if (lt.indexOf("a53") >= 0) materialGrade = "A53";
        else if (lt.indexOf("a333") >= 0) materialGrade = "A333";
        else if (lt.indexOf("a516") >= 0) materialGrade = "A516";
        else if (lt.indexOf("carbon steel") >= 0) materialGrade = "CARBON_STEEL";
      }
      if (!diameterInches) {
        var diaMatch = lt.match(/(\d+(?:\.\d+)?)\s*(?:inch|in\b|")/);
        if (diaMatch) { var d = parseFloat(diaMatch[1]); if (d > 0 && d < 100) { diameterInches = d; if (!pipeOD) pipeOD = d; } }
      }
      if (!wallLossPercent) {
        var wlMatch = lt.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:wall|metal|thickness)?/);
        if (wlMatch) { var w = parseFloat(wlMatch[1]); if (w > 0 && w <= 100) wallLossPercent = w; }
      }
      if (!operatingPressure) {
        var pMatch = lt.match(/(\d+(?:\.\d+)?)\s*psi/);
        if (pMatch) { var pv = parseFloat(pMatch[1]); if (pv > 0 && pv < 20000) operatingPressure = pv; }
      }

      // ======================================================================
      // DEPLOY170.1: PARAGRAPH-FORMAT NUMERIC EXTRACTION (RSR)
      // ======================================================================
      // Universal regex for written-cadence technical documents. Runs BEFORE
      // NPS inference so explicit transcript values always win over table
      // defaults. Bounds 0.05 in < value < 5 in reject nonsense readings.
      // No asset-class branching, no scenario keywords.

      // "nominal wall: 0.500 in" / "nominal wall 0.500 inch" / "nominal 0.5 in"
      if (!nominalWall) {
        var rsrNmMatch = lt.match(/nominal\s+(?:wall\s+)?(?:thickness\s*)?[:=]?\s*([0-9]*\.?[0-9]+)\s*(?:in|inch|")/);
        if (rsrNmMatch) {
          var rsrNmv = parseFloat(rsrNmMatch[1]);
          if (rsrNmv > 0.05 && rsrNmv < 5) nominalWall = rsrNmv;
        }
      }

      // "0.262 in minimum" / "0.262 inch min" / "0.262\" minimum"
      if (!measuredMinWall) {
        var rsrMmMatch = lt.match(/([0-9]*\.?[0-9]+)\s*(?:in|inch|")\s*min(?:imum)?\b/);
        if (rsrMmMatch) {
          var rsrMmv = parseFloat(rsrMmMatch[1]);
          if (rsrMmv > 0.05 && rsrMmv < 5) measuredMinWall = rsrMmv;
        }
      }

      // "minimum wall: 0.262 in" / "minimum thickness 0.262 inch" (alt form)
      if (!measuredMinWall) {
        var rsrMmMatch2 = lt.match(/min(?:imum)?\s+(?:wall|thickness)[:=]?\s*([0-9]*\.?[0-9]+)\s*(?:in|inch|")/);
        if (rsrMmMatch2) {
          var rsrMmv2 = parseFloat(rsrMmMatch2[1]);
          if (rsrMmv2 > 0.05 && rsrMmv2 < 5) measuredMinWall = rsrMmv2;
        }
      }

      // "measured wall 0.262 in" / "measured thickness: 0.262" (alt form)
      if (!measuredMinWall) {
        var rsrMmMatch3 = lt.match(/measured\s+(?:wall|thickness|minimum)[:=]?\s*([0-9]*\.?[0-9]+)\s*(?:in|inch|")/);
        if (rsrMmMatch3) {
          var rsrMmv3 = parseFloat(rsrMmMatch3[1]);
          if (rsrMmv3 > 0.05 && rsrMmv3 < 5) measuredMinWall = rsrMmv3;
        }
      }

      // Back-compute wall_loss_percent when nominal + measured present but
      // percentage was not stated. Completes the inference matrix.
      if (nominalWall && measuredMinWall && !wallLossPercent) {
        wallLossPercent = ((nominalWall - measuredMinWall) / nominalWall) * 100;
        console.log("[DEPLOY170.1 RSR] back-computed wall_loss " + wallLossPercent.toFixed(1) + "% from nominal " + nominalWall + " and measured " + measuredMinWall);
      }
      // ======================================================================

      // ======================================================================
      // DEPLOY170: NPS schedule inference for missing nominal wall.
      // ======================================================================
      // Runs only when explicit nominal is absent. Preserves all explicit
      // field values -- never overrides. Also back-populates pipeOD and
      // diameterInches from the NPS table when those are missing, so B31G
      // has a consistent geometry even from sparse field-voice transcripts.
      // Source transcript: parsedData.raw_text (already the authoritative
      // transcript for downstream engines).
      var rsrNominalInferred = false;
      var rsrInferredSchedule = "";
      if (!nominalWall) {
        var rsrNpsInf = inferNominalWallFromNPS((parsedData && parsedData.raw_text) || "");
        if (rsrNpsInf && rsrNpsInf.nominal > 0) {
          nominalWall = rsrNpsInf.nominal;
          rsrNominalInferred = true;
          rsrInferredSchedule = rsrNpsInf.schedule;
          if (!pipeOD) pipeOD = rsrNpsInf.od;
          if (!diameterInches) {
            var parsedNps = parseFloat(rsrNpsInf.nps_size);
            diameterInches = isNaN(parsedNps) ? rsrNpsInf.od : parsedNps;
          }
          console.log("[DEPLOY170 RSR] inferred nominal " + nominalWall + " in from NPS " + rsrNpsInf.nps_size + " " + rsrInferredSchedule);
        }
      }

      // DEPLOY170: if we now have nominal + wall_loss_percent but no measured
      // wall, back-compute measuredMinWall so B31G has the input it needs.
      // Only fires when measured is absent -- never overrides explicit value.
      if (nominalWall && wallLossPercent && !measuredMinWall) {
        measuredMinWall = nominalWall * (1 - wallLossPercent / 100);
        console.log("[DEPLOY170 RSR] back-computed measured wall " + measuredMinWall.toFixed(4) + " from nominal " + nominalWall + " and wall_loss " + wallLossPercent + "%");
      }
      // ======================================================================

      var haveAnySignal = (nominalWall && measuredMinWall) || (diameterInches && wallLossPercent) || wallLossPercent;
      if (!haveAnySignal) { console.log("Remaining strength: no wall loss or measurement signal -- skipping"); return null; }
      var requestBody: any = { design_factor: designFactor };
      if (nominalWall) requestBody.nominal_wall = nominalWall;
      if (measuredMinWall) requestBody.measured_minimum_wall = measuredMinWall;
      if (flawLength) requestBody.flaw_length = flawLength;
      if (pipeOD) requestBody.pipe_od = pipeOD;
      if (diameterInches) requestBody.diameter_inches = diameterInches;
      if (wallLossPercent) requestBody.wall_loss_percent = wallLossPercent;
      if (smys) requestBody.smys = smys;
      if (materialGrade) { requestBody.material_grade = materialGrade; requestBody.material = materialGrade; }
      if (operatingPressure) { requestBody.operating_pressure = operatingPressure; requestBody.pressure_psi = operatingPressure; }
      // DEPLOY170: provenance flags so the engine (now or later) can surface
      // the assumption in derivation_notes without any backend change required.
      if (rsrNominalInferred) {
        requestBody.nominal_wall_source = "inferred_from_nps_schedule";
        requestBody.nominal_wall_schedule = rsrInferredSchedule;
      } else if (nominalWall) {
        requestBody.nominal_wall_source = "explicit_field";
      }
      var response = await fetch("/.netlify/functions/remaining-strength", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
      if (response.ok) { var result = await response.json(); setRemainingStrengthResult(result); return result; }
      var bodyText = await response.text();
      setErrors(function(prev) { return prev.concat(["remaining-strength HTTP " + response.status + ": " + bodyText.substring(0, 300)]); });
      return null;
    } catch (err: any) {
      console.error("Remaining strength error:", err);
      setErrors(function(prev) { return prev.concat(["remaining-strength THREW: " + (err && err.message ? err.message : String(err))]); });
      return null;
    }
  };

  var callFailureModeDominance = async function(parsedData: any, gbData: any, confirmedFlags: any, authLockRes: any, remStrengthRes: any) {
    try {
      var mechanisms: string[] = [];
      var wallLossPercent = 0, hasCracking = false, serviceEnv = "", opPressure = 0, nomWall = 0, measWall = 0, od = 0, smysVal = 0;
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
      if (parsedData && parsedData.numeric_values) wallLossPercent = wallLossPercent || parsedData.numeric_values.wall_loss_percent || 0;
      if (confirmedFlags) { if (confirmedFlags.crack_confirmed || confirmedFlags.visible_cracking) hasCracking = true; }
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          damage_mechanisms: mechanisms, remaining_strength: remStrengthRes, authority_lock: authLockRes,
          wall_loss_percent: wallLossPercent, has_cracking: hasCracking, service_environment: serviceEnv,
          transcript: (parsedData && parsedData.raw_text) || "", operating_pressure: opPressure,
          nominal_wall: nomWall, measured_minimum_wall: measWall, pipe_od: od, smys: smysVal
        })
      });
      if (!response.ok) {
        var bodyText = await response.text();
        setErrors(function(prev) { return prev.concat(["failure-mode-dominance HTTP " + response.status + ": " + bodyText.substring(0, 300)]); });
        return null;
      }
      var result = await response.json();
      setFailureModeDominanceResult(result);
      return result;
    } catch (err: any) {
      console.error("Failure mode dominance error:", err);
      setErrors(function(prev) { return prev.concat(["failure-mode-dominance THREW: " + (err && err.message ? err.message : String(err))]); });
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
      // DEPLOY176: new fields for hard confidence gate + structural escalation
      var realConfOverall: any = (coreResult && coreResult.reality_confidence && typeof coreResult.reality_confidence.overall === "number") ? coreResult.reality_confidence.overall : null;
      var structPath: any = (fmdResult && fmdResult.structural_path) || null;
      var validatedMechs: any = (coreResult && coreResult.damage_reality && coreResult.damage_reality.validated_mechanisms) || [];
      var response = await fetch("/.netlify/functions/disposition-pathway", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          safe_envelope: safeEnv, governing_failure_mode: govMode, governing_severity: govSev,
          reality_state: realState, disposition_blocked: dispBlocked, interaction_flag: interFlag,
          interaction_type: interType, brittle_fracture_risk: brittleRisk, wall_loss_percent: wallLoss,
          operating_ratio: opRatio, pressure_reduction_required: pressReduc, has_cracking: hasCrack,
          confidence_band: confBand, consequence_tier: conTier,
          // DEPLOY176: enforcement layer inputs
          reality_confidence_overall: realConfOverall,
          structural_path: structPath,
          validated_mechanisms: validatedMechs
        })
      });
      if (!response.ok) {
        var bodyText = await response.text();
        setErrors(function(prev) { return prev.concat(["disposition-pathway HTTP " + response.status + ": " + bodyText.substring(0, 300)]); });
        return null;
      }
      var result = await response.json();
      setDispositionPathwayResult(result);
      return result;
    } catch (err: any) {
      console.error("Disposition pathway error:", err);
      setErrors(function(prev) { return prev.concat(["disposition-pathway THREW: " + (err && err.message ? err.message : String(err))]); });
      return null;
    }
  };

  var callFailureTimeline = async function(parsedData: any, gbData: any, confirmedFlags: any, remStrengthRes: any, fmdResult: any) {
    try {
      var nominalWall = 0, currentWall = 0, retirementWall = 0, corrosionRateMpy = 0;
      var crackLength = 0, crackDepth = 0, criticalCrackSize = 0, stressRange = 0, cyclesPerDay = 0;
      var hasCorrosion = false, hasCracking = false, serviceEnv = "", materialClass = "";
      var wallLossPercent = 0;
      var serviceAgeYears = 0;
      var fmdSeverity = "";

      if (gbData && gbData.extracted) {
        serviceEnv = gbData.extracted.service_fluid || "";
        materialClass = gbData.extracted.material || "";
        if (gbData.extracted.numeric) {
          nominalWall = gbData.extracted.numeric.nominal_wall || 0;
          currentWall = gbData.extracted.numeric.measured_wall || gbData.extracted.numeric.minimum_wall || 0;
          if (gbData.extracted.numeric.wall_loss_percent) {
            wallLossPercent = gbData.extracted.numeric.wall_loss_percent;
            if (nominalWall && !currentWall) {
              currentWall = nominalWall * (1 - wallLossPercent / 100);
            }
          }
          corrosionRateMpy = gbData.extracted.numeric.corrosion_rate_mpy || 0;
          crackLength = gbData.extracted.numeric.crack_length || 0;
          crackDepth = gbData.extracted.numeric.crack_depth || 0;
          if (gbData.extracted.numeric.service_age_years) serviceAgeYears = gbData.extracted.numeric.service_age_years;
        }
      }
      if (remStrengthRes && remStrengthRes.inputs) {
        nominalWall = nominalWall || remStrengthRes.inputs.nominal_wall || 0;
        currentWall = currentWall || remStrengthRes.inputs.measured_minimum_wall || 0;
      }
      if (remStrengthRes && remStrengthRes.calculations && !wallLossPercent) {
        wallLossPercent = remStrengthRes.calculations.wall_loss_percent || 0;
      }
      if (fmdResult) {
        hasCorrosion = (fmdResult.corrosion_path && fmdResult.corrosion_path.active) || false;
        hasCracking = (fmdResult.cracking_path && fmdResult.cracking_path.active) || false;
        fmdSeverity = fmdResult.governing_severity || "";
      }
      var lt = ((parsedData && parsedData.raw_text) || "").toLowerCase();
      if (lt.indexOf("crack") >= 0) hasCracking = true;
      if (lt.indexOf("corrosion") >= 0 || lt.indexOf("wall loss") >= 0 || lt.indexOf("pitting") >= 0) hasCorrosion = true;

      // DEPLOY165: universal service age extraction regex
      if (!serviceAgeYears) {
        var agePatterns = [
          /(?:in\s+operation|operating|in\s+service|service\s+life)\s+(?:for\s+|of\s+)?(\d+(?:\.\d+)?)\s*year/,
          /(\d+(?:\.\d+)?)\s*(?:-\s*)?year[s]?\s*(?:old|of\s+service|in\s+service|in\s+operation)/,
          /(\d+(?:\.\d+)?)\s*year[s]?\s+since\s+(?:install|commission|startup)/,
          /installed\s+(\d+(?:\.\d+)?)\s*year/,
          /commissioned\s+(\d+(?:\.\d+)?)\s*year/
        ];
        for (var api2 = 0; api2 < agePatterns.length; api2++) {
          var am = lt.match(agePatterns[api2]);
          if (am) {
            var ay = parseFloat(am[1]);
            if (ay > 0 && ay < 200) { serviceAgeYears = ay; break; }
          }
        }
      }

      if (!wallLossPercent) {
        var wlMatchFtr = lt.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:wall\s*loss|wall|metal\s*loss|thickness\s*loss)?/);
        if (wlMatchFtr) {
          var wv = parseFloat(wlMatchFtr[1]);
          if (wv > 0 && wv <= 100) wallLossPercent = wv;
        }
      }

      var rateMatch = lt.match(/(\d+(?:\.\d+)?)\s*mpy/);
      if (rateMatch && !corrosionRateMpy) corrosionRateMpy = parseFloat(rateMatch[1]);
      var rateMatch2 = lt.match(/(\d+(?:\.\d+)?)\s*mils?\s*\/?\s*y(ea)?r/);
      if (rateMatch2 && !corrosionRateMpy) corrosionRateMpy = parseFloat(rateMatch2[1]);

      var cyclesMatch = lt.match(/(\d+(?:\.\d+)?)\s*cycles?\s*\/?\s*day/);
      if (cyclesMatch) cyclesPerDay = parseFloat(cyclesMatch[1]);
      var stressMatch = lt.match(/(\d+(?:\.\d+)?)\s*ksi/);
      if (stressMatch) stressRange = parseFloat(stressMatch[1]);

      // ======================================================================
      // DEPLOY170.1: PARAGRAPH-FORMAT NUMERIC EXTRACTION (FTR)
      // ======================================================================
      // Same universal patterns as RSR, except FTR uses currentWall (not
      // measuredMinWall). Runs before NPS inference so explicit values win.
      // Bounds 0.05 in < value < 5 in. No asset-class or scenario branching.

      if (!nominalWall) {
        var ftrNmMatch = lt.match(/nominal\s+(?:wall\s+)?(?:thickness\s*)?[:=]?\s*([0-9]*\.?[0-9]+)\s*(?:in|inch|")/);
        if (ftrNmMatch) {
          var ftrNmv = parseFloat(ftrNmMatch[1]);
          if (ftrNmv > 0.05 && ftrNmv < 5) nominalWall = ftrNmv;
        }
      }

      if (!currentWall) {
        var ftrMmMatch = lt.match(/([0-9]*\.?[0-9]+)\s*(?:in|inch|")\s*min(?:imum)?\b/);
        if (ftrMmMatch) {
          var ftrMmv = parseFloat(ftrMmMatch[1]);
          if (ftrMmv > 0.05 && ftrMmv < 5) currentWall = ftrMmv;
        }
      }

      if (!currentWall) {
        var ftrMmMatch2 = lt.match(/min(?:imum)?\s+(?:wall|thickness)[:=]?\s*([0-9]*\.?[0-9]+)\s*(?:in|inch|")/);
        if (ftrMmMatch2) {
          var ftrMmv2 = parseFloat(ftrMmMatch2[1]);
          if (ftrMmv2 > 0.05 && ftrMmv2 < 5) currentWall = ftrMmv2;
        }
      }

      if (!currentWall) {
        var ftrMmMatch3 = lt.match(/measured\s+(?:wall|thickness|minimum)[:=]?\s*([0-9]*\.?[0-9]+)\s*(?:in|inch|")/);
        if (ftrMmMatch3) {
          var ftrMmv3 = parseFloat(ftrMmMatch3[1]);
          if (ftrMmv3 > 0.05 && ftrMmv3 < 5) currentWall = ftrMmv3;
        }
      }

      // Back-compute wall_loss_percent from nominal + current wall when missing
      if (nominalWall && currentWall && !wallLossPercent) {
        wallLossPercent = ((nominalWall - currentWall) / nominalWall) * 100;
        console.log("[DEPLOY170.1 FTR] back-computed wall_loss " + wallLossPercent.toFixed(1) + "% from nominal " + nominalWall + " and current " + currentWall);
      }
      // ======================================================================

      // ======================================================================
      // DEPLOY170: NPS schedule inference for missing nominal wall (FTR).
      // ======================================================================
      // Same logic as RSR -- only fires when explicit nominal absent.
      // Idempotent with RSR: even if RSR already inferred and echoed back via
      // remStrengthRes.inputs, this path handles the case where RSR didn't run
      // (e.g. RSR failed, or haveAnySignal was false in RSR), keeping FTR
      // independently resilient. Also back-computes currentWall from wall
      // loss % when possible, so the timeline engine has a concrete wall
      // reading to project forward from.
      if (!nominalWall) {
        var ftrNpsInf = inferNominalWallFromNPS((parsedData && parsedData.raw_text) || "");
        if (ftrNpsInf && ftrNpsInf.nominal > 0) {
          nominalWall = ftrNpsInf.nominal;
          console.log("[DEPLOY170 FTR] inferred nominal " + nominalWall + " in from NPS " + ftrNpsInf.nps_size + " " + ftrNpsInf.schedule);
          if (wallLossPercent && !currentWall) {
            currentWall = nominalWall * (1 - wallLossPercent / 100);
            console.log("[DEPLOY170 FTR] back-computed current wall " + currentWall.toFixed(4) + " from nominal and wall_loss " + wallLossPercent + "%");
          }
        }
      }
      // ======================================================================

      if (!hasCorrosion && !hasCracking && !wallLossPercent) {
        console.log("Failure timeline: no corrosion or cracking signal -- skipping");
        return null;
      }
      var requestBody = {
        nominal_wall: nominalWall,
        current_wall: currentWall,
        measured_minimum_wall: currentWall,
        retirement_wall: retirementWall,
        corrosion_rate_mpy: corrosionRateMpy,
        thickness_history: [],
        crack_length: crackLength,
        crack_depth: crackDepth,
        critical_crack_size: criticalCrackSize,
        stress_range_ksi: stressRange,
        cycles_per_day: cyclesPerDay,
        has_corrosion: hasCorrosion,
        has_cracking: hasCracking,
        service_environment: serviceEnv,
        material_class: materialClass,
        wall_loss_percent: wallLossPercent,
        service_age_years: serviceAgeYears,
        fmd_severity: fmdSeverity
      };
      var response = await fetch("/.netlify/functions/failure-timeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
      if (response.ok) { var result = await response.json(); setFailureTimelineResult(result); return result; }
      var bodyText = await response.text();
      setErrors(function(prev) { return prev.concat(["failure-timeline HTTP " + response.status + ": " + bodyText.substring(0, 300)]); });
      return null;
    } catch (err: any) {
      console.error("Failure timeline error:", err);
      setErrors(function(prev) { return prev.concat(["failure-timeline THREW: " + (err && err.message ? err.message : String(err))]); });
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
    setAuthorityLockResult(null); setRemainingStrengthResult(null);
    setFailureModeDominanceResult(null); setDispositionPathwayResult(null);
    setFailureTimelineResult(null);
    inputTextRef.current = inputText;
    var initialSteps: StepState[] = [
      { label: "AI Incident Parser", status: "pending" },
      { label: "Resolve Asset", status: "pending" },
      { label: "Evidence Provenance", status: "pending" },
      { label: "Authority Lock + Remaining Strength", status: "pending" },
      { label: "Physics-First Decision Core", status: "pending" },
      { label: "Reality Hardening", status: "pending" },
      { label: "Failure Mode Dominance + Disposition Pathway", status: "pending" },
      { label: "Failure Timeline", status: "pending" },
      { label: "Superbrain Synthesis", status: "pending" },
    ];
    var s = initialSteps.slice();
    setSteps(s); stepsRef.current = s;
    var errs: string[] = [];
    var parsedResult: any = null;
    var assetResult: any = null;
    try {
      s = updateStep(0, { status: "running" }, s); s = updateStep(1, { status: "running" }, s); setSteps(s.slice());
      var gbPromise = callAPI("voice-grammar-bridge", { action: "extract", transcript: inputText }).catch(function() { return null; });
      var [parseRes, assetRes] = await Promise.allSettled([
        callAPI("parse-incident", { transcript: inputText }),
        callAPI("resolve-asset", { raw_text: inputText }),
      ]);
      try {
        var gbValue = await gbPromise;
        if (gbValue && gbValue.ok) setGrammarBridgeResult(gbValue.result || gbValue);
      } catch (gbErr) {}
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
    var hardenRes: any = null;
    var fmdResult: any = null;
    var dpResult: any = null;
    var ftResult: any = null;
    var localAuthResult: any = null;
    var localStrengthResult: any = null;
    try {
      s = updateStep(2, { status: "running", detail: "classifying evidence trust..." }, s); setSteps(s.slice());
      var provenanceData: any = null;
      try {
        setProvenanceLoading(true);
        var provRes = await callAPI("evidence-provenance", {
          transcript: inputText,
          numeric_values: parsedResult ? parsedResult.numeric_values || {} : {},
          methods: [], findings: []
        });
        if (provRes && provRes.ok) {
          provenanceData = provRes;
          setProvenanceResult(provRes);
          var trustLabel = (provRes.provenance_summary ? provRes.provenance_summary.trust_band : "?");
          var evidenceCount = (provRes.evidence ? provRes.evidence.length : 0);
          s = updateStep(2, { status: "done", detail: trustLabel + " trust | " + evidenceCount + " items" }, s);
        } else { s = updateStep(2, { status: "done", detail: "no provenance data" }, s); }
      } catch (provErr: any) {
        s = updateStep(2, { status: "error", detail: provErr.message }, s);
        errs.push("evidence-provenance: " + provErr.message);
      }
      setProvenanceLoading(false);
      setSteps(s.slice());

      s = updateStep(3, { status: "running", detail: "resolving governing authority..." }, s); setSteps(s.slice());
      var authDetail = "";
      try {
        localAuthResult = await callAuthorityLock(assetResult, parsedResult, grammarBridgeResult, confirmedFlags);
        if (localAuthResult && localAuthResult.status === "LOCKED") {
          var codeCount = (localAuthResult.authority_chain || []).length;
          var suppCount = (localAuthResult.supplemental_codes || []).length;
          authDetail = "LOCKED | " + codeCount + " primary";
          if (suppCount > 0) authDetail = authDetail + " + " + suppCount + " supp";
          if (localAuthResult.trigger_b31g) authDetail = authDetail + " | B31G triggered";
        } else if (localAuthResult) {
          authDetail = localAuthResult.status + " | " + (localAuthResult.lock_reasons || []).length + " reasons";
        } else { authDetail = "no authority data"; }
        s = updateStep(3, { status: "done", detail: authDetail }, s);
        setSteps(s.slice());
      } catch (authErr: any) {
        s = updateStep(3, { status: "error", detail: authErr.message }, s);
        errs.push("authority-lock: " + authErr.message);
        setSteps(s.slice());
      }

      try {
        localStrengthResult = await callRemainingStrength(parsedResult, grammarBridgeResult);
        if (localStrengthResult) {
          var rsrDetail = "RSR: " + (localStrengthResult.data_quality || "?");
          if (localStrengthResult.governing_maop) {
            rsrDetail = rsrDetail + " | MAOP " + localStrengthResult.governing_maop + " psi";
            if (localStrengthResult.safe_envelope) rsrDetail = rsrDetail + " | " + localStrengthResult.safe_envelope;
          } else if (localStrengthResult.severity_tier && localStrengthResult.severity_tier !== "UNKNOWN") {
            rsrDetail = rsrDetail + " | " + localStrengthResult.severity_tier;
          }
          s = updateStep(3, { status: "done", detail: authDetail + " || " + rsrDetail }, s);
          setSteps(s.slice());
        }
      } catch (rsrErr: any) {
        errs.push("remaining-strength (unconditional): " + (rsrErr && rsrErr.message ? rsrErr.message : String(rsrErr)));
      }

      s = updateStep(4, { status: "running", detail: "6 Klein bottle states..." }, s); setSteps(s.slice());
      var coreResult: any = null;
      try {
        var coreRes = await callAPI("decision-core", {
          parsed: parsedResult, asset: assetResult, confirmed_flags: confirmedFlags,
          transcript: inputText, reality_lock: realityLock, evidence_provenance: provenanceData,
          authority_lock: localAuthResult
        });
        coreResult = coreRes.decision_core || coreRes;
        setDecisionCore(coreResult);
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

      // DEPLOY170.3: pipeline reorder -- Hardening runs first (step 5)
      s = updateStep(5, { status: "running", detail: "challenge + unknown state..." }, s); setSteps(s.slice());
      if (coreResult) {
        try {
          setHardeningLoading(true);
          hardenRes = await runHardeningPipeline(
            inputText, parsedResult, assetResult, grammarBridgeResult, provenanceData,
            coreResult.damage_reality || null, coreResult.inspection_reality || null,
            coreResult.authority_reality || null, coreResult.contradiction_engine || null,
            coreResult.consequence_reality || null, coreResult, savedCaseId || undefined
          );
          setHardeningResult(hardenRes);
          var rState = hardenRes?.unknownStateResult?.reality_state || "?";
          var tFacts = hardenRes?.trustedFacts?.length || 0;
          s = updateStep(5, { status: "done", detail: rState + " | " + tFacts + " trusted facts" }, s);
        } catch (hErr: any) {
          s = updateStep(5, { status: "error", detail: hErr.message }, s);
          errs.push("hardening: " + hErr.message);
        } finally { setHardeningLoading(false); }
      } else { s = updateStep(5, { status: "error", detail: "no decision-core data" }, s); }
      setSteps(s.slice());

      // DEPLOY170.3: FMD + DPR runs second (step 6)
      s = updateStep(6, { status: "running", detail: "evaluating failure modes..." }, s); setSteps(s.slice());
      try {
        fmdResult = await callFailureModeDominance(parsedResult, grammarBridgeResult, confirmedFlags, localAuthResult, localStrengthResult);
        if (fmdResult) {
          var govMode = fmdResult.governing_failure_mode || "?";
          var govSev = fmdResult.governing_severity || "?";
          var fmdDetail = govMode + " | " + govSev;
          if (fmdResult.interaction_flag) fmdDetail = fmdDetail + " | INTERACTION";
          dpResult = await callDispositionPathway(fmdResult, localStrengthResult, hardenRes, coreResult);
          if (dpResult) {
            fmdDetail = fmdDetail + " | " + dpResult.disposition;
            s = updateStep(6, { status: "done", detail: fmdDetail }, s);
          } else { s = updateStep(6, { status: "done", detail: fmdDetail + " | no disposition" }, s); }
        } else { s = updateStep(6, { status: "done", detail: "no failure mode data" }, s); }
      } catch (fmdErr: any) {
        s = updateStep(6, { status: "error", detail: fmdErr.message }, s);
        errs.push("failure-mode-dominance: " + fmdErr.message);
      }
      setSteps(s.slice());

      // DEPLOY170.3: FTR runs third (step 7)
      s = updateStep(7, { status: "running", detail: "projecting remaining life..." }, s); setSteps(s.slice());
      try {
        ftResult = await callFailureTimeline(parsedResult, grammarBridgeResult, confirmedFlags, localStrengthResult, fmdResult);
        if (ftResult) {
          var govTime = ftResult.governing_time_years;
          var govModeFt = ftResult.governing_failure_mode || "?";
          var ftDetail = govModeFt;
          if (govTime !== null) {
            ftDetail = ftDetail + " | " + (govTime < 1 ? (govTime * 12).toFixed(1) + " mo" : govTime.toFixed(1) + " yr");
          }
          if (ftResult.urgency) ftDetail = ftDetail + " | " + ftResult.urgency;
          s = updateStep(7, { status: "done", detail: ftDetail }, s);
        } else { s = updateStep(7, { status: "done", detail: "no timeline data" }, s); }
      } catch (ftErr: any) {
        s = updateStep(7, { status: "error", detail: ftErr.message }, s);
        errs.push("failure-timeline: " + ftErr.message);
      }
      setSteps(s.slice());

      // DEPLOY170.3: Superbrain runs LAST (step 8) with full engine context.
      // This is the architectural fix that unlocks DEPLOY170.2 backend
      // constraints. Previously superbrain ran at step 5 with only
      // decision_core + transcript, so FMD/DPR/FTR results were null at
      // synthesis time and the FMD governing mode override block could
      // never fire. With this reorder, superbrain now has full access to
      // ALR, RSR, FMD, DPR, FTR at synthesis time and the backend v1.2
      // constraint blocks activate correctly.
      s = updateStep(8, { status: "running", detail: "GPT-4o constrained by decision-core + engines..." }, s); setSteps(s.slice());
      if (coreResult) {
        try {
          var sbBody: any = {
            decision_core: coreResult,
            transcript: inputText
          };
          // DEPLOY170.3: pass all available engine results to superbrain.
          // Backend v1.2 uses these to activate FMD governing mode override
          // and ALR contradiction matrix scope rule. Null-safe: backend
          // handles absent fields gracefully (behaves like v1.1 if none sent).
          if (localAuthResult) sbBody.authority_lock = localAuthResult;
          if (localStrengthResult) sbBody.remaining_strength = localStrengthResult;
          if (fmdResult) sbBody.failure_mode_dominance = fmdResult;
          if (dpResult) sbBody.disposition_pathway = dpResult;
          if (ftResult) sbBody.failure_timeline = ftResult;
          var sbRes = await fetch('/.netlify/functions/superbrain-synthesis', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sbBody)
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
            // DEPLOY170.3: surface constraint metadata in step detail if present
            var sbDetail = featureCount + " features synthesized";
            if (sbData.constraint_metadata) {
              var cm = sbData.constraint_metadata;
              var flags = [];
              if (cm.fmd_override_applied) flags.push("FMD-lock");
              if (cm.alr_scope_applied) flags.push("ALR-scope");
              if (cm.narrative_corrected) flags.push("narr-corrected");
              if (cm.matrix_filter_applied && cm.matrix_entries_removed && cm.matrix_entries_removed.length > 0) flags.push("matrix-filtered(" + cm.matrix_entries_removed.length + ")");
              if (flags.length > 0) sbDetail = sbDetail + " | " + flags.join(", ");
            }
            s = updateStep(8, { status: "done", detail: sbDetail }, s);
          } else {
            var sbErrText = await sbRes.text();
            setSuperbrainError('Status ' + sbRes.status);
            s = updateStep(8, { status: "error", detail: "status " + sbRes.status }, s);
            errs.push("superbrain-synthesis: " + sbErrText.substring(0, 200));
          }
        } catch (sbEx: any) {
          setSuperbrainError(sbEx.message || String(sbEx));
          s = updateStep(8, { status: "error", detail: sbEx.message }, s);
          errs.push("superbrain-synthesis: " + sbEx.message);
        }
      } else { s = updateStep(8, { status: "error", detail: "no decision-core data" }, s); }
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
  var conf = dc?.reality_confidence;
  var dec = dc?.decision_reality;
  var syn = superbrainResult?.synthesis;

  var liveFailureMode = (con && con.failure_mode) || "unknown";
  var liveFailureModeSource = "decision-core";
  if (failureModeDominanceResult && failureModeDominanceResult.governing_failure_mode && failureModeDominanceResult.governing_failure_mode !== "NONE") {
    liveFailureMode = failureModeDominanceResult.governing_failure_mode.toLowerCase().replace(/_/g, " ");
    liveFailureModeSource = "FMD v1.3.2";
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 4px 0", color: "#111" }}>FORGED NDT Intelligence OS {"\u2014"} v16.6m</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>DEPLOY176: hard confidence gate + forced reality enforcement layer. Provisional mode when HIGH/CRITICAL tier falls below 0.60.</p>
      </div>

      <div style={{ marginBottom: "20px", border: "1px solid #d1d5db", borderRadius: "8px", overflow: "hidden", backgroundColor: "#fff" }}>
        <textarea value={transcript} onChange={function(e) { setTranscript(e.target.value); }} placeholder="Describe the scenario..." style={{ width: "100%", minHeight: "120px", padding: "14px 16px", fontSize: "14px", lineHeight: "1.6", border: "none", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>{transcript.length > 0 ? transcript.split(/\s+/).filter(Boolean).length + " words" : "Speak or type"}</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={toggleMic} style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 700, color: isListening ? "#fff" : "#dc2626", backgroundColor: isListening ? "#dc2626" : "#fff", border: "2px solid #dc2626", borderRadius: "6px", cursor: "pointer" }}>{isListening ? "\uD83D\uDD34 Listening..." : "\uD83C\uDF99\uFE0F Mic"}</button>
            <button onClick={function() { handleGenerate(); }} disabled={isGenerating || !transcript.trim()} style={{ padding: "8px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#2563eb", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer" }}>{isGenerating ? "Analyzing..." : "Analyze"}</button>
          </div>
        </div>
      </div>

      <PhotoAnalysisCard
        contextTranscript={transcript}
        assetType={asset?.asset_class || ""}
        serviceEnvironment=""
        onAddendumReady={function(addendum: string) {
          setTranscript(function(prev: string) {
            var sep = prev.trim().length > 0 ? " " : "";
            return prev + sep + addendum;
          });
        }}
      />

      {steps.length > 0 && <StepTracker steps={steps} />}

      {errors.length > 0 && (<div style={{ margin: "12px 0", padding: "12px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>{errors.map(function(e, i) { return <div key={i} style={{ fontSize: "12px", color: "#dc2626", padding: "2px 0", fontFamily: "monospace" }}>{e}</div>; })}</div>)}

      <div ref={resultsRef}>

        {grammarBridgeResult && evidenceConfirmPending && (
          <div style={{ margin: "0 0 16px 0", padding: "16px", backgroundColor: gbConfirmed ? "#f0fdf4" : "#f0f9ff", border: "1px solid " + (gbConfirmed ? "#bbf7d0" : "#bae6fd"), borderRadius: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: gbConfirmed ? "#16a34a" : "#0369a1", marginBottom: "8px" }}>
              {gbConfirmed ? "\u2705 Readback Confirmed" : "\uD83C\uDF99\uFE0F Voice Grammar Bridge"}
            </div>
            <div style={{ fontSize: "14px", color: "#1e3a5f", lineHeight: "1.6", padding: "10px 12px", backgroundColor: "#fff", borderRadius: "6px", border: "1px solid #e0f2fe", marginBottom: "12px" }}>
              {grammarBridgeResult.readback || "No readback generated"}
            </div>
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

        {dc && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={function() { generateInspectionReport({ transcript: transcript, parsed: parsed, asset: asset, decisionCore: dc, aiNarrative: aiNarrative, superbrainResult: superbrainResult, provenanceResult: provenanceResult, authorityLockResult: authorityLockResult, remainingStrengthResult: remainingStrengthResult, failureModeDominanceResult: failureModeDominanceResult, dispositionPathwayResult: dispositionPathwayResult, failureTimelineResult: failureTimelineResult, errors: errors }); }} disabled={isGenerating} style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: isGenerating ? "#9ca3af" : "#1e40af", border: "none", borderRadius: "6px", cursor: isGenerating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                {isGenerating ? "\u23F3 Pipeline Running..." : "\uD83D\uDCC4 Export PDF"}
              </button>
              {saveStatus === "saved" ? (
                <div style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: "#16a34a", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {"\u2705"} Saved {"\u2014"} {savedCaseId}
                </div>
              ) : (
                <button onClick={handleSaveToCase} disabled={saveStatus === "saving" || isGenerating} style={{ flex: 1, padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", backgroundColor: (saveStatus === "saving" || isGenerating) ? "#9ca3af" : "#16a34a", border: "none", borderRadius: "6px", cursor: (saveStatus === "saving" || isGenerating) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {saveStatus === "saving" ? "\u23F3 Saving..." : "\uD83D\uDCBE Save to Cases"}
                </button>
              )}
            </div>
            {saveStatus === "saved" && (
              <div style={{ marginTop: "8px", padding: "10px 14px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px" }}>
                <span style={{ fontSize: "13px", color: "#16a34a" }}>{"\u2705"} Case {savedCaseId} saved</span>
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
              <div style={{ fontWeight: 800, fontSize: "16px", color: bandColor(conf.band) }}>Reality Confidence: {conf.band}</div>
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
          </div>
        )}

        {con && (
          <Card title={"Consequence: " + con.consequence_tier} icon={con.consequence_tier === "CRITICAL" ? "\uD83D\uDED1" : "\u2139\uFE0F"} collapsible={false}>
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "8px", fontWeight: 800, fontSize: "18px", color: "#fff", backgroundColor: tierColor(con.consequence_tier), textAlign: "center" }}>
              {con.consequence_tier} CONSEQUENCE {"\u2014"} {liveFailureMode.toUpperCase()}
            </div>
            <div style={{ fontSize: "10px", color: "#6b7280", textAlign: "center", marginBottom: "10px" }}>[{liveFailureModeSource}]</div>
            <div style={{ fontSize: "13px", color: "#374151" }}>{con.failure_physics || ""}</div>
          </Card>
        )}

        {dec && (
          <Card title={"Decision: " + (dec.disposition || "").replace(/_/g, " ").toUpperCase()} icon={dec.disposition === "no_go" ? "\uD83D\uDED1" : "\u2705"} collapsible={false}>
            <div style={{ padding: "12px 16px", borderRadius: "6px", marginBottom: "12px", fontWeight: 800, fontSize: "16px", color: "#fff", backgroundColor: dec.disposition === "no_go" ? "#dc2626" : dec.disposition === "hold_for_review" || dec.disposition === "engineering_review_required" ? "#ca8a04" : "#16a34a", textAlign: "center" }}>
              {(dec.disposition || "").replace(/_/g, " ").toUpperCase()}
            </div>
            <div style={{ fontSize: "13px", color: "#374151", marginBottom: "12px" }}>{dec.disposition_basis}</div>
            {dec.gates && dec.gates.map(function(g: any, i: number) {
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", marginBottom: "3px", backgroundColor: g.result === "BLOCKED" ? "#fef2f2" : g.result === "ESCALATED" ? "#fffbeb" : "#f0fdf4", borderRadius: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{gateIcon(g.result)}</span>
                  <span style={{ fontWeight: 600, fontSize: "12px", color: gateColor(g.result) }}>{g.gate.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>{g.reason}</span>
                </div>
              );
            })}
          </Card>
        )}

        {syn && syn.failure_narrative && (
          <Card title="Failure Narrative" icon={"\uD83D\uDCD6"} accent="#2563eb">
            <div style={{ fontSize: "13px", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{syn.failure_narrative}</div>
          </Card>
        )}

        {syn && syn.inspector_action_card && syn.inspector_action_card.length > 0 && (
          <Card title="Inspector Action Card" icon={"\u2705"} accent="#16a34a">
            {syn.inspector_action_card.map(function(action: any, i: number) {
              return (
                <div key={i} style={{ padding: "10px 12px", marginBottom: "8px", backgroundColor: "#f9fafb", borderRadius: "6px", borderLeft: "3px solid #16a34a" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>#{i + 1} {action.step}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>{action.rationale}</div>
                </div>
              );
            })}
          </Card>
        )}

        {syn && syn.contradiction_matrix && syn.contradiction_matrix.length > 0 && (
          <Card title="Contradiction Matrix" icon={"\u26A0\uFE0F"} accent="#dc2626" defaultCollapsed={true}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead><tr style={{ backgroundColor: "#fef2f2" }}><th style={{ padding: "6px", textAlign: "left" }}>Framework</th><th style={{ padding: "6px" }}>Verdict</th><th style={{ padding: "6px", textAlign: "left" }}>Gap</th></tr></thead>
              <tbody>
                {syn.contradiction_matrix.map(function(row: any, i: number) {
                  return <tr key={i}><td style={{ padding: "6px" }}>{row.framework}</td><td style={{ padding: "6px", textAlign: "center" }}>{row.verdict}</td><td style={{ padding: "6px" }}>{row.gap_reason}</td></tr>;
                })}
              </tbody>
            </table>
          </Card>
        )}

        {phy && (
          <Card title="Physical Reality" icon={"\u269B\uFE0F"} defaultCollapsed={true}>
            <div style={{ fontSize: "13px", color: "#374151" }}>{phy.physics_summary}</div>
          </Card>
        )}

        {dmg && (
          <Card title="Damage Reality" icon={"\uD83E\uDDEA"} defaultCollapsed={true} status={(dmg.validated_mechanisms?.length || 0) + " validated"}>
            {dmg.primary_mechanism && (
              <div style={{ fontSize: "13px", padding: "10px", backgroundColor: "#f0fdf4", borderRadius: "6px" }}>
                <strong>Primary:</strong> {dmg.primary_mechanism.name} {"\u2014"} {dmg.primary_mechanism.physics_basis}
              </div>
            )}
          </Card>
        )}

        {auth && (
          <Card title="Authority Reality" icon={"\uD83D\uDCDC"} defaultCollapsed={true} status={auth.primary_authority}>
            <div style={{ fontSize: "13px" }}>Primary: <strong>{auth.primary_authority}</strong></div>
            <div style={{ fontSize: "12px", color: "#374151", marginTop: "4px" }}>{auth.physics_code_alignment}</div>
          </Card>
        )}

        {insp && (
          <Card title="Inspection Reality" icon={"\uD83D\uDD2C"} defaultCollapsed={true} status={insp.sufficiency_verdict}>
            <div style={{ padding: "10px", borderRadius: "6px", color: "#fff", textAlign: "center", backgroundColor: insp.sufficiency_verdict === "BLOCKED" ? "#dc2626" : insp.sufficiency_verdict === "INSUFFICIENT" ? "#ea580c" : "#16a34a", fontWeight: 700 }}>
              {insp.sufficiency_verdict}
            </div>
            <div style={{ fontSize: "12px", color: "#374151", marginTop: "8px" }}>{insp.physics_reason}</div>
          </Card>
        )}

        {(authorityLockResult || remainingStrengthResult || failureModeDominanceResult || dispositionPathwayResult || failureTimelineResult) && (
          <div style={{ marginBottom: "16px", padding: "12px", border: "2px solid #000", borderRadius: "8px", backgroundColor: "#fffbe6" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px" }}>Build 1+2+3 Engine Results (v16.6m inline diagnostic)</div>
            <div style={{ fontSize: "11px", fontFamily: "monospace", lineHeight: "1.6" }}>
              <div>ALR: {authorityLockResult ? "PRESENT \u2014 status=" + (authorityLockResult.status || "?") + " | " + ((authorityLockResult.authority_chain || []).length) + " primary | trigger_b31g=" + String(!!authorityLockResult.trigger_b31g) : "null"}</div>
              <div>RSR: {remainingStrengthResult ? "PRESENT \u2014 tier=" + (remainingStrengthResult.data_quality || "?") + " | envelope=" + (remainingStrengthResult.safe_envelope || "?") + " | MAOP=" + (remainingStrengthResult.governing_maop || "?") + " | severity=" + (remainingStrengthResult.severity_tier || "?") : "null"}</div>
              <div>FMD: {failureModeDominanceResult ? "PRESENT \u2014 governing=" + (failureModeDominanceResult.governing_failure_mode || "?") + " | severity=" + (failureModeDominanceResult.governing_severity || "?") : "null"}</div>
              <div>DPR: {dispositionPathwayResult ? "PRESENT \u2014 disposition=" + (dispositionPathwayResult.disposition || "?") + " | urgency=" + (dispositionPathwayResult.urgency || "?") : "null"}</div>
              <div>FTR: {failureTimelineResult ? "PRESENT \u2014 mode=" + (failureTimelineResult.governing_failure_mode || "?") + " | urgency=" + (failureTimelineResult.urgency || "?") + " | progression=" + (failureTimelineResult.progression_state || "?") + " | life=" + (failureTimelineResult.governing_time_years !== null && failureTimelineResult.governing_time_years !== undefined ? Number(failureTimelineResult.governing_time_years).toFixed(1) + "yr" : "?") : "null"}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
