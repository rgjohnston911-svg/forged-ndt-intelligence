// src/AuditModeViewer.tsx
// FORGED NDT Intelligence OS - Audit Mode Viewer (Hardened)
// DEPLOY##X / v##.x
//
// Read-only replay over the coherence log. Adds:
//   - Deterministic replay verification (per package, per role)
//   - Chain-of-custody event log + action buttons
//   - Reality Integrity Score (deterministic aggregate)
//   - Cryptographically signed exports
// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
interface CoherenceRecord {
  recordType?: string;
  timestamp: string;
  packageHash: string;
  role: string;
  userId: string;
  jurisdiction?: string;
  taskContext?: string;
  viewHash: string;
  disposition: string;
  hardLockCount: number;
  unresolvedContradictionCount?: number;
}
interface CustodyRecord {
  recordType?: string;
  timestamp: string;
  packageHash: string;
  userId: string;
  role: string;
  eventType: string;
  reason?: string;
  detail?: any;
}
interface CoherenceViolation {
  type: string;
  description: string;
  detail?: any;
}
interface ReplayResult {
  ok: boolean;
  match: boolean;
  packageHash: string;
  role: string;
  originalViewHash?: string;
  replayedViewHash?: string;
  replayFailure?: string;
  message?: string;
  drift?: any[];
  packageStoredAt?: string;
  replayPerformedAt?: string;
}
interface AuditModeViewerProps {
  coherenceLogEndpoint?: string;
  replayEndpoint?: string;
  signExportEndpoint?: string;
  currentUserId?: string;
  currentRole?: string;
}
export default function AuditModeViewer(props: AuditModeViewerProps): JSX.Element {
  const coherenceEndpoint = props.coherenceLogEndpoint || "/.netlify/functions/coherence-log";
  const replayEndpoint = props.replayEndpoint || "/.netlify/functions/replay-audit";
  const signEndpoint = props.signExportEndpoint || "/.netlify/functions/sign-export";
  const currentUserId = props.currentUserId || "auditor";
  const currentRole = props.currentRole || "SAFETY";
  const [recent, setRecent] = useState<CoherenceRecord[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [projectionRecords, setProjectionRecords] = useState<CoherenceRecord[]>([]);
  const [custodyRecords, setCustodyRecords] = useState<CustodyRecord[]>([]);
  const [violations, setViolations] = useState<CoherenceViolation[]>([]);
  const [replayResults, setReplayResults] = useState<{ [role: string]: ReplayResult }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Load recent records on mount
  useEffect(() => {
    async function loadRecent() {
      setLoading(true);
      try {
        const resp = await fetch(coherenceEndpoint + "?limit=100");
        const data = await resp.json();
        if (data.ok) {
          // Filter to projection records only for the package list
          var projections = (data.records || []).filter(function (r: any) {
            return !r.recordType || r.recordType === "PROJECTION";
          });
          setRecent(projections);
        } else {
          setError(data.error || "Failed to load");
        }
      } catch (e: any) {
        setError(e?.message || "Network error");
      } finally {
        setLoading(false);
      }
    }
    loadRecent();
  }, [coherenceEndpoint]);
  // Load details when a package is selected
  useEffect(() => {
    if (!selectedHash) return;
    var cancelled = false;
    async function loadPackage() {
      try {
        // Projection records
        const projResp = await fetch(coherenceEndpoint + "?packageHash=" + encodeURIComponent(selectedHash) + "&type=projection");
        const projData = await projResp.json();
        if (cancelled) return;
        if (projData.ok) setProjectionRecords(projData.records);
        // Custody records
        const custResp = await fetch(coherenceEndpoint + "?packageHash=" + encodeURIComponent(selectedHash) + "&type=custody");
        const custData = await custResp.json();
        if (cancelled) return;
        if (custData.ok) setCustodyRecords(custData.records);
        // Coherence check
        const cohResp = await fetch(coherenceEndpoint + "?packageHash=" + encodeURIComponent(selectedHash) + "&check=coherence");
        const cohData = await cohResp.json();
        if (cancelled) return;
        if (cohData.ok) setViolations(cohData.violations || []);
        // Log VIEWED custody event
        await fetch(coherenceEndpoint + "?type=custody", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageHash: selectedHash,
            userId: currentUserId,
            role: currentRole,
            eventType: "VIEWED",
            timestamp: new Date().toISOString()
          })
        });
        // Reset replay results for the newly selected package
        setReplayResults({});
      } catch (e) {
        // silent
      }
    }
    loadPackage();
    return () => {
      cancelled = true;
    };
  }, [selectedHash, coherenceEndpoint, currentUserId, currentRole]);
  // Deduplicate recent records by packageHash for the list
  const packageList = useMemo(() => {
    const byHash: { [k: string]: { hash: string; latest: CoherenceRecord; viewCount: number } } = {};
    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      var h = r.packageHash;
      if (!byHash[h]) {
        byHash[h] = { hash: h, latest: r, viewCount: 1 };
      } else {
        byHash[h].viewCount += 1;
        if (r.timestamp > byHash[h].latest.timestamp) byHash[h].latest = r;
      }
    }
    return Object.keys(byHash).map(function (k) {
      return byHash[k];
    }).sort(function (a, b) {
      return b.latest.timestamp.localeCompare(a.latest.timestamp);
    });
  }, [recent]);
  // ===========================================================================
  // REPLAY VERIFICATION
  // ===========================================================================
  async function runReplay(record: CoherenceRecord) {
    if (busy) return;
    setBusy("replay:" + record.role);
    try {
      const roleContext = {
        role: record.role,
        userId: record.userId,
        jurisdiction: record.jurisdiction || "UNSPECIFIED",
        taskContext: record.taskContext || "DESKTOP_REVIEW",
        requestTimestamp: record.timestamp
      };
      const resp = await fetch(replayEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageHash: record.packageHash,
          roleContext: roleContext,
          originalViewHash: record.viewHash
        })
      });
      const data = await resp.json();
      setReplayResults(function (prev: any) {
        var next = Object.assign({}, prev);
        next[record.role] = data;
        return next;
      });
      // Log REPLAYED custody event
      await fetch(coherenceEndpoint + "?type=custody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageHash: record.packageHash,
          userId: currentUserId,
          role: currentRole,
          eventType: "REPLAYED",
          detail: { replayedForRole: record.role, match: data.match }
        })
      });
    } catch (e: any) {
      setReplayResults(function (prev: any) {
        var next = Object.assign({}, prev);
        next[record.role] = { ok: false, match: false, replayFailure: "NETWORK", message: e?.message } as any;
        return next;
      });
    } finally {
      setBusy(null);
    }
  }
  async function runReplayAll() {
    for (var i = 0; i < projectionRecords.length; i++) {
      await runReplay(projectionRecords[i]);
    }
  }
  // ===========================================================================
  // CUSTODY ACTIONS
  // ===========================================================================
  async function postCustodyEvent(eventType: string, reason?: string) {
    if (!selectedHash) return;
    setBusy("custody:" + eventType);
    try {
      await fetch(coherenceEndpoint + "?type=custody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageHash: selectedHash,
          userId: currentUserId,
          role: currentRole,
          eventType: eventType,
          reason: reason || ""
        })
      });
      // Refresh custody list
      const custResp = await fetch(coherenceEndpoint + "?packageHash=" + encodeURIComponent(selectedHash) + "&type=custody");
      const custData = await custResp.json();
      if (custData.ok) setCustodyRecords(custData.records);
    } catch (e) {
      // silent
    } finally {
      setBusy(null);
    }
  }
  // ===========================================================================
  // SIGNED EXPORT
  // ===========================================================================
  async function signedExport() {
    if (!selectedHash) return;
    setBusy("export");
    try {
      // Build the export payload
      const payload = {
        packageHash: selectedHash,
        projections: projectionRecords,
        custody: custodyRecords,
        coherenceViolations: violations,
        replayResults: replayResults,
        integrityScore: integrityScore,
        exportedAt: new Date().toISOString(),
        exportedBy: currentUserId,
        exportedByRole: currentRole
      };
      // Sign it
      const signResp = await fetch(signEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: payload,
          userId: currentUserId,
          role: currentRole,
          exportType: "AUDIT_RECORD",
          packageHash: selectedHash
        })
      });
      const signData = await signResp.json();
      // Build the signed file
      const signedExportFile = {
        payload: payload,
        signature: signData.signature || null,
        signerKeyId: signData.signerKeyId || null,
        algorithm: signData.algorithm || null,
        contentHash: signData.contentHash || null,
        signatureMetadata: signData.metadata || null,
        signatureError: signData.error || null
      };
      // Download as JSON
      const blob = new Blob([JSON.stringify(signedExportFile, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-export-" + selectedHash.slice(0, 16) + ".json";
      a.click();
      URL.revokeObjectURL(url);
      // Log EXPORTED custody event
      await postCustodyEvent("EXPORTED", "Signed JSON export, signerKeyId=" + (signData.signerKeyId || "none"));
    } catch (e) {
      // silent
    } finally {
      setBusy(null);
    }
  }
  // ===========================================================================
  // REALITY INTEGRITY SCORE (deterministic aggregate)
  // ===========================================================================
  const integrityScore = useMemo(() => {
    if (!selectedHash || projectionRecords.length === 0) return null;
    // Component 1: Coherence (1.0 if no violations, drops per violation)
    var coherenceScore = Math.max(0, 1.0 - 0.2 * violations.length);
    // Component 2: Replay verification (% of replayed projections that matched)
    var replayKeys = Object.keys(replayResults);
    var replayScore = 1.0;
    if (replayKeys.length > 0) {
      var matched = replayKeys.filter(function (k) { return replayResults[k].match; }).length;
      replayScore = matched / replayKeys.length;
    }
    // Component 3: Hard-lock visibility consistency (already covered by coherence but explicit)
    var hlCounts = projectionRecords.map(function (r) { return r.hardLockCount || 0; });
    var hlUnique = hlCounts.filter(function (c, i, a) { return a.indexOf(c) === i; });
    var hardLockScore = hlUnique.length <= 1 ? 1.0 : 0.0;
    // Component 4: Disposition consistency
    var dispositions = projectionRecords.map(function (r) { return r.disposition; });
    var dispUnique = dispositions.filter(function (d, i, a) { return a.indexOf(d) === i; });
    var dispositionScore = dispUnique.length <= 1 ? 1.0 : 0.0;
    // Component 5: Custody completeness (has at least one acknowledged event?)
    var hasAck = custodyRecords.some(function (c) { return c.eventType === "ACKNOWLEDGED"; });
    var custodyScore = hasAck ? 1.0 : 0.5;
    // Weighted aggregate
    var weights = { coherence: 0.30, replay: 0.30, hardLock: 0.15, disposition: 0.15, custody: 0.10 };
    var aggregate = coherenceScore * weights.coherence
      + replayScore * weights.replay
      + hardLockScore * weights.hardLock
      + dispositionScore * weights.disposition
      + custodyScore * weights.custody;
    return {
      score: Math.round(aggregate * 100),
      components: {
        coherence: Math.round(coherenceScore * 100),
        replay: replayKeys.length > 0 ? Math.round(replayScore * 100) : null,
        hardLock: Math.round(hardLockScore * 100),
        disposition: Math.round(dispositionScore * 100),
        custody: Math.round(custodyScore * 100)
      },
      replayChecked: replayKeys.length > 0,
      replayCovered: replayKeys.length + " of " + projectionRecords.length
    };
  }, [selectedHash, projectionRecords, custodyRecords, violations, replayResults]);
  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <div style={{ padding: 12, background: "#1f2937", color: "#fff", borderRadius: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>FORGED NDT - Audit Mode (Hardened)</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          Read-only replay. Deterministic replay verification, chain-of-custody, and signed exports active.
        </div>
      </div>
      {loading && <div style={{ padding: 12, color: "#666" }}>Loading audit log...</div>}
      {error && (
        <div style={{ padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 4 }}>
          <strong>Audit log error:</strong> {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        {/* Package list */}
        <div style={{ border: "1px solid #dee2e6", borderRadius: 4, maxHeight: 700, overflow: "auto" }}>
          <div style={{ padding: 8, background: "#f8f9fa", borderBottom: "1px solid #dee2e6", fontWeight: 600, fontSize: 13 }}>
            Recent decision packages ({packageList.length})
          </div>
          {packageList.length === 0 && (
            <div style={{ padding: 12, color: "#666", fontSize: 13 }}>No records.</div>
          )}
          {packageList.map(function (entry) {
            const active = entry.hash === selectedHash;
            return (
              <div
                key={entry.hash}
                onClick={function () { setSelectedHash(entry.hash); }}
                style={{
                  padding: 10,
                  borderBottom: "1px solid #f0f0f0",
                  background: active ? "#e0f2fe" : "#fff",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555" }}>
                  {entry.hash.slice(0, 24)}...
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>{entry.latest.disposition}</strong>{" "}
                  <span style={{ color: "#666" }}>| {entry.viewCount} view{entry.viewCount > 1 ? "s" : ""}</span>
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{entry.latest.timestamp}</div>
                {entry.latest.hardLockCount > 0 && (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2, fontWeight: 600 }}>
                    {entry.latest.hardLockCount} hard lock(s)
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Detail */}
        <div style={{ border: "1px solid #dee2e6", borderRadius: 4 }}>
          {!selectedHash && (
            <div style={{ padding: 20, color: "#666" }}>Select a package to view audit detail.</div>
          )}
          {selectedHash && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Package <span style={{ fontFamily: "monospace", fontSize: 12 }}>{selectedHash}</span>
              </div>
              {/* Integrity Score */}
              {integrityScore && (
                <div
                  style={{
                    padding: 12,
                    background: integrityScore.score >= 80 ? "#f0fdf4" : integrityScore.score >= 60 ? "#fffbeb" : "#fef2f2",
                    border: "2px solid " + (integrityScore.score >= 80 ? "#22c55e" : integrityScore.score >= 60 ? "#f59e0b" : "#dc2626"),
                    borderRadius: 4
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Reality Integrity Score</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{integrityScore.score}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                    Coherence {integrityScore.components.coherence} | Replay {integrityScore.components.replay !== null ? integrityScore.components.replay : "not checked"} | Hard lock {integrityScore.components.hardLock} | Disposition {integrityScore.components.disposition} | Custody {integrityScore.components.custody}
                  </div>
                  {!integrityScore.replayChecked && (
                    <div style={{ fontSize: 11, color: "#92400e", marginTop: 6 }}>
                      Replay not yet performed. Run replay to harden the integrity score.
                    </div>
                  )}
                </div>
              )}
              {/* Coherence Violations */}
              {violations.length > 0 && (
                <div style={{ padding: 12, background: "#fee2e2", border: "2px solid #dc2626", borderRadius: 4 }}>
                  <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>
                    COHERENCE VIOLATIONS ({violations.length})
                  </div>
                  {violations.map(function (v, i) {
                    return (
                      <div key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                        <strong>{v.type}:</strong> {v.description}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Action Bar */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={runReplayAll}
                  disabled={!!busy}
                  style={{ padding: "6px 12px", border: "1px solid #0066cc", background: "#0066cc", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  {busy && busy.indexOf("replay") === 0 ? "Replaying..." : "Replay all projections"}
                </button>
                <button
                  onClick={function () { postCustodyEvent("ACKNOWLEDGED", "Reviewed and acknowledged"); }}
                  disabled={!!busy}
                  style={{ padding: "6px 12px", border: "1px solid #16a34a", background: "#fff", color: "#16a34a", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Acknowledge
                </button>
                <button
                  onClick={function () { postCustodyEvent("SIGNED", "Audit reviewer sign-off"); }}
                  disabled={!!busy}
                  style={{ padding: "6px 12px", border: "1px solid #7c3aed", background: "#fff", color: "#7c3aed", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Sign off
                </button>
                <button
                  onClick={signedExport}
                  disabled={!!busy}
                  style={{ padding: "6px 12px", border: "1px solid #1f2937", background: "#1f2937", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Signed export (JSON)
                </button>
                <button
                  onClick={function () {
                    var reason = prompt("Escalation reason:");
                    if (reason) postCustodyEvent("ESCALATED", reason);
                  }}
                  disabled={!!busy}
                  style={{ padding: "6px 12px", border: "1px solid #dc2626", background: "#fff", color: "#dc2626", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Escalate
                </button>
              </div>
              {/* Role Projections + Replay Results */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Role projections ({projectionRecords.length})
                </div>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      <th style={{ textAlign: "left", padding: 6 }}>Time</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Role</th>
                      <th style={{ textAlign: "left", padding: 6 }}>User</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Disposition</th>
                      <th style={{ textAlign: "left", padding: 6 }}>View hash</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Replay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionRecords.map(function (r, i) {
                      var rr = replayResults[r.role];
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: 6, fontFamily: "monospace", fontSize: 10 }}>{r.timestamp}</td>
                          <td style={{ padding: 6, fontWeight: 600 }}>{r.role}</td>
                          <td style={{ padding: 6 }}>{r.userId}</td>
                          <td style={{ padding: 6 }}>{r.disposition}</td>
                          <td style={{ padding: 6, fontFamily: "monospace", fontSize: 10 }}>
                            {(r.viewHash || "").slice(0, 12)}...
                          </td>
                          <td style={{ padding: 6 }}>
                            {!rr && (
                              <button
                                onClick={function () { runReplay(r); }}
                                disabled={!!busy}
                                style={{ padding: "2px 8px", fontSize: 11, border: "1px solid #0066cc", background: "#fff", color: "#0066cc", borderRadius: 3, cursor: "pointer" }}
                              >
                                Run
                              </button>
                            )}
                            {rr && rr.match && (
                              <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 11 }}>VERIFIED</span>
                            )}
                            {rr && !rr.match && (
                              <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 11 }} title={rr.message || rr.replayFailure}>
                                {rr.replayFailure || "MISMATCH"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Custody Log */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Chain of custody ({custodyRecords.length} events)
                </div>
                {custodyRecords.length === 0 && (
                  <div style={{ fontSize: 12, color: "#666", padding: 8 }}>No custody events yet.</div>
                )}
                {custodyRecords.length > 0 && (
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa" }}>
                        <th style={{ textAlign: "left", padding: 6 }}>Time</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Event</th>
                        <th style={{ textAlign: "left", padding: 6 }}>User</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Role</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custodyRecords.map(function (c, i) {
                        var color =
                          c.eventType === "SIGNED" ? "#7c3aed" :
                          c.eventType === "ESCALATED" ? "#dc2626" :
                          c.eventType === "EXPORTED" ? "#1f2937" :
                          c.eventType === "ACKNOWLEDGED" ? "#16a34a" :
                          c.eventType === "REPLAYED" ? "#0066cc" : "#555";
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: 6, fontFamily: "monospace", fontSize: 10 }}>{c.timestamp}</td>
                            <td style={{ padding: 6, fontWeight: 700, color: color }}>{c.eventType}</td>
                            <td style={{ padding: 6 }}>{c.userId}</td>
                            <td style={{ padding: 6 }}>{c.role}</td>
                            <td style={{ padding: 6 }}>{c.reason || ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
