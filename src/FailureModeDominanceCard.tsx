// FAILURE MODE DOMINANCE CARD v1.0
// File: src/FailureModeDominanceCard.tsx

import React from "react";

interface FailureModeDominanceCardProps {
  result: any | null;
}

function FailureModeDominanceCard(props: FailureModeDominanceCardProps) {
  if (!props.result) return null;
  var r = props.result;

  var modeColor = r.governing_failure_mode === "CRACKING" ? "#a855f7"
    : r.governing_failure_mode === "CORROSION" ? "#f59e0b"
    : r.governing_failure_mode === "COMPOUND" ? "#ef4444"
    : "#64748b";

  var modeIcon = r.governing_failure_mode === "CRACKING" ? "\u26A1"
    : r.governing_failure_mode === "CORROSION" ? "\u{1F4A7}"
    : r.governing_failure_mode === "COMPOUND" ? "\u{1F6A8}"
    : "\u2754";

  var sevColor = r.governing_severity === "CRITICAL" ? "#ef4444"
    : r.governing_severity === "SEVERE" ? "#ef4444"
    : r.governing_severity === "HIGH" ? "#f59e0b"
    : r.governing_severity === "MODERATE" ? "#3b82f6"
    : "#10b981";

  var cp = r.corrosion_path || {};
  var ck = r.cracking_path || {};

  return React.createElement("div", {
    style: { background: "#1a1a2e", border: "1px solid " + modeColor, borderRadius: "12px", padding: "20px", marginBottom: "16px", fontFamily: "'Inter', sans-serif" }
  },
    // Header
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "20px" } }, modeIcon),
        React.createElement("span", { style: { color: modeColor, fontSize: "14px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" as const } }, "GOVERNING: " + r.governing_failure_mode)
      ),
      React.createElement("span", { style: { color: "#64748b", fontSize: "11px", fontFamily: "monospace" } }, "ENGINE: failure-mode-dominance v1.0")
    ),

    // Severity + Governing Pressure
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" } },
      React.createElement("div", { style: { background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "12px", textAlign: "center" as const } },
        React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "4px" } }, "SEVERITY"),
        React.createElement("div", { style: { color: sevColor, fontSize: "18px", fontWeight: "700" } }, r.governing_severity || "UNDETERMINED")
      ),
      React.createElement("div", { style: { background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "12px", textAlign: "center" as const } },
        React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "4px" } }, "FAILURE PRESSURE"),
        React.createElement("div", { style: { color: "#e2e8f0", fontSize: "18px", fontWeight: "700", fontFamily: "monospace" } }, r.governing_failure_pressure ? (r.governing_failure_pressure + " psi") : "N/A")
      ),
      React.createElement("div", { style: { background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "12px", textAlign: "center" as const } },
        React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "4px" } }, "ASSESSMENT"),
        React.createElement("div", { style: { color: "#94a3b8", fontSize: "12px", fontWeight: "600" } }, r.governing_code_reference || "API 579-1")
      )
    ),

    // Governing basis
    React.createElement("div", { style: { padding: "10px 14px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", marginBottom: "16px", borderLeft: "3px solid " + modeColor } },
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" } }, r.governing_basis)
    ),

    // Parallel Paths
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" } },
      // Corrosion path
      React.createElement("div", { style: { padding: "12px", borderRadius: "8px", border: "1px solid " + (cp.active ? "rgba(245, 158, 11, 0.3)" : "rgba(100, 116, 139, 0.2)"), background: cp.active ? "rgba(245, 158, 11, 0.05)" : "rgba(30, 41, 59, 0.3)" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" } },
          React.createElement("span", { style: { fontSize: "14px" } }, "\u{1F4A7}"),
          React.createElement("span", { style: { color: cp.active ? "#f59e0b" : "#475569", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" as const } }, "CORROSION PATH"),
          React.createElement("span", { style: { color: cp.active ? "#f59e0b" : "#475569", fontSize: "10px", padding: "2px 6px", borderRadius: "3px", background: cp.active ? "rgba(245, 158, 11, 0.15)" : "rgba(100, 116, 139, 0.1)" } }, cp.active ? "ACTIVE" : "INACTIVE")
        ),
        cp.active && React.createElement("div", null,
          cp.severity && cp.severity !== "none" && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px" } }, "Severity: " + cp.severity),
          cp.failure_pressure && React.createElement("div", { style: { color: "#e2e8f0", fontSize: "13px", fontWeight: "600", fontFamily: "monospace", marginBottom: "4px" } }, "Failure P: " + cp.failure_pressure + " psi"),
          cp.wall_loss_percent > 0 && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px" } }, "Wall loss: " + cp.wall_loss_percent.toFixed(1) + "%"),
          cp.mechanisms && cp.mechanisms.length > 0 && React.createElement("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" as const, marginTop: "6px" } },
            cp.mechanisms.map(function(m: string, i: number) {
              return React.createElement("span", { key: "cm-" + i, style: { fontSize: "10px", padding: "2px 6px", borderRadius: "3px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" } }, m.replace(/_/g, " "));
            })
          )
        )
      ),

      // Cracking path
      React.createElement("div", { style: { padding: "12px", borderRadius: "8px", border: "1px solid " + (ck.active ? "rgba(168, 85, 247, 0.3)" : "rgba(100, 116, 139, 0.2)"), background: ck.active ? "rgba(168, 85, 247, 0.05)" : "rgba(30, 41, 59, 0.3)" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" } },
          React.createElement("span", { style: { fontSize: "14px" } }, "\u26A1"),
          React.createElement("span", { style: { color: ck.active ? "#a855f7" : "#475569", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" as const } }, "CRACKING PATH"),
          React.createElement("span", { style: { color: ck.active ? "#a855f7" : "#475569", fontSize: "10px", padding: "2px 6px", borderRadius: "3px", background: ck.active ? "rgba(168, 85, 247, 0.15)" : "rgba(100, 116, 139, 0.1)" } }, ck.active ? "ACTIVE" : "INACTIVE")
        ),
        ck.active && React.createElement("div", null,
          ck.severity && ck.severity !== "none" && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px" } }, "Severity: " + ck.severity),
          ck.failure_pressure && React.createElement("div", { style: { color: "#e2e8f0", fontSize: "13px", fontWeight: "600", fontFamily: "monospace", marginBottom: "4px" } }, "Failure P: " + ck.failure_pressure + " psi"),
          ck.brittle_fracture_risk && React.createElement("span", { style: { fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "3px", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" } }, "\u{1F6A8} BRITTLE FRACTURE RISK"),
          ck.mechanisms && ck.mechanisms.length > 0 && React.createElement("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" as const, marginTop: "6px" } },
            ck.mechanisms.map(function(m: string, i: number) {
              return React.createElement("span", { key: "ckm-" + i, style: { fontSize: "10px", padding: "2px 6px", borderRadius: "3px", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7" } }, m.replace(/_/g, " "));
            })
          )
        )
      )
    ),

    // Interaction flag
    r.interaction_flag && React.createElement("div", { style: { padding: "10px 14px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
        React.createElement("span", { style: { fontSize: "14px" } }, "\u26A0\uFE0F"),
        React.createElement("span", { style: { color: "#ef4444", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" as const } }, "MECHANISM INTERACTION: " + r.interaction_type)
      ),
      React.createElement("div", { style: { color: "#fca5a5", fontSize: "12px", lineHeight: "1.5" } }, r.interaction_detail)
    ),

    // Notes (collapsible)
    React.createElement("details", { style: { marginTop: "8px" } },
      React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Path Details"),
      React.createElement("div", { style: { marginTop: "8px", padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
        (cp.notes || []).concat(ck.notes || []).map(function(note: string, i: number) {
          return React.createElement("div", { key: "n-" + i, style: { color: "#94a3b8", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid rgba(51, 65, 85, 0.3)" } }, "\u2022 " + note);
        })
      )
    )
  );
}

export default FailureModeDominanceCard;
