// DISPOSITION PATHWAY CARD v1.0
// File: src/DispositionPathwayCard.tsx

import React from "react";

interface DispositionPathwayCardProps {
  result: any | null;
}

function DispositionPathwayCard(props: DispositionPathwayCardProps) {
  if (!props.result) return null;
  var r = props.result;

  var dispColor = r.disposition === "IMMEDIATE_ACTION" ? "#ef4444"
    : r.disposition === "HOLD_FOR_DATA" ? "#f59e0b"
    : r.disposition === "ENGINEERING_ASSESSMENT" ? "#a855f7"
    : r.disposition === "MONITOR" ? "#3b82f6"
    : r.disposition === "CONTINUE_SERVICE" ? "#10b981"
    : "#64748b";

  var dispIcon = r.disposition === "IMMEDIATE_ACTION" ? "\u{1F6A8}"
    : r.disposition === "HOLD_FOR_DATA" ? "\u23F8\uFE0F"
    : r.disposition === "ENGINEERING_ASSESSMENT" ? "\u{1F52C}"
    : r.disposition === "MONITOR" ? "\u{1F4CA}"
    : r.disposition === "CONTINUE_SERVICE" ? "\u2705"
    : "\u2754";

  var urgColor = r.urgency === "EMERGENCY" ? "#ef4444"
    : r.urgency === "PRIORITY" ? "#f59e0b"
    : r.urgency === "EXPEDITED" ? "#f59e0b"
    : r.urgency === "ELEVATED" ? "#3b82f6"
    : r.urgency === "STANDARD" ? "#94a3b8"
    : "#10b981";

  var actions = r.actions || [];
  var controls = r.temporary_controls || [];
  var triggers = r.escalation_triggers || [];
  var conditions = r.conditions || [];

  return React.createElement("div", {
    style: { background: "#1a1a2e", border: "1px solid " + dispColor, borderRadius: "12px", padding: "20px", marginBottom: "16px", fontFamily: "'Inter', sans-serif" }
  },
    // Header
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "22px" } }, dispIcon),
        React.createElement("span", { style: { color: dispColor, fontSize: "14px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" as const } }, r.disposition.replace(/_/g, " "))
      ),
      React.createElement("span", { style: { color: "#64748b", fontSize: "11px", fontFamily: "monospace" } }, "ENGINE: disposition-pathway v1.0")
    ),

    // Urgency badge + interval
    React.createElement("div", { style: { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" as const } },
      React.createElement("span", { style: { fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "4px", background: urgColor + "20", color: urgColor, border: "1px solid " + urgColor + "40" } }, "URGENCY: " + r.urgency),
      r.interval && React.createElement("span", { style: { fontSize: "11px", fontWeight: "600", padding: "4px 12px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.2)" } }, "\u{1F4C5} " + r.interval)
    ),

    // Disposition basis
    React.createElement("div", { style: { padding: "12px 14px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "8px", marginBottom: "16px", borderLeft: "3px solid " + dispColor } },
      React.createElement("div", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, marginBottom: "4px" } }, "DISPOSITION BASIS"),
      React.createElement("div", { style: { color: "#cbd5e1", fontSize: "13px", lineHeight: "1.5" } }, r.disposition_basis)
    ),

    // Required Actions
    actions.length > 0 && React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "8px" } }, "REQUIRED ACTIONS (" + actions.length + ")"),
      actions.map(function(act: any, i: number) {
        var actUrgColor = act.timeframe === "IMMEDIATE" ? "#ef4444" : act.timeframe && act.timeframe.indexOf("24") >= 0 ? "#f59e0b" : "#3b82f6";
        return React.createElement("div", { key: "act-" + i, style: { display: "flex", gap: "12px", padding: "12px 14px", background: "rgba(30, 41, 59, 0.4)", borderRadius: "8px", marginBottom: "6px", borderLeft: "3px solid " + actUrgColor } },
          React.createElement("div", { style: { minWidth: "28px", height: "28px", borderRadius: "14px", background: actUrgColor + "20", color: actUrgColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px" } }, String(act.priority)),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", { style: { color: "#e2e8f0", fontSize: "13px", fontWeight: "700", marginBottom: "2px" } }, act.action),
            React.createElement("div", { style: { color: "#94a3b8", fontSize: "12px", lineHeight: "1.4", marginBottom: "4px" } }, act.detail),
            React.createElement("div", { style: { display: "flex", gap: "12px" } },
              React.createElement("span", { style: { color: "#64748b", fontSize: "10px" } }, "\u{1F464} " + act.who),
              React.createElement("span", { style: { color: actUrgColor, fontSize: "10px", fontWeight: "600" } }, "\u23F0 " + act.timeframe)
            )
          )
        );
      })
    ),

    // Temporary Controls
    controls.length > 0 && React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "8px" } }, "TEMPORARY CONTROLS"),
      controls.map(function(ctrl: string, i: number) {
        return React.createElement("div", { key: "ctrl-" + i, style: { padding: "8px 12px", background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "6px", marginBottom: "4px", fontSize: "12px", color: "#fbbf24" } }, "\u{1F6E1}\uFE0F " + ctrl);
      })
    ),

    // Escalation Triggers
    triggers.length > 0 && React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "8px" } }, "ESCALATION TRIGGERS"),
      triggers.map(function(trig: string, i: number) {
        return React.createElement("div", { key: "trig-" + i, style: { padding: "8px 12px", background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "6px", marginBottom: "4px", fontSize: "12px", color: "#fca5a5" } }, "\u26A0\uFE0F " + trig);
      })
    ),

    // Conditions
    conditions.length > 0 && React.createElement("details", { style: { marginTop: "8px" } },
      React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Conditions & Caveats (" + conditions.length + ")"),
      React.createElement("div", { style: { marginTop: "8px", padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
        conditions.map(function(cond: string, i: number) {
          return React.createElement("div", { key: "cond-" + i, style: { color: "#94a3b8", fontSize: "11px", padding: "3px 0" } }, "\u2022 " + cond);
        })
      )
    )
  );
}

export default DispositionPathwayCard;
