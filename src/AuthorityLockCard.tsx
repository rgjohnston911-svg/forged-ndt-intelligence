import React from "react";

interface AuthorityCode {
  code: string;
  title: string;
  role: string;
  locked: boolean;
}

interface AuthorityLockResult {
  status: string;
  confidence: string;
  authority_chain: AuthorityCode[];
  supplemental_codes: AuthorityCode[];
  all_codes: string[];
  lock_reasons: string[];
  trigger_b31g: boolean;
  trigger_crack_assessment: boolean;
  trigger_sour_service: boolean;
  metadata: any;
}

interface AuthorityLockCardProps {
  result: AuthorityLockResult | null;
}

var roleLabels: Record<string, string> = {
  primary_construction: "Construction Code",
  inspection_authority: "Inspection Code",
  fitness_for_service: "FFS Authority",
  material_suitability: "Material Standard",
  design_authority: "Design Code",
  remaining_strength: "Remaining Strength",
  crack_assessment: "Crack Assessment",
  general_metal_loss: "Metal Loss (General)",
  local_metal_loss: "Metal Loss (Local)",
  supplemental_inspection: "Supplemental"
};

function AuthorityLockCard(props: AuthorityLockCardProps) {
  if (!props.result) return null;
  var r = props.result;

  var statusColor = r.status === "LOCKED" ? "#10b981" : r.status === "PARTIAL" ? "#f59e0b" : "#ef4444";
  var statusIcon = r.status === "LOCKED" ? "\u{1F512}" : r.status === "PARTIAL" ? "\u26A0\uFE0F" : "\u274C";
  var statusLabel = r.status === "LOCKED" ? "AUTHORITY LOCKED" : r.status === "PARTIAL" ? "PARTIAL" : "UNRESOLVED";

  return React.createElement("div", {
    style: { background: "#1a1a2e", border: "1px solid " + statusColor, borderRadius: "12px", padding: "20px", marginBottom: "16px", fontFamily: "'Inter', sans-serif" }
  },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        React.createElement("span", { style: { fontSize: "20px" } }, statusIcon),
        React.createElement("span", { style: { color: statusColor, fontSize: "14px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase" as const } }, statusLabel)
      ),
      React.createElement("span", { style: { color: "#64748b", fontSize: "11px", fontFamily: "monospace" } }, "ENGINE: authority-lock v1.0")
    ),
    React.createElement("h3", { style: { color: "#e2e8f0", fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" } }, "Governing Authority Chain"),

    r.authority_chain.length > 0 && React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "8px" } }, "PRIMARY AUTHORITIES"),
      r.authority_chain.map(function(auth, i) {
        return React.createElement("div", { key: "auth-" + i, style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", marginBottom: "6px" } },
          React.createElement("div", null,
            React.createElement("div", { style: { color: "#10b981", fontSize: "14px", fontWeight: "700", fontFamily: "monospace" } }, auth.code),
            React.createElement("div", { style: { color: "#94a3b8", fontSize: "12px", marginTop: "2px" } }, auth.title)
          ),
          React.createElement("span", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, background: "rgba(100, 116, 139, 0.15)", padding: "3px 8px", borderRadius: "4px" } }, roleLabels[auth.role] || auth.role)
        );
      })
    ),

    r.supplemental_codes.length > 0 && React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "8px" } }, "SUPPLEMENTAL / DAMAGE-SPECIFIC"),
      r.supplemental_codes.map(function(sup, i) {
        return React.createElement("div", { key: "sup-" + i, style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "8px", marginBottom: "6px" } },
          React.createElement("div", null,
            React.createElement("div", { style: { color: "#f59e0b", fontSize: "13px", fontWeight: "600", fontFamily: "monospace" } }, sup.code),
            React.createElement("div", { style: { color: "#94a3b8", fontSize: "11px", marginTop: "2px" } }, sup.title)
          ),
          React.createElement("span", { style: { color: "#64748b", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" as const, background: "rgba(100, 116, 139, 0.15)", padding: "3px 8px", borderRadius: "4px" } }, roleLabels[sup.role] || sup.role)
        );
      })
    ),

    (r.trigger_b31g || r.trigger_crack_assessment || r.trigger_sour_service) &&
    React.createElement("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" as const, marginBottom: "16px" } },
      r.trigger_b31g && React.createElement("span", { style: { background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "4px", border: "1px solid rgba(239, 68, 68, 0.3)" } }, "\u26A1 B31G CALCULATION TRIGGERED"),
      r.trigger_crack_assessment && React.createElement("span", { style: { background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "4px", border: "1px solid rgba(168, 85, 247, 0.3)" } }, "\u{1F50D} CRACK ASSESSMENT REQUIRED"),
      r.trigger_sour_service && React.createElement("span", { style: { background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "4px", border: "1px solid rgba(245, 158, 11, 0.3)" } }, "\u2622\uFE0F SOUR SERVICE LOCKED")
    ),

    r.lock_reasons.length > 0 && React.createElement("details", { style: { marginTop: "8px" } },
      React.createElement("summary", { style: { color: "#64748b", fontSize: "12px", cursor: "pointer", userSelect: "none" as const } }, "Lock Resolution Trail (" + r.lock_reasons.length + " rules applied)"),
      React.createElement("div", { style: { marginTop: "8px", padding: "10px", background: "rgba(30, 41, 59, 0.5)", borderRadius: "6px" } },
        r.lock_reasons.map(function(reason, i) {
          return React.createElement("div", { key: "reason-" + i, style: { color: "#94a3b8", fontSize: "11px", fontFamily: "monospace", padding: "3px 0", borderBottom: i < r.lock_reasons.length - 1 ? "1px solid rgba(51, 65, 85, 0.3)" : "none" } }, "\u2192 " + reason);
        })
      )
    )
  );
}

export default AuthorityLockCard;
