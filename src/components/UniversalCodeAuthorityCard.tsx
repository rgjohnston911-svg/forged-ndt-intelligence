// @ts-nocheck
/**
 * DEPLOY222 - UniversalCodeAuthorityCard.tsx
 * src/components/UniversalCodeAuthorityCard.tsx
 *
 * Universal Code Authority Engine UI. Shows:
 *   - 5-tier precedence hierarchy with color-coded tiers
 *   - Governing code set (primary / supplementary / reference)
 *   - Applicable clauses per code
 *   - Conflict detection and resolution
 *   - Authority level banner (regulatory / jurisdictional / code_authoritative / provisional / advisory)
 *   - Resolution step trace
 *
 * var only. String concatenation only. No backticks.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var TIER_COLOR = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#2563eb",
  4: "#7c3aed",
  5: "#6b7280"
};

var TIER_BG = {
  1: "#dc262615",
  2: "#ea580c15",
  3: "#2563eb15",
  4: "#7c3aed15",
  5: "#6b728015"
};

var TIER_LABEL = {
  1: "REGULATORY",
  2: "JURISDICTIONAL",
  3: "INDUSTRY CODE",
  4: "OWNER SPEC",
  5: "BEST PRACTICE"
};

var AUTHORITY_CONFIG = {
  regulatory: { color: "#dc2626", bg: "#dc262622", label: "REGULATORY AUTHORITY", icon: "!!" },
  jurisdictional: { color: "#ea580c", bg: "#ea580c22", label: "JURISDICTIONAL LAW", icon: "!!" },
  code_authoritative: { color: "#2563eb", bg: "#2563eb22", label: "CODE AUTHORITATIVE", icon: "OK" },
  provisional: { color: "#f59e0b", bg: "#f59e0b22", label: "PROVISIONAL", icon: "?!" },
  advisory: { color: "#8b949e", bg: "#8b949e22", label: "ADVISORY", icon: "..." }
};

var ROLE_COLOR = {
  primary: "#22c55e",
  supplementary: "#3b82f6",
  reference: "#8b949e"
};

export default function UniversalCodeAuthorityCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [result, setResult] = useState(null);
  var [showClauses, setShowClauses] = useState(false);
  var [showConflicts, setShowConflicts] = useState(false);
  var [showSteps, setShowSteps] = useState(false);

  useEffect(function() { if (caseId) loadExisting(); }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("code_authority_result, code_authority_generated_at")
      .eq("id", caseId)
      .single();
    if (!res.error && res.data && res.data.code_authority_result) {
      setResult(res.data.code_authority_result);
    }
  }

  async function runAuthority() {
    setRunning(true); setError("");
    try {
      var resp = await fetch("/api/universal-code-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) { setError(json.error || "Code authority resolution failed"); }
      else { setResult(json.result); }
    } catch (e) { setError(String(e)); }
    setRunning(false);
  }

  // ---------- styles ----------
  var card = {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    fontFamily: "Inter, system-ui, sans-serif"
  };
  var header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  };
  var title = {
    fontSize: 15,
    fontWeight: 700,
    color: "#e6edf3",
    margin: 0
  };
  var badge = {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 4,
    letterSpacing: 1
  };
  var btn = {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  };
  var dimText = { fontSize: 12, color: "#8b949e" };

  // ---------- no result yet ----------
  if (!result) {
    return (
      <div style={card}>
        <div style={header}>
          <p style={title}>Universal Code Authority</p>
          <span style={Object.assign({}, badge, { background: "#30363d", color: "#8b949e" })}>DEPLOY222</span>
        </div>
        <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>
          Resolves which inspection codes govern this case using a 5-tier precedence hierarchy.
        </p>
        {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <button style={btn} onClick={runAuthority} disabled={running}>
          {running ? "Resolving..." : "Resolve Code Authority"}
        </button>
      </div>
    );
  }

  // ---------- authority level banner ----------
  var auth = result.authority_level || {};
  var ac = AUTHORITY_CONFIG[auth.level] || AUTHORITY_CONFIG.advisory;

  var governing = result.governing_codes || [];
  var clauses = result.applicable_clauses || [];
  var conflicts = result.conflicts || [];
  var hierarchy = result.precedence_hierarchy || [];
  var steps = result.resolution_steps || {};

  return (
    <div style={card}>
      {/* Header */}
      <div style={header}>
        <p style={title}>Universal Code Authority</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={Object.assign({}, badge, { background: "#238636", color: "#fff" })}>DETERMINISTIC</span>
          <span style={Object.assign({}, badge, { background: "#30363d", color: "#8b949e" })}>DEPLOY222</span>
        </div>
      </div>

      {/* Authority Level Banner */}
      <div style={{
        background: ac.bg,
        border: "1px solid " + ac.color,
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 8,
            background: ac.color + "33",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 14, color: ac.color
          }}>{ac.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: ac.color, letterSpacing: 1 }}>{ac.label}</div>
            <div style={{ fontSize: 12, color: "#c9d1d9", marginTop: 2 }}>{auth.reason}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#8b949e" }}>Highest Tier</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TIER_COLOR[result.highest_tier] || "#8b949e" }}>
            {result.highest_tier ? ("Tier " + result.highest_tier + " - " + (result.highest_tier_label || "")) : "None"}
          </div>
        </div>
      </div>

      {/* Governing Codes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8 }}>
          Governing Codes ({governing.length})
        </div>
        {governing.map(function(gc, gi) {
          var tc = TIER_COLOR[gc.tier] || "#8b949e";
          var tb = TIER_BG[gc.tier] || "#8b949e15";
          var rc = ROLE_COLOR[gc.role] || "#8b949e";
          return (
            <div key={gi} style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px",
                  borderRadius: 3, background: tb, color: tc, letterSpacing: 0.5
                }}>
                  {"T" + gc.tier}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>{gc.short_name || gc.code_id}</div>
                  <div style={{ fontSize: 11, color: "#8b949e" }}>{gc.name}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {gc.clause_count > 0 && (
                  <span style={{ fontSize: 11, color: "#8b949e" }}>
                    {gc.clause_count + " clause" + (gc.clause_count !== 1 ? "s" : "")}
                  </span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px",
                  borderRadius: 3, background: rc + "22", color: rc,
                  textTransform: "uppercase", letterSpacing: 0.5
                }}>
                  {gc.role}
                </span>
              </div>
            </div>
          );
        })}
        {governing.length === 0 && result.fallback && (
          <div style={{
            background: "#f59e0b15",
            border: "1px solid #f59e0b44",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 12,
            color: "#f59e0b"
          }}>
            {result.fallback.reason}
          </div>
        )}
      </div>

      {/* Applicable Clauses (expandable) */}
      {clauses.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8, cursor: "pointer" }}
            onClick={function() { setShowClauses(!showClauses); }}
          >
            {(showClauses ? "- " : "+ ") + "Applicable Clauses (" + clauses.length + ")"}
          </div>
          {showClauses && (
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#161b22" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Code</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Clause</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Title</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#8b949e", fontWeight: 600, borderBottom: "1px solid #21262d" }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {clauses.map(function(cl, ci) {
                    var rc2 = ROLE_COLOR[cl.role] || "#8b949e";
                    return (
                      <tr key={ci} style={{ borderBottom: "1px solid #21262d" }}>
                        <td style={{ padding: "6px 12px", color: "#c9d1d9", fontWeight: 600 }}>{cl.code_name}</td>
                        <td style={{ padding: "6px 12px", color: "#e6edf3", fontFamily: "monospace", fontSize: 11 }}>{cl.clause}</td>
                        <td style={{ padding: "6px 12px", color: "#c9d1d9" }}>{cl.title}</td>
                        <td style={{ padding: "6px 12px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 5px",
                            borderRadius: 3, background: rc2 + "22", color: rc2,
                            textTransform: "uppercase"
                          }}>{cl.role}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conflicts (expandable) */}
      {conflicts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 8, cursor: "pointer" }}
            onClick={function() { setShowConflicts(!showConflicts); }}
          >
            {(showConflicts ? "- " : "+ ") + "Tier Overlaps (" + conflicts.length + ")"}
          </div>
          {showConflicts && conflicts.map(function(cf, cfi) {
            return (
              <div key={cfi} style={{
                background: "#f59e0b11",
                border: "1px solid #f59e0b33",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 6,
                fontSize: 12,
                color: "#c9d1d9"
              }}>
                <div style={{ fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>
                  {"Tier " + cf.tier + " - " + cf.tier_label}
                </div>
                <div>{cf.explanation}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#8b949e" }}>
                  {"Resolution: " + cf.resolution}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Precedence Hierarchy */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8 }}>
          Precedence Hierarchy
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {hierarchy.map(function(h, hi) {
            var tc2 = TIER_COLOR[h.tier] || "#8b949e";
            var tb2 = TIER_BG[h.tier] || "#8b949e15";
            return (
              <div key={hi} style={{
                background: tb2,
                border: "1px solid " + tc2 + "44",
                borderRadius: 6,
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: tc2 }}>{"T" + h.tier}</span>
                <span style={{ fontSize: 12, color: "#e6edf3", fontWeight: 500 }}>{h.short_name}</span>
              </div>
            );
          })}
          {hierarchy.length === 0 && (
            <span style={{ fontSize: 12, color: "#8b949e" }}>No codes matched</span>
          )}
        </div>
      </div>

      {/* Resolution Steps (expandable) */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8, cursor: "pointer" }}
          onClick={function() { setShowSteps(!showSteps); }}
        >
          {(showSteps ? "- " : "+ ") + "Resolution Trace"}
        </div>
        {showSteps && (
          <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 12 }}>
            {Object.keys(steps).map(function(sk, si) {
              return (
                <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#238636", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, flexShrink: 0
                  }}>{si + 1}</span>
                  <span style={{ color: "#c9d1d9" }}>{steps[sk]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {result.summary && (
        <div style={{
          background: "#0d1117",
          border: "1px solid #21262d",
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
          fontSize: 12,
          color: "#c9d1d9",
          lineHeight: 1.5
        }}>
          {result.summary}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={dimText}>
          {result.generated_at ? ("Generated " + new Date(result.generated_at).toLocaleString()) : ""}
        </span>
        <button
          style={Object.assign({}, btn, { background: "#30363d", fontSize: 12, padding: "6px 12px" })}
          onClick={runAuthority}
          disabled={running}
        >
          {running ? "Resolving..." : "Re-run"}
        </button>
      </div>
    </div>
  );
}
