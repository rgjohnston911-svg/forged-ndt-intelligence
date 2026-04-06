// FAILURE TIMELINE CARD v1.0
// File: src/FailureTimelineCard.tsx

import React from "react";

interface FailureTimelineCardProps {
  result: any | null;
}

function FailureTimelineCard(props: FailureTimelineCardProps) {
  if (!props.result) return null;
  var r = props.result;

  var urgColor = r.urgency === "EMERGENCY" ? "#ef4444"
    : r.urgency === "CRITICAL" ? "#ef4444"
    : r.urgency === "PRIORITY" ? "#f59e0b"
    : r.urgency === "ELEVATED" ? "#3b82f6"
    : "#10b981";

  var urgIcon = r.urgency === "EMERGENCY" ? "\u{1F6A8}"
    : r.urgency === "CRITICAL" ? "\u26A0\uFE0F"
    : r.urgency === "PRIORITY" ? "\u23F0"
    : r.urgency === "ELEVATED" ? "\u{1F4C5}"
    : "\u2705";

  var ct = r.corrosion_timeline || {};
  var kt = r.crack_timeline || {};

  var formatYears = function(years: any) {
    if (years === null || years === undefined) return "N/A";
    if (years === 0) return "EXPIRED";
    if (years < 1) return (years * 12).toFixed(1) + " months";
    return years.toFixed(1) + " years";
  };

  return React.createElement("div", {
    style: { background: "#1a1a2e", border: "1px solid " + urgColor, borderRadius: "12px", padding: "20px", marginBottom: "16px", fontFamily: "'Inter', sans-serif" }
  },
    // Header
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "22px" } }, urgIcon),
        React.createElement("span", { style: { color: urgColor, fontSize: "14px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" as const } }, "FAILURE TIMELINE \u2014 " + r.urgency)
      ),
      React.createElement("span", { style: { color: "#64748b", fontSize: "11px", fontFamily: "monospace" } }, "ENGINE: failure-timeline v1.0")
    ),

    // Governing timeline
    React.createElement("div", { style: { padding: "16px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", marginBottom: "16px", borderLeft: "4px solid " + urgColor } },
      React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "6px" } }, "GOVERNING REMAINING LIFE"),
      React.createElement("div", { style: { color: urgColor, fontSize: "32px", fontWeight: "700", fontFamily: "monospace", marginBottom: "4px" } }, formatYears(r.governing_time_years)),
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" } }, r.governing_basis || "Mode: " + (r.governing_failure_mode || "none"))
    ),

    // Recommended interval
    r.recommended_inspection_interval_years !== null && React.createElement("div", { style: { padding: "12px 14px", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
        React.createElement("span", { style: { fontSize: "14px" } }, "\u{1F4C5}"),
        React.createElement("span", { style: { color: "#3b82f6", fontSize: "12px", fontWeight: "600", textTransform: "uppercase" as const } }, "RECOMMENDED INSPECTION INTERVAL")
      ),
      React.createElement("span", { style: { color: "#3b82f6", fontSize: "16px", fontWeight: "700", fontFamily: "monospace" } }, formatYears(r.recommended_inspection_interval_years))
    ),

    // Corrosion + Crack timelines side by side
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" } },
      // Corrosion timeline
      React.createElement("div", { style: { padding: "12px", borderRadius: "8px", border: "1px solid " + (ct.enabled ? "rgba(245, 158, 11, 0.3)" : "rgba(100, 116, 139, 0.2)"), background: ct.enabled ? "rgba(245, 158, 11, 0.05)" : "rgba(30, 41, 59, 0.3)" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" } },
          React.createElement("span", { style: { fontSize: "14px" } }, "\u{1F4A7}"),
          React.createElement("span", { style: { color: ct.enabled ? "#f59e0b" : "#475569", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" as const } }, "CORROSION TIMELINE")
        ),
        ct.enabled && React.createElement("div", null,
          ct.corrosion_rate_mpy > 0 && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px", fontFamily: "monospace" } }, "Rate: " + ct.corrosion_rate_mpy.toFixed(1) + " mpy"),
          ct.remaining_wall_mils > 0 && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px", fontFamily: "monospace" } }, "Remaining: " + ct.remaining_wall_mils + " mils"),
          React.createElement("div", { style: { color: "#e2e8f0", fontSize: "16px", fontWeight: "700", fontFamily: "monospace", marginTop: "6px" } }, formatYears(ct.remaining_life_years)),
          ct.confidence !== "none" && React.createElement("div", { style: { color: "#64748b", fontSize: "10px", marginTop: "4px" } }, "confidence: " + ct.confidence),
          ct.method !== "none" && React.createElement("div", { style: { fontSize: "10px", color: "#64748b", marginTop: "2px" } }, "method: " + ct.method.replace(/_/g, " "))
        ),
        !ct.enabled && React.createElement("div", { style: { color: "#475569", fontSize: "11px", fontStyle: "italic" } }, "No corrosion detected")
      ),

      // Crack timeline
      React.createElement("div", { style: { padding: "12px", borderRadius: "8px", border: "1px solid " + (kt.enabled ? "rgba(168, 85, 247, 0.3)" : "rgba(100, 116, 139, 0.2)"), background: kt.enabled ? "rgba(168, 85, 247, 0.05)" : "rgba(30, 41, 59, 0.3)" } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" } },
          React.createElement("span", { style: { fontSize: "14px" } }, "\u26A1"),
          React.createElement("span", { style: { color: kt.enabled ? "#a855f7" : "#475569", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" as const } }, "CRACK GROWTH (Paris Law)")
        ),
        kt.enabled && React.createElement("div", null,
          kt.delta_K_ksi_sqrt_in > 0 && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px", fontFamily: "monospace" } }, "\u0394K: " + kt.delta_K_ksi_sqrt_in + " ksi\u221Ain"),
          kt.cycles_to_failure !== null && React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginBottom: "4px", fontFamily: "monospace" } }, "Cycles: " + (kt.cycles_to_failure ? kt.cycles_to_failure.toLocaleString() : "N/A")),
          React.createElement("div", { style: { color: "#e2e8f0", fontSize: "16px", fontWeight: "700", fontFamily: "monospace", marginTop: "6px" } }, formatYears(kt.time_to_failure_years)),
          kt.confidence !== "none" && React.createElement("div", { style: { color: "#64748b", fontSize: "10px", marginTop: "4px" } }, "confidence: " + kt.confidence)
        ),
        !kt.enabled && React.createElement("div", { style: { color: "#475569", fontSize: "11px", fontStyle: "italic" } }, "No cracking detected")
      )
    ),

    // Notes (collapsible)
    ((ct.notes && ct.notes.length > 0) || (kt.notes && kt.notes.length > 0)) && React.createElement("details", { style: { marginTop: "8px" } },
      React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Engineering Notes"),
      React.createElement("div", { style: { marginTop: "8px", padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
        (ct.notes || []).concat(kt.notes || []).map(function(note: string, i: number) {
          return React.createElement("div", { key: "n-" + i, style: { color: "#94a3b8", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid rgba(51, 65, 85, 0.3)" } }, "\u2022 " + note);
        })
      )
    )
  );
}

export default FailureTimelineCard;
