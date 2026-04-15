// @ts-nocheck
/**
 * DEPLOY216 - DecisionSpineCard.tsx
 * src/components/DecisionSpineCard.tsx
 *
 * Runs /api/decision-spine on mount, shows OOD flag, physics coverage,
 * synthesis narrative, bundle hash + signed timestamp, and a button
 * to export the signed audit bundle.
 *
 * This is the regulator-facing surface. Inspectors and authorities
 * see ONE card that answers: does the machine stand behind this
 * decision, and can I prove the record hasn't been tampered with.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function pctFmt(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Math.round(Number(n) * 100) + "%";
}

function oodColor(flag) {
  if (flag === "in_distribution") return "#22c55e";
  if (flag === "marginal") return "#f59e0b";
  if (flag === "out_of_distribution") return "#ef4444";
  return "#8b949e";
}

function oodLabel(flag) {
  if (flag === "in_distribution") return "IN DISTRIBUTION";
  if (flag === "marginal") return "MARGINAL";
  if (flag === "out_of_distribution") return "OUT OF DISTRIBUTION";
  return "UNKNOWN";
}

export default function DecisionSpineCard(props) {
  var caseId = props.caseId;
  var [running, setRunning] = useState(false);
  var [error, setError] = useState("");
  var [result, setResult] = useState(null);
  var [bundleInfo, setBundleInfo] = useState(null);
  var [verifying, setVerifying] = useState(false);
  var [verification, setVerification] = useState(null);

  useEffect(function() {
    if (!caseId) return;
    loadExisting();
  }, [caseId]);

  async function loadExisting() {
    var res = await supabase
      .from("inspection_cases")
      .select("decision_bundle_hash, decision_bundle_version, decision_bundle_signed_at, ood_score, ood_flag, physics_coverage")
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

  var oodFlag = (result && result.ood_flag) || (bundleInfo && bundleInfo.ood_flag) || null;
  var oodScore = (result && result.ood_score) || (bundleInfo && bundleInfo.ood_score) || null;
  var covPct = (result && result.physics_coverage_pct) ||
    (bundleInfo && bundleInfo.physics_coverage && bundleInfo.physics_coverage.coverage_pct) || null;
  var synthesis = result && result.synthesis;
  var signedAt = (result && result.signed_at) || (bundleInfo && bundleInfo.decision_bundle_signed_at);
  var bundleHash = (result && result.bundle_hash) || (bundleInfo && bundleInfo.decision_bundle_hash);
  var bundleVersion = (result && result.bundle_version) || (bundleInfo && bundleInfo.decision_bundle_version);

  return (
    <div style={{ marginTop: "16px", padding: "14px", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#c9d1d9", fontSize: "14px" }}>Decision Spine</h3>
          <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "2px" }}>
            Signed audit bundle &middot; OOD calibration &middot; physics coverage &middot; neighbor precedent
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={runSpine}
            disabled={running}
            style={{ padding: "5px 10px", fontSize: "11px", backgroundColor: running ? "#374151" : "#1f6feb", color: "#fff", border: "none", borderRadius: "4px", cursor: running ? "wait" : "pointer" }}>
            {running ? "Running..." : (bundleHash ? "Re-run spine" : "Run spine")}
          </button>
          {bundleHash && (
            <button
              type="button"
              onClick={verify}
              disabled={verifying}
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
          No signed bundle yet for this case. Click "Run spine" to generate one.
        </div>
      )}

      {(bundleHash || result) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
          {oodFlag && (
            <div style={{ padding: "6px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid " + oodColor(oodFlag) }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>OOD Flag</div>
              <div style={{ fontSize: "12px", color: oodColor(oodFlag), fontWeight: 600 }}>{oodLabel(oodFlag)}</div>
              {oodScore != null && <div style={{ fontSize: "10px", color: "#8b949e" }}>top sim {Number(oodScore).toFixed(3)}</div>}
            </div>
          )}
          {covPct != null && (
            <div style={{ padding: "6px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Physics Coverage</div>
              <div style={{ fontSize: "12px", color: "#c9d1d9", fontWeight: 600 }}>{pctFmt(covPct)}</div>
            </div>
          )}
          {bundleVersion && (
            <div style={{ padding: "6px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Spine Version</div>
              <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{bundleVersion}</div>
            </div>
          )}
          {signedAt && (
            <div style={{ padding: "6px 10px", backgroundColor: "#161b22", borderRadius: "4px", border: "1px solid #30363d" }}>
              <div style={{ fontSize: "9px", color: "#8b949e", textTransform: "uppercase" }}>Signed</div>
              <div style={{ fontSize: "11px", color: "#c9d1d9" }}>{new Date(signedAt).toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {synthesis && (
        <div style={{ padding: "10px", backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#c9d1d9", fontSize: "12px", lineHeight: "1.55", marginBottom: "10px" }}>
          {synthesis}
        </div>
      )}

      {bundleHash && (
        <div style={{ fontSize: "10px", color: "#8b949e", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "8px" }}>
          <span style={{ color: "#58a6ff" }}>hash:</span> {bundleHash}
        </div>
      )}

      {verification && (
        <div style={{ padding: "10px", backgroundColor: verification.ok ? "#14532d44" : "#7f1d1d44", border: "1px solid " + (verification.ok ? "#22c55e" : "#ef4444"), borderRadius: "6px", marginBottom: "8px" }}>
          <div style={{ fontSize: "11px", color: verification.ok ? "#bbf7d0" : "#fecaca", fontWeight: 600, marginBottom: "4px" }}>
            {verification.ok ? "INTEGRITY VERIFIED" : "INTEGRITY FAILED"}
          </div>
          <div style={{ fontSize: "11px", color: "#c9d1d9", marginBottom: "6px" }}>{verification.msg}</div>
          {verification.bundle && (
            <button
              type="button"
              onClick={downloadBundle}
              style={{ padding: "4px 10px", fontSize: "10px", backgroundColor: "#1f6feb", color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer" }}>
              Download signed bundle (.json)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
