import React, { useState, useEffect } from "react";
import { sbSelect } from "../utils/supabase";

// ============================================================================
// CASES DASHBOARD — KPI Cards + Case List
// ============================================================================

interface CaseRow {
  id: string;
  title: string;
  asset_name: string;
  asset_class: string;
  status: string;
  sb_consequence: string;
  sb_disposition: string;
  sb_confidence: number;
  sb_mechanism: string;
  created_at: string;
  updated_at: string;
  campaign_id?: string;
}

interface CasesDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export default function CasesDashboard({ onNavigate }: CasesDashboardProps) {
  var [cases, setCases] = useState<CaseRow[]>([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState("");
  var [filterStatus, setFilterStatus] = useState("all");

  useEffect(function () {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      setLoading(true);
      setError("");
      var rows = await sbSelect("cases", "order=updated_at.desc&limit=100");
      setCases(rows as CaseRow[]);
    } catch (err: any) {
      setError("Failed to load cases: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  // KPI calculations
  var totalCases = cases.length;
  var criticalCases = cases.filter(function (c) { return c.sb_consequence === "CRITICAL"; }).length;
  var holdCases = cases.filter(function (c) {
    return c.sb_disposition === "BLOCKED" || c.sb_disposition === "HOLD";
  }).length;
  var goCases = cases.filter(function (c) {
    return c.sb_disposition === "GO" || c.sb_disposition === "CONDITIONAL_GO";
  }).length;

  // Filtered list
  var filteredCases = cases;
  if (filterStatus === "critical") {
    filteredCases = cases.filter(function (c) { return c.sb_consequence === "CRITICAL"; });
  } else if (filterStatus === "blocked") {
    filteredCases = cases.filter(function (c) {
      return c.sb_disposition === "BLOCKED" || c.sb_disposition === "HOLD";
    });
  } else if (filterStatus === "go") {
    filteredCases = cases.filter(function (c) {
      return c.sb_disposition === "GO" || c.sb_disposition === "CONDITIONAL_GO";
    });
  }

  function consequenceColor(consequence: string): string {
    if (consequence === "CRITICAL") return "#ef4444";
    if (consequence === "HIGH") return "#f97316";
    if (consequence === "MODERATE") return "#eab308";
    return "#22c55e";
  }

  function dispositionColor(disposition: string): string {
    if (disposition === "BLOCKED") return "#ef4444";
    if (disposition === "HOLD") return "#f97316";
    if (disposition === "CONDITIONAL_GO") return "#eab308";
    if (disposition === "GO") return "#22c55e";
    return "#6b7280";
  }

  function confidenceBar(confidence: number): React.ReactElement {
    var pct = Math.round(confidence * 100);
    var color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#eab308" : "#ef4444";
    return React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: "8px" }
    },
      React.createElement("div", {
        style: {
          width: "80px", height: "8px", backgroundColor: "#1e293b",
          borderRadius: "4px", overflow: "hidden"
        }
      },
        React.createElement("div", {
          style: {
            width: pct + "%", height: "100%",
            backgroundColor: color, borderRadius: "4px"
          }
        })
      ),
      React.createElement("span", {
        style: { fontSize: "12px", color: "#94a3b8" }
      }, pct + "%")
    );
  }

  function formatDate(iso: string): string {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ── RENDER ──

  var containerStyle: React.CSSProperties = {
    padding: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#e2e8f0"
  };

  var kpiRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "24px"
  };

  function kpiCard(label: string, value: number, color: string, filter: string) {
    var isActive = filterStatus === filter;
    return React.createElement("div", {
      key: label,
      onClick: function () { setFilterStatus(isActive ? "all" : filter); },
      style: {
        backgroundColor: isActive ? "#1e293b" : "#0f172a",
        border: "1px solid " + (isActive ? color : "#1e293b"),
        borderRadius: "12px",
        padding: "20px",
        cursor: "pointer",
        textAlign: "center" as const,
        transition: "all 0.2s"
      }
    },
      React.createElement("div", {
        style: { fontSize: "36px", fontWeight: "700", color: color }
      }, String(value)),
      React.createElement("div", {
        style: { fontSize: "13px", color: "#94a3b8", marginTop: "4px", textTransform: "uppercase" as const, letterSpacing: "1px" }
      }, label)
    );
  }

  if (loading) {
    return React.createElement("div", { style: containerStyle },
      React.createElement("div", { style: { textAlign: "center", padding: "60px", color: "#94a3b8" } },
        "Loading cases..."
      )
    );
  }

  if (error) {
    return React.createElement("div", { style: containerStyle },
      React.createElement("div", {
        style: { textAlign: "center", padding: "40px", color: "#ef4444", backgroundColor: "#1e293b", borderRadius: "12px" }
      },
        React.createElement("div", { style: { marginBottom: "12px" } }, error),
        React.createElement("button", {
          onClick: loadCases,
          style: {
            padding: "8px 20px", backgroundColor: "#3b82f6", color: "#fff",
            border: "none", borderRadius: "6px", cursor: "pointer"
          }
        }, "Retry")
      )
    );
  }

  return React.createElement("div", { style: containerStyle },

    // Header row
    React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }
    },
      React.createElement("h1", {
        style: { fontSize: "24px", fontWeight: "700", color: "#f8fafc", margin: 0 }
      }, "NDT Case Manager"),
      React.createElement("button", {
        onClick: function () { onNavigate("create-case"); },
        style: {
          padding: "10px 24px", backgroundColor: "#3b82f6", color: "#fff",
          border: "none", borderRadius: "8px", cursor: "pointer",
          fontSize: "14px", fontWeight: "600"
        }
      }, "+ New Case")
    ),

