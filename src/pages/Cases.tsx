/**
 * DEPLOY209 — Cases.tsx
 * Reads from the `inspection_cases` table (the canonical table used by
 * CaseDetail, Dashboard, and every netlify function). Previously read from
 * a legacy `cases` table that had drifted out of sync.
 *
 * CONSTRAINTS: var only, no template literals, @ts-nocheck friendly.
 */
// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import MethodBadge from "../components/MethodBadge";

export default function Cases() {
  var navigate = useNavigate();
  var auth = useAuth();
  var profile = auth && auth.profile;
  var [cases, setCases] = useState([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState("");
  var [filterStatus, setFilterStatus] = useState("all");

  useEffect(function() {
    if (!profile || !profile.org_id) { setLoading(false); return; }
    loadCases();
  }, [profile && profile.org_id]);

  async function loadCases() {
    try {
      setLoading(true);
      setError("");
      var res = await supabase
        .from("inspection_cases")
        .select("id, case_number, title, method, status, component_name, asset_type, final_disposition, final_confidence, created_at, updated_at")
        .eq("org_id", profile.org_id)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (res.error) throw res.error;
      setCases(res.data || []);
    } catch (err) {
      setError("Failed to load cases: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  var totalCases = cases.length;
  var holdCases = cases.filter(function(c) {
    var d = (c.final_disposition || "").toUpperCase();
    return d === "BLOCKED" || d === "HOLD" || d === "REJECT";
  }).length;
  var goCases = cases.filter(function(c) {
    var d = (c.final_disposition || "").toUpperCase();
    return d === "GO" || d === "CONDITIONAL_GO" || d === "ACCEPT";
  }).length;
  var openCases = cases.filter(function(c) { return (c.status || "") !== "closed"; }).length;

  var filteredCases = cases;
  if (filterStatus === "hold") {
    filteredCases = cases.filter(function(c) {
      var d = (c.final_disposition || "").toUpperCase();
      return d === "BLOCKED" || d === "HOLD" || d === "REJECT";
    });
  } else if (filterStatus === "go") {
    filteredCases = cases.filter(function(c) {
      var d = (c.final_disposition || "").toUpperCase();
      return d === "GO" || d === "CONDITIONAL_GO" || d === "ACCEPT";
    });
  } else if (filterStatus === "open") {
    filteredCases = cases.filter(function(c) { return (c.status || "") !== "closed"; });
  }

  function dispositionColor(disposition) {
    var d = (disposition || "").toUpperCase();
    if (d === "BLOCKED" || d === "REJECT") return "#ef4444";
    if (d === "HOLD") return "#f97316";
    if (d === "CONDITIONAL_GO") return "#eab308";
    if (d === "GO" || d === "ACCEPT") return "#22c55e";
    return "#6b7280";
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", color: "#e2e8f0" }}>
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>Loading cases...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", color: "#e2e8f0" }}>
        <div style={{ textAlign: "center", padding: "40px", color: "#ef4444", backgroundColor: "#1e293b", borderRadius: "12px" }}>
          <div style={{ marginBottom: "12px" }}>{error}</div>
          <button onClick={loadCases} style={{ padding: "8px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Retry</button>
        </div>
      </div>
    );
  }

  var KPI = [
    { label: "Total Cases", value: totalCases, color: "#3b82f6", filter: "all" },
    { label: "Open", value: openCases, color: "#eab308", filter: "open" },
    { label: "Hold / Blocked", value: holdCases, color: "#f97316", filter: "hold" },
    { label: "Go / Accept", value: goCases, color: "#22c55e", filter: "go" }
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>NDT Case Manager</h1>
        <button
          onClick={function() { navigate("/cases/new"); }}
          style={{ padding: "10px 24px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}
        >
          + New Case
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {KPI.map(function(kpi) {
          var active = filterStatus === kpi.filter;
          return (
            <div
              key={kpi.label}
              onClick={function() { setFilterStatus(active ? "all" : kpi.filter); }}
              style={{
                backgroundColor: active ? "#1e293b" : "#0f172a",
                border: "1px solid " + (active ? kpi.color : "#1e293b"),
                borderRadius: "12px", padding: "20px", cursor: "pointer", textAlign: "center", transition: "all 0.2s"
              }}
            >
              <div style={{ fontSize: "36px", fontWeight: "700", color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.4fr 2fr 0.8fr 1fr 1fr 1fr 1.2fr",
          padding: "12px 16px", backgroundColor: "#1e293b",
          fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px"
        }}>
          <div>Case #</div>
          <div>Title / Component</div>
          <div>Method</div>
          <div>Status</div>
          <div>Disposition</div>
          <div>Confidence</div>
          <div>Updated</div>
        </div>

        {filteredCases.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>No cases found.</div>
        ) : (
          filteredCases.map(function(c) {
            return (
              <div
                key={c.id}
                onClick={function() { navigate("/cases/" + c.id); }}
                style={{
                  display: "grid", gridTemplateColumns: "1.4fr 2fr 0.8fr 1fr 1fr 1fr 1.2fr",
                  padding: "14px 16px", borderTop: "1px solid #1e293b", cursor: "pointer", alignItems: "center"
                }}
                onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = "#1e293b"; }}
                onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div style={{ fontSize: "13px", color: "#cbd5e1", fontFamily: "monospace" }}>{c.case_number || c.id.slice(0, 8)}</div>

                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#f8fafc" }}>{c.title || "Untitled Case"}</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {[c.component_name, c.asset_type].filter(Boolean).join(" \u00b7 ")}
                  </div>
                </div>

                <div><MethodBadge method={c.method} size="sm" /></div>

                <div style={{ fontSize: "12px", color: "#cbd5e1" }}>{(c.status || "\u2014").replace(/_/g, " ")}</div>

                <div>
                  <span style={{
                    display: "inline-block", padding: "3px 10px", borderRadius: "4px",
                    fontSize: "11px", fontWeight: "700",
                    backgroundColor: dispositionColor(c.final_disposition) + "22",
                    color: dispositionColor(c.final_disposition),
                    border: "1px solid " + dispositionColor(c.final_disposition) + "44"
                  }}>{(c.final_disposition || "\u2014").replace(/_/g, " ")}</span>
                </div>

                <div>
                  {c.final_confidence != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "80px", height: "8px", backgroundColor: "#1e293b", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: Math.round(c.final_confidence * 100) + "%", height: "100%",
                          backgroundColor: c.final_confidence >= 0.8 ? "#22c55e" : c.final_confidence >= 0.6 ? "#eab308" : "#ef4444",
                          borderRadius: "4px"
                        }} />
                      </div>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{Math.round(c.final_confidence * 100)}%</span>
                    </div>
                  ) : <span style={{ color: "#64748b" }}>\u2014</span>}
                </div>

                <div style={{ fontSize: "12px", color: "#64748b" }}>{formatDate(c.updated_at)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
