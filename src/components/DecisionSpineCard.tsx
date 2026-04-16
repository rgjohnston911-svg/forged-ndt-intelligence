// @ts-nocheck
/**
 * DEPLOY220 - DecisionSpineCard.tsx (replaces DEPLOY216)
 * src/components/DecisionSpineCard.tsx
 *
 * Decision State Machine UI with:
 *   - 5 decision states: pending, blocked, provisional, advisory, authority_locked
 *   - Unified confidence bar (physics-capped, OOD-discounted)
 *   - Conceptual Reasoning Engine trace (6 concept layers)
 *   - Blockers list for BLOCKED state
 *   - Confidence component breakdown
 *   - Signed audit bundle verification + export
 *
 * var only. String concatenation only. No backticks.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function pctFmt(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Math.round(Number(n) * 100) + "%";
}

var STATE_CONFIG = {
  pending: { color: "#8b949e", bg: "#8b949e22", label: "PENDING", icon: "..." },
  blocked: { color: "#ef4444", bg: "#ef444422", label: "BLOCKED", icon: "!!" },
  provisional: { color: "#f59e0b", bg: "#f59e0b22", label: "PROVISIONAL", icon: "?!" },
  advisory: { color: "#a78bfa", bg: "#a78bfa22", label: "ADVISORY", icon: "AI" },
  authority_locked: { color: "#22c55e", bg: "#22c55e22", label: "AUTHORITY LOCKED", icon: "OK" }
};

function oodColor(flag) {
  if (flag === "in_distribution") return "#22c55e";
  if (flag === "marginal") return "#f59e0b";
  if (flag === "out_of_distribution") return "#ef4444";
  return "#8b949e";
}

function oodLabel(flag) {
  if (flag === "in_distribution") return "IN DIST";
  if (flag === "marginal") return "MARGINAL";
  if (flag === "out_of_distribution") return "OUT OF DIST";
  return "UNKNOWN";
}

var CONCEPT_STATUS_COLOR = {
  sufficient: "#22c55e",
  active: "#f59e0b",
  partial: "#f59e0b",
  missing: "#ef4444",
  no_damage_detected: "#22c55e",
  critical: "#ef4444",
  elevated: "#f59e0b",
  low: "#22c55e",
  unknown: "#8b949e",
  resolved: "#22c55e",
  pending: "#8b949e",
  insufficient: "#ef4444",
  blocked: "#ef4444",
  provisional: "#f59e0b",
  advisory: "#a78bfa",
  authority_locked: "#22c55e"
};

export default function DecisionSpineCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [result, setResult] = useState(null);
  var [bundleInfo, setBundleInfo] = useState(null);
  var [verifying, setVerifying] = useState(false);
  var [verification, setVerification] = useState(null);
  var [showConcepts, setShowConcepts] = useState(false);
  var [showConfBreakdown, setShowConfBreakdown] = useState(false);

  useEffect(function() {
    if (!caseId) return;
    loadExisting();
  }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("decision_bundle_hash, decision_bundle_version, decision_bundle_signed_at, ood_score, ood_flag, physics_coverage, decision_state, decision_state_reason, unified_confidence, confidence_components, conceptual_reasoning")
      .eq("id", caseId)
      .single();
    if (!res.error && res.data && res.data.decision_bundle_hash) {
      setBundleInfo(res.data);
    }
  }

  async function runSpine() {
    setRunning(true);
    setError("");
    setVerification(null);
    try {
      var resp = await fetch("/api/decision-spine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId })
      });
      var json = await resp.json();
      if (!resp.ok || !json.success) {
        setError(json.error || "Spine run failed");
      } else {
        setResult(json);
        await loadExisting();
      }
    } catch (err) {
      setError("Network error: " + String(err));
    }
    setRunning(false);
  }

  async function verify() {
    setVerifying(true);
    try {
      var resp = await fetch("/api/export-audit-bundle?case_id=" + encodeURIComponent(caseId));
      var json = await resp.json();
      if (!resp.ok || !json.success) {
        setVerification({ ok: false, msg: json.error || "verify failed" });
      } else {
        setVerification({
          ok: json.integrity_verified,
          msg: json.integrity_note,
          stored: json.stored_hash,
          recomputed: json.recomputed_hash,
          bundle: json.bundle
        });
      }
    } catch (err) {
      setVerification({ ok: false, msg: "Network error: " + String(err) });
    }
    setVerifying(false);
  }

  function downloadBundle() {
    if (!verification || !verification.bundle) return;
    var blob = new Blob([JSON.stringify(verification.bundle, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "audit-bundle-" + caseId + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Pull values from result (fresh) or bundleInfo (persisted)
  var decisionState = (result && result.decision_state) || (bundleInfo && bundleInfo.decision_state) || "pending";
  var stateReason = (result && result.decision_state_reason) || (bundleInfo && bundleInfo.decision_state_reason) || "";
  var blockers = (result && result.blockers) || [];
  var unifiedConf = (result && result.unified_confidence) || (bundleInfo && bundleInfo.unified_confidence) || null;
  var confComponents = (result && result.confidence_components) || (bundleInfo && bundleInfo.confidence_components) || null;
  var oodFlag = (result && result.ood_flag) || (bundleInfo && bundleInfo.ood_flag) || null;
  var oodScore = (result && result.ood_score) || (bundleInfo && bundleInfo.ood_score) || null;
  var covPct = (result && result.physics_coverage_pct) ||
    (bundleInfo && bundleInfo.physics_coverage && bundleInfo.physics_coverage.coverage_pct) || null;
  var synthesis = result && result.synthesis;
  var signedAt = (result && result.signed_at) || (bundleInfo && bundleInfo.decision_bundle_signed_at);
  var bundleHash = (result && result.bundle_hash) || (bundleInfo && bundleInfo.decision_bundle_hash);
  var bundleVersion = (result && result.bundle_version) || (bundleInfo && bundleInfo.decision_bundle_version);
  var conceptReasoning = (result && result.conceptual_reasoning) || (bundleInfo && bundleInfo.conceptual_reasoning) || null;

  var sc = STATE_CONFIG[decisionState] || STATE_CONFIG.pending;

  return (
    <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Decision Spine</h3>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>
            Conceptual Reasoning Engine &middot; state machine &middot; unified confidence &middot; signed audit
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button type="button" onClick={runSpine} disabled={running}
            style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
            {running ? "Running..." : (bundleHash ? "Re-run spine" : "Run spine")}
          </button>
          {bundleHash && (
            <button type="button" onClick={verify} disabled={verifying}
              style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: verifying ? "#374151" : "#238636", color: "#fff", border: "none", borderRadius: "4px", cursor: verifying ? "wait" : "pointer" }}>
              {verifying ? "Verifying..." : "Verify + export"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d44", border: "1px solid #ef4444", borderRadius: "4px", color: "#fecaca", fontSize: "11px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {!bundleHash && !running && !error && (
        <div style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic" }}>
          No decision spine has been run yet. Click "Run spine" to activate the Conceptual Reasoning Engine.
        </div>
      )}

      {(bundleHash || result) && (
        <div>
          {/* Decision State Banner */}
          <div style={{ padding: "10px 14px", backgroundColor: sc.bg, border: "2px solid " + sc.color, borderRadius: "6px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px" }}>Decision State</div>
                <div style={{ fontSize: "16px", color: sc.color, fontWeight: 700, letterSpacing: "1px" }}>{sc.label}</div>
              </div>
              {unifiedConf != null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Unified Confidence</div>
                  <div style={{ fontSize: "20px", color: sc.color, fontWeight: 700 }}>{Math.round(unifiedConf * 100) + "%"}</div>
                </div>
              )}
            </div>
            {stateReason && (
              <div style={{ fontSize: "11px", color: "#c9d1d9", marginTop: "6px", lineHeight: "1.4" }}>
                {stateReason}
              </div>
            )}
          </div>

          {/* Blockers (only for BLOCKED state) */}
          {decisionState === "blocked" && blockers && blockers.length > 0 && (
            <div style={{ padding: "8px 10px", backgroundColor: "#7f1d1d22", border: "1px solid #ef4444", borderRadius: "4px", marginBottom: "10px" }}>
              <div style={{ fontSize: "9px", color: "#ef4444", textTransform: "uppercase", fontWeight: 600, marginBottom: "4px" }}>Missing Data (Resolve to Unblock)</div>
              {blockers.map(function(b, i) {
                return (
                  <div key={i} style={{ fontSize: "11px", color: "#fecaca", padding: "2px 0" }}>
                    {b}
                  </div>
                );
              })}
            </div>
          )}

          {/* Confidence Bar */}
          {unifiedConf != null && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Unified Confidence</div>
                <button type="button" onClick={function() { setShowConfBreakdown(!showConfBreakdown); }}
                  style={{ fontSize: "9px", color: "#58a6ff", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {showConfBreakdown ? "hide breakdown" : "show breakdown"}
                </button>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#161b22", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: Math.round(unifiedConf * 100) + "%", height: "100%", backgroundColor: sc.color, borderRadius: "4px", transition: "width 0.3s" }}></div>
              </div>
              {showConfBreakdown && confComponents && (
                <div style={{ marginTop: "6px", padding: "8px 10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "4px" }}>
                  <div style={{ fontSize: "10px", color: "#8b949e", marginBottom: "6px" }}>
                    Formula: min(authority, physics) x OOD discount
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "9px", color: "#8b949e" }}>Authority</div>
                      <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{pctFmt(confComponents.authority_confidence)}</div>
                    </div>
                    <div style={{ color: "#8b949e", fontSize: "12px", paddingTop: "12px" }}>x</div>
                    <div>
                      <div style={{ fontSize: "9px", color: "#8b949e" }}>Physics</div>
                      <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{pctFmt(confComponents.physics_coverage)}</div>
                    </div>
                    <div style={{ color: "#8b949e", fontSize: "12px", paddingTop: "12px" }}>x</div>
                    <div>
                      <div style={{ fontSize: "9px", color: "#8b949e" }}>OOD Disc.</div>
                      <div style={{ fontSize: "12px", color: oodColor(confComponents.ood_flag), fontWeight: 600 }}>{pctFmt(confComponents.ood_discount)}</div>
                    </div>
                    <div style={{ color: "#8b949e", fontSize: "12px", paddingTop: "12px" }}>=</div>
                    <div>
                      <div style={{ fontSize: "9px", color: "#8b949e" }}>Unified</div>
                      <div style={{ fontSize: "12px", color: sc.color, fontWeight: 700 }}>{pctFmt(unifiedConf)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metrics row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {oodFlag && (
              <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid " + oodColor(oodFlag) }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>OOD</div>
                <div style={{ fontSize: "11px", color: oodColor(oodFlag), fontWeight: 600 }}>{oodLabel(oodFlag)}</div>
              </div>
            )}
            {covPct != null && (
              <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Physics</div>
                <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>{pctFmt(covPct)}</div>
              </div>
            )}
            <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Engine</div>
              <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>DETERMINISTIC</div>
            </div>
            {bundleVersion && (
              <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Version</div>
                <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{bundleVersion}</div>
              </div>
            )}
            {signedAt && (
              <div style={{ padding: "5px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
                <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Signed</div>
                <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{new Date(signedAt).toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Synthesis */}
          {synthesis && (
            <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#c9d1d9", fontSize: "12px", lineHeight: "1.55", marginBottom: "10px" }}>
              {synthesis}
            </div>
          )}

          {/* Conceptual Reasoning Engine */}
          {conceptReasoning && conceptReasoning.concepts && (
            <div style={{ marginBottom: "10px" }}>
              <button type="button" onClick={function() { setShowConcepts(!showConcepts); }}
                style={{ fontSize: "10px", color: "#58a6ff", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "6px" }}>
                {showConcepts ? "Hide" : "Show"} Conceptual Reasoning Engine ({conceptReasoning.concept_count} concepts)
              </button>
              {showConcepts && (
                <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px" }}>
                  <div style={{ fontSize: "10px", color: "#8b949e", marginBottom: "8px" }}>
                    6-concept sequential reasoning chain. Each concept builds on the previous.
                  </div>
                  {conceptReasoning.concepts.map(function(concept, i) {
                    var statusColor = CONCEPT_STATUS_COLOR[concept.status] || "#8b949e";
                    return (
                      <div key={i} style={{ padding: "8px 10px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderLeft: "3px solid " + statusColor, borderRadius: "4px", marginBottom: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                          <div style={{ fontSize: "11px", color: "#c9d1d9", fontWeight: 600 }}>
                            {"C" + (i + 1) + ": " + concept.label}
                          </div>
                          <span style={{ padding: "2px 6px", fontSize: "9px", color: "#fff", backgroundColor: statusColor, borderRadius: "3px", textTransform: "uppercase" }}>
                            {concept.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#58a6ff", fontStyle: "italic", marginBottom: "3px" }}>
                          {concept.question}
                        </div>
                        <div style={{ fontSize: "10px", color: "#8b949e", lineHeight: "1.4" }}>
                          {concept.reasoning}
                        </div>
                        {concept.inputs_available && concept.inputs_available.length > 0 && (
                          <div style={{ fontSize: "9px", color: "#6e7681", marginTop: "4px" }}>
                            {"Inputs: " + concept.inputs_available.join(" | ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bundle hash */}
          {bundleHash && (
            <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "8px" }}>
              <span style={{ color: "#58a6ff" }}>hash:</span> {bundleHash}
            </div>
          )}

          {/* Verification */}
          {verification && (
            <div style={{ padding: "10px", backgroundColor: verification.ok ? "#14532d44" : "#7f1d1d44", border: "1px solid " + (verification.ok ? "#22c55e" : "#ef4444"), borderRadius: "6px", marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", color: verification.ok ? "#bbf7d0" : "#fecaca", fontWeight: 600, marginBottom: "4px" }}>
                {verification.ok ? "INTEGRITY VERIFIED" : "INTEGRITY FAILED"}
              </div>
              <div style={{ fontSize: "11px", color: "#c9d1d9", marginBottom: "6px" }}>{verification.msg}</div>
              {verification.bundle && (
                <button type="button" onClick={downloadBundle}
                  style={{ padding: "4px 10px", fontSize: "10px", backgroundColor: "#1f6feb", color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer" }}>
                  Download signed bundle (.json)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
