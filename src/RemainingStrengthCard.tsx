import React from "react";

interface RemainingStrengthResult {
  maop_b31g: number;
  maop_modified_b31g: number;
  governing_maop: number;
  governing_method: string;
  barlow_design_pressure: number;
  operating_pressure: number;
  operating_ratio: number;
  safe_envelope: string;
  recommendation: string;
  pressure_reduction_required: number;
  calculations: {
    wall_loss_inches: number;
    wall_loss_percent: number;
    depth_ratio: number;
    d_over_t: number;
    folias_z: number;
    b31g_folias_factor: number;
    b31g_rsf: number;
    modified_folias_factor: number;
    modified_rsf: number;
  };
  inputs: any;
  notes: string[];
  metadata: any;
}

interface RemainingStrengthCardProps {
  result: RemainingStrengthResult | null;
}

function RemainingStrengthCard(props: RemainingStrengthCardProps) {
  if (!props.result) return null;
  var r = props.result;

  var envelopeColor = r.safe_envelope === "WITHIN" ? "#10b981" : r.safe_envelope === "MARGINAL" ? "#f59e0b" : "#ef4444";
  var envelopeIcon = r.safe_envelope === "WITHIN" ? "\u2705" : r.safe_envelope === "MARGINAL" ? "\u26A0\uFE0F" : "\u{1F6A8}";
  var envelopeBg = r.safe_envelope === "WITHIN" ? "rgba(16, 185, 129, 0.08)" : r.safe_envelope === "MARGINAL" ? "rgba(245, 158, 11, 0.08)" : "rgba(239, 68, 68, 0.12)";
  var operatingPercent = (r.operating_ratio * 100).toFixed(1);
  var gaugeWidth = Math.min(r.operating_ratio * 100, 120);

  return React.createElement("div", {
    style: { background: "#1a1a2e", border: "1px solid " + envelopeColor, borderRadius: "12px", padding: "20px", marginBottom: "16px", fontFamily: "'Inter', sans-serif" }
  },
    // Header
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "20px" } }, "\u{1F4CA}"),
        React.createElement("span", { style: { color: envelopeColor, fontSize: "14px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" as const } }, "REMAINING STRENGTH \u2014 " + r.safe_envelope)
      ),
      React.createElement("span", { style: { color: "#64748b", fontSize: "11px", fontFamily: "monospace" } }, "ENGINE: remaining-strength v1.0")
    ),

    // MAOP Comparison
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" } },
      React.createElement("div", { style: { background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "14px", textAlign: "center" as const } },
        React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "6px" } }, "B31G MAOP"),
        React.createElement("div", { style: { color: "#e2e8f0", fontSize: "22px", fontWeight: "700", fontFamily: "monospace" } }, String(r.maop_b31g)),
        React.createElement("div", { style: { color: "#64748b", fontSize: "11px" } }, "psi")
      ),
      React.createElement("div", { style: { background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", padding: "14px", textAlign: "center" as const } },
        React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "6px" } }, "MODIFIED B31G"),
        React.createElement("div", { style: { color: "#e2e8f0", fontSize: "22px", fontWeight: "700", fontFamily: "monospace" } }, String(r.maop_modified_b31g)),
        React.createElement("div", { style: { color: "#64748b", fontSize: "11px" } }, "psi")
      ),
      React.createElement("div", { style: { background: envelopeBg, border: "1px solid " + envelopeColor + "33", borderRadius: "8px", padding: "14px", textAlign: "center" as const } },
        React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "6px" } }, "OPERATING"),
        React.createElement("div", { style: { color: envelopeColor, fontSize: "22px", fontWeight: "700", fontFamily: "monospace" } }, String(r.operating_pressure)),
        React.createElement("div", { style: { color: "#64748b", fontSize: "11px" } }, "psi")
      )
    ),

    // Operating Ratio Gauge
    React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "6px" } },
        React.createElement("span", { style: { color: "#94a3b8", fontSize: "12px" } }, "Operating Ratio"),
        React.createElement("span", { style: { color: envelopeColor, fontSize: "14px", fontWeight: "700", fontFamily: "monospace" } }, operatingPercent + "% of MAOP")
      ),
      React.createElement("div", { style: { position: "relative" as const, height: "12px", background: "rgba(30, 41, 59, 0.8)", borderRadius: "6px", overflow: "hidden" as const } },
        React.createElement("div", { style: { position: "absolute" as const, left: "80%", top: "0", bottom: "0", width: "2px", background: "#f59e0b", zIndex: 2 } }),
        React.createElement("div", { style: { width: Math.min(gaugeWidth, 100) + "%", height: "100%", background: envelopeColor, borderRadius: "6px", transition: "width 0.5s ease" } })
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "4px" } },
        React.createElement("span", { style: { color: "#475569", fontSize: "10px" } }, "0%"),
        React.createElement("span", { style: { color: "#f59e0b", fontSize: "10px" } }, "80% safe"),
        React.createElement("span", { style: { color: "#ef4444", fontSize: "10px" } }, "100% MAOP")
      )
    ),

    // Recommendation
    React.createElement("div", { style: { background: envelopeBg, border: "1px solid " + envelopeColor + "33", borderRadius: "8px", padding: "14px", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "16px" } }, envelopeIcon),
        React.createElement("div", null,
          React.createElement("div", { style: { color: envelopeColor, fontSize: "12px", fontWeight: "700", textTransform: "uppercase" as const, marginBottom: "4px" } }, "ENGINEERING RECOMMENDATION"),
          React.createElement("div", { style: { color: "#cbd5e1", fontSize: "13px", lineHeight: "1.5" } }, r.recommendation)
        )
      )
    ),

    // Pressure reduction badge
    r.pressure_reduction_required > 0 && React.createElement("div", {
      style: { background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }
    },
      React.createElement("span", { style: { color: "#fca5a5", fontSize: "13px", fontWeight: "600" } }, "\u{1F6A8} REQUIRED PRESSURE REDUCTION"),
      React.createElement("span", { style: { color: "#ef4444", fontSize: "20px", fontWeight: "700", fontFamily: "monospace" } }, r.pressure_reduction_required + " psi")
    ),

    // Calculation details
    React.createElement("details", { style: { marginBottom: "12px" } },
      React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Calculation Details"),
      React.createElement("div", { style: { marginTop: "8px", padding: "12px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" } },
        ["Wall Loss: " + r.calculations.wall_loss_percent.toFixed(1) + "%",
         "Depth Ratio (d/t): " + r.calculations.depth_ratio.toFixed(3),
         "D/t Ratio: " + r.calculations.d_over_t.toFixed(1),
         "Folias Z: " + r.calculations.folias_z.toFixed(3),
         "B31G Folias M: " + r.calculations.b31g_folias_factor.toFixed(3),
         "B31G RSF: " + r.calculations.b31g_rsf.toFixed(3),
         "Mod. Folias M: " + r.calculations.modified_folias_factor.toFixed(3),
         "Mod. RSF: " + r.calculations.modified_rsf.toFixed(3),
         "Barlow Design: " + r.barlow_design_pressure + " psi",
         "Governing: " + r.governing_method
        ].map(function(line, i) {
          return React.createElement("div", { key: "calc-" + i, style: { color: "#94a3b8", fontSize: "11px", fontFamily: "monospace" } }, line);
        })
      )
    ),

    // Engineering notes
    r.notes.length > 0 && React.createElement("details", null,
      React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Engineering Notes (" + r.notes.length + ")"),
      React.createElement("div", { style: { marginTop: "8px", padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
        r.notes.map(function(note, i) {
          return React.createElement("div", { key: "note-" + i, style: { color: "#94a3b8", fontSize: "11px", padding: "4px 0", borderBottom: i < r.notes.length - 1 ? "1px solid rgba(51, 65, 85, 0.3)" : "none" } }, "\u2022 " + note);
        })
      )
    )
  );
}

export default RemainingStrengthCard;
