// @ts-nocheck
/**
 * DEPLOY219 - MaterialAuthorityCard.tsx
 * src/components/MaterialAuthorityCard.tsx
 *
 * Unified Material Authority Engine UI.
 * Detects all 8 material classes from case context:
 *   composite repair, coatings, ceramics, polymers,
 *   elastomers, advanced alloys, foams, hybrid/smart.
 *
 * Collapses to one-liner when no material is detected.
 * Expands per-class sections when multiple materials are found.
 *
 * No backticks. var only. String concatenation only.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var STATUS_COLOR = {
  no_material_detected: "#6b7280",
  intact: "#22c55e",
  suspect: "#f59e0b",
  failed: "#ef4444"
};

var STATUS_LABEL = {
  no_material_detected: "NO MATERIAL DETECTED",
  intact: "MATERIALS INTACT",
  suspect: "MATERIALS SUSPECT",
  failed: "MATERIAL FAILURE DETECTED"
};

var SEVERITY_COLOR = { critical: "#ef4444", high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" };

var CLASS_ICON = {
  composite_repair: "fiber",
  coatings: "paint",
  ceramics: "ceramic",
  polymers: "plastic",
  elastomers: "rubber",
  advanced_alloys: "alloy",
  foams: "foam",
  hybrid_smart: "smart"
};

export default function MaterialAuthorityCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [assessment, setAssessment] = useState(null);
  var [generatedAt, setGeneratedAt] = useState(null);
  var [expandedClass, setExpandedClass] = useState(null);

  useEffect(function() { if (caseId) loadExisting(); }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("material_authority_assessment, material_authority_generated_at, material_authority_status")
      .eq("id", caseId)
      .maybeSingle();
    if (!res.error && res.data && res.data.material_authority_assessment) {
      setAssessment(res.data.material_authority_assessment);
      setGeneratedAt(res.data.material_authority_generated_at);
    }
  }

  async function runScan() {
    setRunning(true); setError("");
    try {
      var resp = await fetch("/api/material-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) { setError(json.error || "Assessment failed"); }
      else { setAssessment(json.assessment); setGeneratedAt(json.generated_at); }
    } catch (err) { setError("Network error: " + String(err)); }
    setRunning(false);
  }

  var status = assessment && assessment.status;

  // Collapsed view for no-material cases
  if (assessment && status === "no_material_detected") {
    return (
      <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>Material Authority Engine</div>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>No non-metallic or advanced material signatures detected. Standard steel authority applies.</div>
        </div>
        <button type="button" onClick={runScan} disabled={running}
          style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#21262d", color: "#c9d1d9", border: "1px solid #30363d", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
          {running ? "Scanning..." : "Re-scan"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Material Authority Engine</h3>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>8 material classes &middot; composites &middot; coatings &middot; ceramics &middot; polymers &middot; alloys &middot; elastomers &middot; foams &middot; hybrid</div>
        </div>
        <button type="button" onClick={runScan} disabled={running}
          style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
          {running ? "Scanning..." : (assessment ? "Re-scan" : "Scan for materials")}
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "4px", color: "#fecaca", fontSize: "11px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {!assessment && !running && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No material scan yet. Click "Scan for materials" to check this case for non-metallic and advanced material signatures.
        </div>
      )}

      {assessment && status !== "no_material_detected" && (
        <div>
          {/* Status bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
            <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid " + (STATUS_COLOR[status] || "#30363d") }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Status</div>
              <div style={{ fontSize: "12px", color: STATUS_COLOR[status] || "#c9d1d9", fontWeight: 700 }}>{STATUS_LABEL[status] || status}</div>
            </div>
            <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Classes</div>
              <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{(assessment.detected_classes || []).length}</div>
            </div>
            <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Mechanisms</div>
              <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{(assessment.mechanisms || []).length}</div>
            </div>
            {generatedAt && (
              <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Generated</div>
                <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{new Date(generatedAt).toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Detected material classes */}
          {assessment.detected_classes && assessment.detected_classes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
              {assessment.detected_classes.map(function(dc, i) {
                var isExpanded = expandedClass === dc.material_class;
                return (
                  <button key={i} type="button"
                    onClick={function() { setExpandedClass(isExpanded ? null : dc.material_class); }}
                    style={{
                      padding: "4px 10px", fontSize: "10px", borderRadius: "12px", cursor: "pointer",
                      backgroundColor: isExpanded ? "#1f6feb" : "#161b22",
                      color: isExpanded ? "#fff" : "#c9d1d9",
                      border: "1px solid " + (isExpanded ? "#1f6feb" : "#30363d")
                    }}>
                    {dc.material_label} ({dc.mechanism_count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {assessment.summary && (
            <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#c9d1d9", fontSize: "12px", lineHeight: "1.55", marginBottom: "10px" }}>
              {assessment.summary}
            </div>
          )}

          {/* Authority codes */}
          {assessment.authority_codes && assessment.authority_codes.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase", marginBottom: "4px" }}>Authority Codes Invoked</div>
              {assessment.authority_codes.map(function(c, i) {
                return (
                  <div key={i} style={{ padding: "6px 10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderLeft: "3px solid #58a6ff", borderRadius: "4px", marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>{c.code}</div>
                    <div style={{ fontSize: "10px", color: "#8b949e" }}>{c.title}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mechanisms */}
          {assessment.mechanisms && assessment.mechanisms.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase", marginBottom: "4px" }}>Detected Mechanisms</div>
              {assessment.mechanisms.map(function(m, i) {
                var sc = SEVERITY_COLOR[m.severity] || "#8b949e";
                return (
                  <div key={i} style={{ padding: "8px 10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderLeft: "3px solid " + sc, borderRadius: "4px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "3px" }}>
                      <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{m.name.replace(/_/g, " ")}</div>
                      <span style={{ padding: "2px 6px", fontSize: "9px", color: "#fff", backgroundColor: sc, borderRadius: "3px", textTransform: "uppercase" }}>{m.severity}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "4px" }}>{m.basis}</div>
                    {m.references && m.references.length > 0 && (
                      <div style={{ fontSize: "10px", color: "#58a6ff" }}>refs: {m.references.join(" \u00b7 ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Inspection plan */}
          {assessment.inspection_plan && assessment.inspection_plan.length > 0 && (
            <details>
              <summary style={{ fontSize: "10px", color: "#8b949e", cursor: "pointer" }}>Material-specific inspection plan ({assessment.inspection_plan.length})</summary>
              <div style={{ marginTop: "6px" }}>
                {assessment.inspection_plan.map(function(p, i) {
                  return (
                    <div key={i} style={{ padding: "6px 10px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "4px", marginBottom: "4px" }}>
                      <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>{p.method}</div>
                      <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>{p.rationale}</div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