    // KPI cards
    React.createElement("div", { style: kpiRowStyle },
      kpiCard("Total Cases", totalCases, "#3b82f6", "all"),
      kpiCard("Critical", criticalCases, "#ef4444", "critical"),
      kpiCard("Hold / Blocked", holdCases, "#f97316", "blocked"),
      kpiCard("Go", goCases, "#22c55e", "go")
    ),

    // Case list
    React.createElement("div", {
      style: {
        backgroundColor: "#0f172a", border: "1px solid #1e293b",
        borderRadius: "12px", overflow: "hidden"
      }
    },
      // Table header
      React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 1.2fr",
          padding: "12px 16px",
          backgroundColor: "#1e293b",
          fontSize: "11px",
          fontWeight: "600",
          color: "#94a3b8",
          textTransform: "uppercase" as const,
          letterSpacing: "1px"
        }
      },
        React.createElement("div", null, "Case / Asset"),
        React.createElement("div", null, "Mechanism"),
        React.createElement("div", null, "Consequence"),
        React.createElement("div", null, "Disposition"),
        React.createElement("div", null, "Confidence"),
        React.createElement("div", null, "Updated")
      ),

      // Rows
      filteredCases.length === 0
        ? React.createElement("div", {
          style: { padding: "40px", textAlign: "center", color: "#64748b" }
        }, "No cases found.")
        : filteredCases.map(function (c) {
          return React.createElement("div", {
            key: c.id,
            onClick: function () { onNavigate("case-detail", { caseId: c.id }); },
            style: {
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 1.2fr",
              padding: "14px 16px",
              borderTop: "1px solid #1e293b",
              cursor: "pointer",
              alignItems: "center",
              transition: "background 0.15s"
            },
            onMouseEnter: function (e: any) { e.currentTarget.style.backgroundColor = "#1e293b"; },
            onMouseLeave: function (e: any) { e.currentTarget.style.backgroundColor = "transparent"; }
          },
            // Title + asset
            React.createElement("div", null,
              React.createElement("div", { style: { fontWeight: "600", fontSize: "14px", color: "#f8fafc" } },
                c.title || "Untitled Case"
              ),
              React.createElement("div", { style: { fontSize: "12px", color: "#64748b", marginTop: "2px" } },
                (c.asset_name || "") + (c.asset_class ? " · " + c.asset_class : "")
              )
            ),
            // Mechanism
            React.createElement("div", { style: { fontSize: "13px", color: "#cbd5e1" } },
              (c.sb_mechanism || "—").replace(/_/g, " ")
            ),
            // Consequence badge
            React.createElement("div", null,
              React.createElement("span", {
                style: {
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "700",
                  backgroundColor: consequenceColor(c.sb_consequence) + "22",
                  color: consequenceColor(c.sb_consequence),
                  border: "1px solid " + consequenceColor(c.sb_consequence) + "44"
                }
              }, c.sb_consequence || "—")
            ),
            // Disposition badge
            React.createElement("div", null,
              React.createElement("span", {
                style: {
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "700",
                  backgroundColor: dispositionColor(c.sb_disposition) + "22",
                  color: dispositionColor(c.sb_disposition),
                  border: "1px solid " + dispositionColor(c.sb_disposition) + "44"
                }
              }, (c.sb_disposition || "—").replace(/_/g, " "))
            ),
            // Confidence bar
            React.createElement("div", null,
              c.sb_confidence != null ? confidenceBar(c.sb_confidence) : React.createElement("span", { style: { color: "#64748b" } }, "—")
            ),
            // Date
            React.createElement("div", { style: { fontSize: "12px", color: "#64748b" } },
              formatDate(c.updated_at)
            )
          );
        })
    )
  );
}
