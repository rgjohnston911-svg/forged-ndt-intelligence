// @ts-nocheck
/**
 * DEPLOY215 - SimilarCasesPanel.tsx
 * src/components/SimilarCasesPanel.tsx
 *
 * Renders top-K similar locked cases for the current case. Pulls from
 * /api/similar-cases which wraps pgvector cosine similarity over the
 * case_embedding column.
 *
 * This is the user-facing surface of the "case library compounds"
 * pattern. Inspectors can see what prior cases look like this one and
 * how they were dispositioned, without the machine having to be
 * retrained. Every new locked case adds to the searchable library.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function pctFmt(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Math.round(Number(n) * 100) + "%";
}

function dispColor(d) {
  if (d === "reject") return "#ef4444";
  if (d === "review_required") return "#f59e0b";
  if (d === "accept") return "#22c55e";
  return "#8b949e";
}

export default function SimilarCasesPanel(props) {
  var caseId = props.caseId;
  var k = props.k || 5;
  var [neighbors, setNeighbors] = useState([]);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");
  var [ran, setRan] = useState(false);

  useEffect(function() { if (caseId) load(); }, [caseId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      var resp = await fetch("/api/similar-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, k: k })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) {
        setError(json.error || "Failed to load similar cases");
        setNeighbors([]);
      } else {
        setNeighbors(json.neighbors || []);
      }
    } catch (err) {
      setError("Network error: " + String(err));
    }
    setLoading(false);
    setRan(true);
  }

  return (
    <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Similar Prior Cases</h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{ padding: "4px 10px", fontSize: "11px", backgroundColor: loading ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Searching..." : "Refresh"}
        </button>
      </div>

      <div style={{ fontSize: "11px", color: "#8b949e", marginBottom: "10px" }}>
        Pattern-matched by component, material, findings, measurements, and disposition reasoning across your organization's case library.
      </div>

      {error && (
        <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "4px", color: "#fecaca", fontSize: "11px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {loading && <div style={{ color: "#8b949e", fontSize: "12px" }}>Searching case library...</div>}

      {!loading && ran && neighbors.length === 0 && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No similar prior cases found yet. This library grows as you lock more cases.
        </div>
      )}

      {neighbors.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {neighbors.map(function(n) {
            var sim = Number(n.similarity);
            var simPct = !isNaN(sim) ? Math.round(sim * 1000) / 10 : null;
            var color = dispColor(n.final_disposition);
            return (
              <Link
                key={n.id}
                to={"/cases/" + n.id}
                style={{ textDecoration: "none", display: "block" }}>
                <div style={{ padding: "10px 12px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ color: "#58a6ff", fontSize: "12px", fontWeight: 600 }}>{n.case_number}</span>
                      <span style={{ color: "#c9d1d9", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#8b949e" }}>
                      {n.component_name ? n.component_name + " \u00b7 " : ""}
                      {n.material_class ? String(n.material_class).replace(/_/g, " ") + " \u00b7 " : ""}
                      {n.method ? String(n.method).toUpperCase() : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {n.final_disposition && (
                      <div style={{ fontSize: "10px", color: color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {String(n.final_disposition).replace(/_/g, " ")}
                      </div>
                    )}
                    {simPct != null && (
                      <div style={{ fontSize: "11px", color: "#c9d1d9", marginTop: "2px" }}>{simPct}% match</div>
                    )}
                    {n.final_confidence != null && (
                      <div style={{ fontSize: "9px", color: "#8b949e" }}>conf {pctFmt(n.final_confidence)}</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
