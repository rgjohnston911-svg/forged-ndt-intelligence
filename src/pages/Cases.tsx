import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sbSelect } from "../utils/supabase";

interface CaseRow {
  id: string;
  case_id: string;
  case_name: string;
  title: string;
  asset_name: string;
  asset_type: string;
  asset_class: string;
  location: string;
  status: string;
  stage: string;
  // Original superbrain columns
  consequence_tier: string;
  superbrain_disposition: string;
  confidence_overall: number;
  confidence_band: string;
  primary_mechanism: string;
  sufficiency_verdict: string;
  hard_lock_count: number;
  next_action: string;
  // sb_* columns (fallback)
  sb_consequence: string;
  sb_disposition: string;
  sb_confidence: number;
  sb_mechanism: string;
  // Meta
  created_at: string;
  updated_at: string;
}

export default function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => { loadCases(); }, []);

  async function loadCases() {
    try {
      setLoading(true);
      setError("");
      const rows = await sbSelect("cases", "order=updated_at.desc&limit=100");
      setCases(rows as CaseRow[]);
    } catch (err: any) {
      setError("Failed to load cases: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  // Read helpers — original columns first, fallback to sb_*
  function getConsequence(c: CaseRow): string { return c.consequence_tier || c.sb_consequence || ""; }
  function getDisposition(c: CaseRow): string { return c.superbrain_disposition || c.sb_disposition || ""; }
  function getConfidence(c: CaseRow): number | null {
    if (c.confidence_overall != null && c.confidence_overall > 0) return c.confidence_overall;
    if (c.sb_confidence != null && c.sb_confidence > 0) return c.sb_confidence;
    return null;
  }
  function getMechanism(c: CaseRow): string { return c.primary_mechanism || c.sb_mechanism || ""; }
  function getTitle(c: CaseRow): string { return c.title || c.case_name || "Untitled Case"; }
  function getAssetInfo(c: CaseRow): string {
    return [c.asset_name, c.asset_type || c.asset_class].filter(Boolean).join(" · ");
  }

  const totalCases = cases.length;
  const criticalCases = cases.filter(c => getConsequence(c) === "CRITICAL").length;
  const holdCases = cases.filter(c => { const d = getDisposition(c); return d === "BLOCKED" || d === "HOLD" || d === "hold_for_review"; }).length;
  const goCases = cases.filter(c => { const d = getDisposition(c); return d === "GO" || d === "CONDITIONAL_GO"; }).length;

  let filteredCases = cases;
  if (filterStatus === "critical") filteredCases = cases.filter(c => getConsequence(c) === "CRITICAL");
  else if (filterStatus === "blocked") filteredCases = cases.filter(c => { const d = getDisposition(c); return d === "BLOCKED" || d === "HOLD" || d === "hold_for_review"; });
  else if (filterStatus === "go") filteredCases = cases.filter(c => { const d = getDisposition(c); return d === "GO" || d === "CONDITIONAL_GO"; });

  function consequenceColor(consequence: string): string {
    if (consequence === "CRITICAL") return "#ef4444";
    if (consequence === "HIGH") return "#f97316";
    if (consequence === "MODERATE" || consequence === "MEDIUM") return "#eab308";
    return "#22c55e";
  }

  function dispositionColor(disposition: string): string {
    if (disposition === "BLOCKED") return "#ef4444";
    if (disposition === "HOLD" || disposition === "hold_for_review") return "#f97316";
    if (disposition === "CONDITIONAL_GO") return "#eab308";
    if (disposition === "GO") return "#22c55e";
    return "#6b7280";
  }

  function formatDate(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", color: "#e2e8f0" }}>
      <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>Loading cases...</div>
    </div>;
  }

  if (error) {
    return <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", color: "#e2e8f0" }}>
      <div style={{ textAlign: "center", padding: "40px", color: "#ef4444", backgroundColor: "#1e293b", borderRadius: "12px" }}>
        <div style={{ marginBottom: "12px" }}>{error}</div>
        <button onClick={loadCases} style={{ padding: "8px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Retry</button>
      </div>
    </div>;
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>NDT Case Manager</h1>
        <button onClick={() => navigate("/cases/new")}
          style={{ padding: "10px 24px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
          + New Case
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Cases", value: totalCases, color: "#3b82f6", filter: "all" },
          { label: "Critical", value: criticalCases, color: "#ef4444", filter: "critical" },
          { label: "Hold / Blocked", value: holdCases, color: "#f97316", filter: "blocked" },
          { label: "Go", value: goCases, color: "#22c55e", filter: "go" },
        ].map(kpi => (
          <div key={kpi.label}
            onClick={() => setFilterStatus(filterStatus === kpi.filter ? "all" : kpi.filter)}
            style={{
              backgroundColor: filterStatus === kpi.filter ? "#1e293b" : "#0f172a",
              border: `1px solid ${filterStatus === kpi.filter ? kpi.color : "#1e293b"}`,
              borderRadius: "12px", padding: "20px", cursor: "pointer", textAlign: "center", transition: "all 0.2s"
            }}>
            <div style={{ fontSize: "36px", fontWeight: "700", color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Case List */}
      <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 1.2fr",
          padding: "12px 16px", backgroundColor: "#1e293b",
          fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px"
        }}>
          <div>Case / Asset</div>
          <div>Mechanism</div>
          <div>Consequence</div>
          <div>Disposition</div>
          <div>Confidence</div>
          <div>Updated</div>
        </div>

        {filteredCases.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>No cases found.</div>
        ) : filteredCases.map(c => {
          const consequence = getConsequence(c);
          const disposition = getDisposition(c);
          const confidence = getConfidence(c);
          const mechanism = getMechanism(c);

          return (
            <div key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
              style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr 1.2fr", padding: "14px 16px", borderTop: "1px solid #1e293b", cursor: "pointer", alignItems: "center" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1e293b")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>

              <div>
                <div style={{ fontWeight: "600", fontSize: "14px", color: "#f8fafc" }}>{getTitle(c)}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{getAssetInfo(c)}</div>
              </div>

              <div style={{ fontSize: "13px", color: "#cbd5e1" }}>{(mechanism || "—").replace(/_/g, " ")}</div>

              <div>
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: "700",
                  backgroundColor: consequenceColor(consequence) + "22", color: consequenceColor(consequence),
                  border: `1px solid ${consequenceColor(consequence)}44`
                }}>{consequence || "—"}</span>
              </div>

              <div>
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: "700",
                  backgroundColor: dispositionColor(disposition) + "22", color: dispositionColor(disposition),
                  border: `1px solid ${dispositionColor(disposition)}44`
                }}>{(disposition || "—").replace(/_/g, " ")}</span>
              </div>

              <div>
                {confidence != null ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "80px", height: "8px", backgroundColor: "#1e293b", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round(confidence * 100)}%`, height: "100%", backgroundColor: confidence >= 0.8 ? "#22c55e" : confidence >= 0.6 ? "#eab308" : "#ef4444", borderRadius: "4px" }} />
                    </div>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>{Math.round(confidence * 100)}%</span>
                  </div>
                ) : <span style={{ color: "#64748b" }}>—</span>}
              </div>

              <div style={{ fontSize: "12px", color: "#64748b" }}>{formatDate(c.updated_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
