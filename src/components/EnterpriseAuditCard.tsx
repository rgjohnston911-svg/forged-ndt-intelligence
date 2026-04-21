// @ts-nocheck
/**
 * DEPLOY223 - EnterpriseAuditCard.tsx
 * src/components/EnterpriseAuditCard.tsx
 *
 * Enterprise Audit Trail UI. Shows:
 *   - Audit timeline (who did what, when)
 *   - Signed bundle chain with hash verification
 *   - Chain integrity status (valid / broken)
 *   - Sign new bundle button
 *   - Verify chain button
 *   - Actor summary (unique users + action counts)
 *
 * var only. String concatenation only. No backticks.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

var ACTOR_COLOR = {
  user: "#3b82f6",
  system: "#8b949e"
};

var CATEGORY_COLOR = {
  case_lifecycle: "#a78bfa",
  evidence: "#f59e0b",
  findings: "#ea580c",
  decision: "#22c55e",
  prediction: "#06b6d4",
  material: "#ec4899",
  repair: "#14b8a6",
  analysis: "#6366f1",
  planning: "#8b5cf6",
  audit: "#eab308",
  adjudication: "#f43f5e",
  custom: "#8b949e"
};

var CHAIN_STATUS = {
  valid: { color: "#22c55e", bg: "#22c55e22", label: "CHAIN VALID", icon: "OK" },
  broken: { color: "#ef4444", bg: "#ef444422", label: "CHAIN BROKEN", icon: "!!" },
  empty: { color: "#8b949e", bg: "#8b949e22", label: "NO BUNDLES", icon: "..." },
  unverified: { color: "#f59e0b", bg: "#f59e0b22", label: "UNVERIFIED", icon: "?" }
};

export default function EnterpriseAuditCard(props) {
  var caseId = props.caseId;
  var [loading, setLoading] = useState(false);
  var [signing, setSigning] = useState(false);
  var [verifying, setVerifying] = useState(false);
  var [error, setError] = useState("");
  var [history, setHistory] = useState(null);
  var [verifyResult, setVerifyResult] = useState(null);
  var [showTimeline, setShowTimeline] = useState(false);
  var [showBundles, setShowBundles] = useState(false);
  var [showVerify, setShowVerify] = useState(false);

  useEffect(function() { if (caseId) loadHistory(); }, [caseId]);

  async function loadHistory() {
    setLoading(true);
    try {
      var resp = await fetch("/api/enterprise-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_history", case_id: caseId })
      });
      var json = await resp.json();
      if (json.success) setHistory(json);
      else setError(json.error || "Failed to load audit history");
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  async function signNewBundle() {
    setSigning(true); setError("");
    try {
      var session = await supabase.auth.getSession();
      var token = (session.data && session.data.session && session.data.session.access_token) || "";
      var resp = await fetch("/api/enterprise-audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ action: "sign_bundle", case_id: caseId })
      });
      var json = await resp.json();
      if (json.success) { await loadHistory(); setVerifyResult(null); }
      else setError(json.error || "Failed to sign bundle");
    } catch (e) { setError(String(e)); }
    setSigning(false);
  }

  async function verifyChain() {
    setVerifying(true); setError("");
    try {
      var resp = await fetch("/api/verify-audit-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var json = await resp.json();
      if (json.success) { setVerifyResult(json); setShowVerify(true); }
      else setError(json.error || "Verification failed");
    } catch (e) { setError(String(e)); }
    setVerifying(false);
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
  var title = { fontSize: 15, fontWeight: 700, color: "#e6edf3", margin: 0 };
  var badge = { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, letterSpacing: 1 };
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
  var btnSecondary = {
    background: "#30363d",
    color: "#c9d1d9",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  };
  var dimText = { fontSize: 12, color: "#8b949e" };

  // ---------- loading state ----------
  if (loading) {
    return (
      <div style={card}>
        <div style={header}>
          <p style={title}>Enterprise Audit Trail</p>
          <span style={Object.assign({}, badge, { background: "#30363d", color: "#8b949e" })}>DEPLOY223</span>
        </div>
        <p style={dimText}>Loading audit history...</p>
      </div>
    );
  }

  // ---------- no history yet ----------
  if (!history) {
    return (
      <div style={card}>
        <div style={header}>
          <p style={title}>Enterprise Audit Trail</p>
          <span style={Object.assign({}, badge, { background: "#30363d", color: "#8b949e" })}>DEPLOY223</span>
        </div>
        <p style={{ color: "#8b949e", fontSize: 13, marginBottom: 12 }}>
          Tamper-proof audit trail with cryptographic signing, hash chains, and full replay snapshots.
        </p>
        {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={signNewBundle} disabled={signing}>
            {signing ? "Signing..." : "Sign Audit Bundle"}
          </button>
          <button style={btnSecondary} onClick={loadHistory}>Load History</button>
        </div>
      </div>
    );
  }

  // ---------- main render ----------
  var summary = history.summary || {};
  var timeline = history.timeline || [];
  var bundles = history.bundles || [];
  var actors = summary.actors || [];

  // Chain status
  var chainStatus = "unverified";
  if (bundles.length === 0) chainStatus = "empty";
  else if (verifyResult) chainStatus = verifyResult.chain_valid ? "valid" : "broken";
  var cs = CHAIN_STATUS[chainStatus];

  return (
    <div style={card}>
      {/* Header */}
      <div style={header}>
        <p style={title}>Enterprise Audit Trail</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={Object.assign({}, badge, { background: "#238636", color: "#fff" })}>DETERMINISTIC</span>
          <span style={Object.assign({}, badge, { background: "#30363d", color: "#8b949e" })}>DEPLOY223</span>
        </div>
      </div>

      {/* Chain Status Banner */}
      <div style={{
        background: cs.bg,
        border: "1px solid " + cs.color,
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
            background: cs.color + "33",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 14, color: cs.color
          }}>{cs.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: cs.color, letterSpacing: 1 }}>{cs.label}</div>
            <div style={{ fontSize: 12, color: "#c9d1d9", marginTop: 2 }}>
              {bundles.length + " signed bundle" + (bundles.length !== 1 ? "s" : "") +
               " | " + summary.total_events + " events" +
               " | " + summary.unique_actors + " actor" + (summary.unique_actors !== 1 ? "s" : "")}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#8b949e" }}>Last Signed</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>
            {summary.last_signed_at ? new Date(summary.last_signed_at).toLocaleString() : "Never"}
          </div>
        </div>
      </div>

      {error && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</p>}

      {/* Stats Row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "10px 14px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>{summary.user_actions || 0}</div>
          <div style={{ fontSize: 11, color: "#8b949e" }}>User Actions</div>
        </div>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "10px 14px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#8b949e" }}>{summary.system_actions || 0}</div>
          <div style={{ fontSize: 11, color: "#8b949e" }}>System Actions</div>
        </div>
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: "10px 14px", flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#eab308" }}>{bundles.length}</div>
          <div style={{ fontSize: 11, color: "#8b949e" }}>Signed Bundles</div>
        </div>
      </div>

      {/* Actors */}
      {actors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8 }}>Actors</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {actors.map(function(a, ai) {
              return (
                <div key={ai} style={{
                  background: "#3b82f615",
                  border: "1px solid #3b82f644",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 12,
                  color: "#3b82f6"
                }}>
                  {(a.email || a.name || "Unknown") + " (" + a.action_count + ")"}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline (expandable) */}
      {timeline.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8, cursor: "pointer" }}
            onClick={function() { setShowTimeline(!showTimeline); }}
          >
            {(showTimeline ? "- " : "+ ") + "Event Timeline (" + timeline.length + ")"}
          </div>
          {showTimeline && (
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 12, maxHeight: 400, overflowY: "auto" }}>
              {timeline.map(function(item, ti) {
                var isBundle = item.type === "bundle_signed";
                var catColor = isBundle ? "#eab308" : (CATEGORY_COLOR[item.category] || "#8b949e");
                var actorColor = ACTOR_COLOR[item.actor_type] || "#8b949e";
                return (
                  <div key={ti} style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: ti < timeline.length - 1 ? "1px solid #21262d" : "none"
                  }}>
                    {/* Timestamp */}
                    <div style={{ fontSize: 11, color: "#8b949e", minWidth: 140, flexShrink: 0 }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                    {/* Category badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px",
                      borderRadius: 3, background: catColor + "22", color: catColor,
                      textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0, height: 16, lineHeight: "16px"
                    }}>
                      {isBundle ? "BUNDLE" : (item.category || "event")}
                    </span>
                    {/* Description */}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: "#e6edf3" }}>
                        {isBundle
                          ? "Bundle v" + item.bundle_version + " signed"
                          : (item.event_type || "event").replace(/_/g, " ")
                        }
                      </span>
                      {!isBundle && item.detail && Object.keys(item.detail).length > 0 && (
                        <span style={{ fontSize: 11, color: "#8b949e", marginLeft: 6 }}>
                          {Object.keys(item.detail).slice(0, 3).map(function(k) {
                            return k + ": " + String(item.detail[k]).substring(0, 30);
                          }).join(", ")}
                        </span>
                      )}
                    </div>
                    {/* Actor */}
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: actorColor, flexShrink: 0
                    }}>
                      {isBundle ? (item.signed_by || "System") : (item.actor_email || item.actor_type || "")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bundles (expandable) */}
      {bundles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8, cursor: "pointer" }}
            onClick={function() { setShowBundles(!showBundles); }}
          >
            {(showBundles ? "- " : "+ ") + "Signed Bundles (" + bundles.length + ")"}
          </div>
          {showBundles && bundles.map(function(b, bi) {
            return (
              <div key={bi} style={{
                background: "#0d1117",
                border: "1px solid #21262d",
                borderRadius: 6,
                padding: "10px 14px",
                marginBottom: 6
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#eab308" }}>
                    {"Bundle v" + b.bundle_version}
                  </span>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>
                    {new Date(b.signed_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
                  {"Hash: " + (b.bundle_hash || "").substring(0, 16) + "..."}
                </div>
                {b.previous_hash && (
                  <div style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
                    {"Prev: " + b.previous_hash.substring(0, 16) + "..."}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
                  {"Signed by: " + (b.signed_by_email || "System") + " | Key: " + b.signing_key_id}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verification Results (expandable) */}
      {verifyResult && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: verifyResult.chain_valid ? "#22c55e" : "#ef4444", marginBottom: 8, cursor: "pointer" }}
            onClick={function() { setShowVerify(!showVerify); }}
          >
            {(showVerify ? "- " : "+ ") + "Verification Results"}
          </div>
          {showVerify && (
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 6, padding: 12 }}>
              <div style={{
                fontSize: 12, color: verifyResult.chain_valid ? "#22c55e" : "#ef4444",
                fontWeight: 600, marginBottom: 8
              }}>
                {verifyResult.summary}
              </div>
              {verifyResult.verification_results && verifyResult.verification_results.map(function(vr, vi) {
                var vrColor = vr.overall === "VERIFIED" ? "#22c55e" : "#ef4444";
                return (
                  <div key={vi} style={{
                    borderBottom: vi < verifyResult.verification_results.length - 1 ? "1px solid #21262d" : "none",
                    padding: "6px 0"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3" }}>
                        {"Bundle v" + vr.bundle_version}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 6px",
                        borderRadius: 3, background: vrColor + "22", color: vrColor
                      }}>{vr.overall}</span>
                    </div>
                    {vr.checks && Object.keys(vr.checks).map(function(ck, ci) {
                      var check = vr.checks[ck];
                      var checkColor = check.passed ? "#22c55e" : "#ef4444";
                      return (
                        <div key={ci} style={{ fontSize: 11, color: "#8b949e", marginLeft: 12, marginTop: 2 }}>
                          <span style={{ color: checkColor, fontWeight: 600 }}>{check.passed ? "PASS" : "FAIL"}</span>
                          {" " + ck.replace(/_/g, " ")}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={signNewBundle} disabled={signing}>
            {signing ? "Signing..." : "Sign New Bundle"}
          </button>
          <button style={btnSecondary} onClick={verifyChain} disabled={verifying}>
            {verifying ? "Verifying..." : "Verify Chain"}
          </button>
        </div>
        <span style={dimText}>
          {summary.last_signed_at ? ("Last signed " + new Date(summary.last_signed_at).toLocaleString()) : ""}
        </span>
      </div>
    </div>
  );
}
