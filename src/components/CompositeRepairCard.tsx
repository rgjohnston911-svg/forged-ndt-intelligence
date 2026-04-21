// @ts-nocheck
/**
 * DEPLOY218 - CompositeRepairCard.tsx
 * src/components/CompositeRepairCard.tsx
 *
 * UI surface for the Bonded Composite Repair Authority Pack.
 * Renders on the Decision tab. If no repair is detected, the card
 * collapses to a single line — the pack stays silent on steel-only cases.
 *
 * No backticks. var only. String concatenation only.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var STATUS_COLOR = {
  no_composite_repair_detected: "#6b7280",
  repair_intact: "#22c55e",
  repair_suspect: "#f59e0b",
  repair_failed: "#ef4444",
  insufficient_evidence: "#8b949e"
};

var STATUS_LABEL = {
  no_composite_repair_detected: "NO COMPOSITE REPAIR DETECTED",
  repair_intact: "REPAIR INTACT",
  repair_suspect: "REPAIR SUSPECT",
  repair_failed: "REPAIR FAILED",
  insufficient_evidence: "INSUFFICIENT EVIDENCE"
};

var SEVERITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" };

export default function CompositeRepairCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [assessment, setAssessment] = useState(null);
  var [generatedAt, setGeneratedAt] = useState(null);

  useEffect(function() { if (caseId) loadExisting(); }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("composite_repair_assessment, composite_repair_generated_at, composite_repair_status")
      .eq("id", caseId)
      .maybeSingle();
    if (!res.error && res.data && res.data.composite_repair_assessment) {
      setAssessment(res.data.composite_repair_assessment);
      setGeneratedAt(res.data.composite_repair_generated_at);
    }
  }

  async function runPack() {
    setRunning(true); setError("");
    try {
      var resp = await fetch("/api/composite-repair-authority", {
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

  // Collapsed view for non-detected cases
  if (assessment && !assessment.detected) {
    return (
      <div style={{ marginTop: "16px", padding: "10px 14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>Composite Repair Authority</div>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>No bonded composite repair detected on this case.</div>
        </div>
        <button type="button" onClick={runPack} disabled={running}
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
          <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Composite Repair Authority</h3>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>ASME PCC-2 Art. 4.1 &middot; ISO 24817 &middot; bonded-repair integrity</div>
        </div>
        <button type="button" onClick={runPack} disabled={running}
          style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
          {running ? "Scanning..." : (assessment ? "Re-scan" : "Scan for composite repair")}
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "4px", color: "#fecaca", fontSize: "11px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {!assessment && !running && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No assessment yet. Click "Scan for composite repair" to check this case for carbon fiber / FRP / bonded repair signatures.
        </div>
      )}

      {assessment && assessment.detected && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px", alignItems: "center" }}>
            <div style={{ padding: "6px 12px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid " + (STATUS_COLOR[status] || "#30363d") }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Status</div>
              <div style={{ fontSize: "12px", color: STATUS_COLOR[status] || "#c9d1d9", fontWeight: 700 }}>{STATUS_LABEL[status] || status}</div>
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

          {assessment.summary && (
            <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#c9d1d9", fontSize: "12px", lineHeight: "1.55", marginBottom: "10px" }}>
              {assessment.summary}
            </div>
          )}

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
                      <div style={{ fontSize: "10px", color: "#58a6ff" }}>refs: {m.references.join(" &middot; ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {assessment.required_inspection_plan && assessment.required_inspection_plan.length > 0 && (
            <details>
              <summary style={{ fontSize: "10px", color: "#8b949e", cursor: "pointer" }}>Composite-specific inspection plan ({assessment.required_inspection_plan.length})</summary>
              <div style={{ marginTop: "6px" }}>
                {assessment.required_inspection_plan.map(function(p, i) {
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
