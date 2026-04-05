import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sbSelect, sbUpdate, sbInsert, callDecisionCore, generateId, ASSET_CLASS_MAP } from "../utils/supabase";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const caseId = id || "";

  const [caseData, setCaseData] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [dc, setDc] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("workflow");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Finding modal
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [findingLocation, setFindingLocation] = useState("");
  const [findingMethod, setFindingMethod] = useState("VT");
  const [findingType, setFindingType] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("minor");
  const [findingDimensions, setFindingDimensions] = useState("");
  const [findingNotes, setFindingNotes] = useState("");
  const [findingSubmitting, setFindingSubmitting] = useState(false);

  useEffect(() => { loadCase(); }, [caseId]);

  // Read helpers — original columns first, fallback to sb_*
  function getConsequence(c: any): string { return c?.consequence_tier || c?.sb_consequence || ""; }
  function getDisposition(c: any): string { return c?.superbrain_disposition || c?.sb_disposition || ""; }
  function getConfidence(c: any): number {
    if (c?.confidence_overall != null && c?.confidence_overall > 0) return c.confidence_overall;
    if (c?.sb_confidence != null && c?.sb_confidence > 0) return c.sb_confidence;
    return 0;
  }
  function getMechanism(c: any): string { return c?.primary_mechanism || c?.sb_mechanism || ""; }
  function getSufficiency(c: any): string { return c?.sufficiency_verdict || c?.sb_sufficiency || ""; }
  function getTitle(c: any): string { return c?.title || c?.case_name || "Untitled Case"; }

  async function loadCase() {
    try {
      setLoading(true);
      setError("");

      const cases = await sbSelect("cases", "id=eq." + caseId);
      if (!cases || cases.length === 0) { setError("Case not found."); setLoading(false); return; }
      setCaseData(cases[0]);

      const snaps = await sbSelect("decision_core_snapshots", "case_id=eq." + caseId + "&order=snapshot_number.desc&limit=1");
      if (snaps && snaps.length > 0) {
        setSnapshot(snaps[0]);
        try { setDc(typeof snaps[0].full_output === "string" ? JSON.parse(snaps[0].full_output) : snaps[0].full_output); } catch { setDc(null); }
      }

      setChecklist((await sbSelect("checklist_items", "case_id=eq." + caseId + "&order=item_order.asc")) || []);
      setHistory((await sbSelect("case_history", "case_id=eq." + caseId + "&order=created_at.desc&limit=50")) || []);
      setFindings((await sbSelect("findings", "case_id=eq." + caseId + "&order=created_at.desc")) || []);
    } catch (err: any) {
      setError("Failed to load case: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function toggleChecklist(itemId: string, currentChecked: boolean) {
    try {
      await sbUpdate("checklist_items", itemId, { is_checked: !currentChecked });
      setChecklist(prev => prev.map(item => item.id === itemId ? { ...item, is_checked: !currentChecked } : item));
    } catch (err: any) { console.error("Checklist toggle failed:", err); }
  }

  async function handleAddFinding() {
    if (!findingType.trim()) return;
    setFindingSubmitting(true);

    try {
      const now = new Date().toISOString();

      await sbInsert("findings", {
        id: generateId(), case_id: caseId, location: findingLocation.trim(),
        method: findingMethod, indication_type: findingType.trim(),
        severity: findingSeverity, dimensions: findingDimensions.trim(),
        notes: findingNotes.trim(), created_at: now
      });

      let findingText = "\n\nFINDING [" + findingMethod + "]: " + findingType.trim();
      if (findingLocation.trim()) findingText += " at " + findingLocation.trim();
      if (findingSeverity) findingText += " — Severity: " + findingSeverity;
      if (findingDimensions.trim()) findingText += " — Dimensions: " + findingDimensions.trim();
      if (findingNotes.trim()) findingText += " — Notes: " + findingNotes.trim();

      const updatedTranscript = (caseData.running_transcript || "") + findingText;
      await sbUpdate("cases", caseId, { running_transcript: updatedTranscript, updated_at: now });

      const engineAssetClass = ASSET_CLASS_MAP[caseData.asset_type || caseData.asset_class] || "pressure_vessel";
      const dcResult = await callDecisionCore(updatedTranscript, engineAssetClass);
      const newDc = dcResult.decision_core || dcResult;

      const consequence = newDc.consequence_reality?.consequence_level || "";
      const disposition = newDc.decision_reality?.disposition || "";
      const confidence = newDc.reality_confidence?.overall_confidence || 0;
      const mechanism = newDc.damage_reality?.primary_damage_mechanism?.mechanism || "";
      const sufficiency = newDc.decision_reality?.evidence_sufficiency || "";
      const hardLocks = newDc.decision_reality?.hard_lock_count || newDc.decision_reality?.hard_locks?.length || 0;
      let nextAction = "";
      if (newDc.decision_reality?.guided_recovery?.length > 0) {
        const first = newDc.decision_reality.guided_recovery[0];
        nextAction = typeof first === "string" ? first : (first.action || first.description || "");
      }
      let band = "LOW";
      if (confidence >= 0.8) band = "HIGH";
      else if (confidence >= 0.6) band = "GUARDED";

      const prevSnapNum = snapshot ? (snapshot.snapshot_number || 1) : 0;
      const newSnapshotId = generateId();

      await sbInsert("decision_core_snapshots", {
        id: newSnapshotId, case_id: caseId, snapshot_number: prevSnapNum + 1,
        transcript_at_eval: updatedTranscript, full_output: JSON.stringify(newDc),
        consequence_level: consequence, disposition: disposition, confidence: confidence,
        primary_mechanism: mechanism, evidence_sufficiency: sufficiency,
        engine_version: newDc.engine_version || "", created_at: now
      });

      // Update BOTH column sets
      await sbUpdate("cases", caseId, {
        consequence_tier: consequence, superbrain_disposition: disposition,
        confidence_band: band, confidence_overall: confidence,
        primary_mechanism: mechanism, sufficiency_verdict: sufficiency,
        hard_lock_count: hardLocks, next_action: nextAction, highest_severity: consequence,
        sb_consequence: consequence, sb_disposition: disposition,
        sb_confidence: confidence, sb_mechanism: mechanism,
        sb_sufficiency: sufficiency, sb_engine_version: newDc.engine_version || "",
        sb_last_eval: now, latest_snapshot_id: newSnapshotId,
        finding_count: (caseData.finding_count || 0) + 1, updated_at: now
      });

      if (newDc.inspection_reality?.phased_strategy) {
        const phases = newDc.inspection_reality.phased_strategy;
        let checkOrder = 0;
        for (let pi = 0; pi < phases.length; pi++) {
          const phase = phases[pi];
          const phaseName = phase.phase || ("Phase " + (pi + 1));
          const items = phase.actions || phase.steps || [];
          for (let ai = 0; ai < items.length; ai++) {
            checkOrder++;
            const itemText = typeof items[ai] === "string" ? items[ai] : (items[ai].action || items[ai].description || JSON.stringify(items[ai]));
            await sbInsert("checklist_items", {
              id: generateId(), case_id: caseId, snapshot_id: newSnapshotId,
              phase: phaseName, item_text: itemText, item_order: checkOrder,
              is_checked: false, created_at: now
            });
          }
        }
      }

      await sbInsert("case_history", {
        id: generateId(), case_id: caseId, action: "finding_added",
        details: "Finding: " + findingType.trim() + " (" + findingMethod + ") — Re-evaluated: " + consequence + " / " + disposition + " / " + Math.round(confidence * 100) + "%",
        snapshot_id: newSnapshotId, created_at: now
      });

      setShowFindingModal(false);
      setFindingLocation(""); setFindingMethod("VT"); setFindingType("");
      setFindingSeverity("minor"); setFindingDimensions(""); setFindingNotes("");
      setFindingSubmitting(false);
      await loadCase();
    } catch (err: any) {
      setFindingSubmitting(false);
      alert("Failed to add finding: " + (err.message || String(err)));
    }
  }

  function consequenceColor(c: string) { return c === "CRITICAL" ? "#ef4444" : c === "HIGH" ? "#f97316" : (c === "MODERATE" || c === "MEDIUM") ? "#eab308" : "#22c55e"; }
  function dispositionColor(d: string) { return d === "BLOCKED" ? "#ef4444" : (d === "HOLD" || d === "hold_for_review") ? "#f97316" : d === "CONDITIONAL_GO" ? "#eab308" : d === "GO" ? "#22c55e" : "#6b7280"; }
  function formatDate(iso: string) { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

  const cardStyle: React.CSSProperties = { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px", marginBottom: "16px" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#f8fafc", fontSize: "13px", boxSizing: "border-box", outline: "none" };

  if (loading) return <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto", color: "#e2e8f0" }}><div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>Loading case...</div></div>;
  if (error || !caseData) return <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto", color: "#e2e8f0" }}><div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>{error || "Case not found."}</div><button onClick={() => navigate("/cases")} style={{ padding: "8px 16px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>← Dashboard</button></div>;

  const consequence = getConsequence(caseData);
  const disposition = getDisposition(caseData);
  const confidence = getConfidence(caseData);
  const mechanism = getMechanism(caseData);
  const sufficiency = getSufficiency(caseData);
  const isBlocked = disposition === "BLOCKED";

  let nextAction = caseData.next_action || "";
  if (!nextAction && dc?.decision_reality?.guided_recovery?.length > 0) {
    const first = dc.decision_reality.guided_recovery[0];
    nextAction = typeof first === "string" ? first : (first.action || first.description || "");
  }

  const confidenceSections: { label: string; value: number }[] = [];
  if (dc?.reality_confidence) {
    const rc = dc.reality_confidence;
    if (rc.physical_confidence != null) confidenceSections.push({ label: "Physical Reality", value: rc.physical_confidence });
    if (rc.damage_confidence != null) confidenceSections.push({ label: "Damage Mechanism", value: rc.damage_confidence });
    if (rc.consequence_confidence != null) confidenceSections.push({ label: "Consequence", value: rc.consequence_confidence });
    if (rc.inspection_confidence != null) confidenceSections.push({ label: "Inspection Plan", value: rc.inspection_confidence });
    if (rc.overall_confidence != null) confidenceSections.push({ label: "Overall", value: rc.overall_confidence });
  }

  const recoveryQueue: any[] = dc?.decision_reality?.guided_recovery || [];
  let authority = "";
  if (dc?.authority_reality) authority = (dc.authority_reality.governing_code || "") + (dc.authority_reality.jurisdiction ? " — " + dc.authority_reality.jurisdiction : "");

  const phaseGroups: Record<string, any[]> = {};
  checklist.forEach(item => { const p = item.phase || "General"; if (!phaseGroups[p]) phaseGroups[p] = []; phaseGroups[p].push(item); });

  const methodScores = dc?.inspection_reality?.method_scores || dc?.inspection_reality?.ndt_methods || {};
  const methodKeys = Object.keys(methodScores);
  const missingCoverage = dc?.inspection_reality?.missing_coverage || dc?.inspection_reality?.coverage_gaps || [];

  const tabs = ["workflow", "methods", "findings", "history", "raw"];

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto", fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0" }}>

      {/* FINDING MODAL */}
      {showFindingModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => { if (!findingSubmitting) setShowFindingModal(false); }}>
          <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "28px", width: "480px", maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: "18px", color: "#f8fafc", marginTop: 0, marginBottom: "4px" }}>Add Finding</h2>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>Finding appends to transcript and triggers re-evaluation.</div>

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px", marginTop: "14px" }}>Indication Type *</label>
            <input type="text" value={findingType} onChange={e => setFindingType(e.target.value)} placeholder="e.g. Crack, Corrosion, Porosity, Wall Loss" style={inputStyle} />

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px", marginTop: "14px" }}>Method</label>
            <select value={findingMethod} onChange={e => setFindingMethod(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {["VT", "UT", "MT", "PT", "RT", "ET", "AE"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px", marginTop: "14px" }}>Location</label>
            <input type="text" value={findingLocation} onChange={e => setFindingLocation(e.target.value)} placeholder="e.g. Weld joint 3B, nozzle N-2" style={inputStyle} />

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px", marginTop: "14px" }}>Severity</label>
            <select value={findingSeverity} onChange={e => setFindingSeverity(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {["minor", "major", "critical"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px", marginTop: "14px" }}>Dimensions</label>
            <input type="text" value={findingDimensions} onChange={e => setFindingDimensions(e.target.value)} placeholder="e.g. 3mm deep x 12mm long" style={inputStyle} />

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "4px", marginTop: "14px" }}>Notes</label>
            <textarea value={findingNotes} onChange={e => setFindingNotes(e.target.value)} placeholder="Additional observations..." style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} />

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={handleAddFinding} disabled={findingSubmitting || !findingType.trim()}
                style={{ flex: 1, padding: "10px", backgroundColor: findingSubmitting ? "#1e40af" : "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: findingSubmitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "600" }}>
                {findingSubmitting ? "Evaluating..." : "Add Finding + Re-evaluate"}
              </button>
              <button onClick={() => setShowFindingModal(false)} disabled={findingSubmitting}
                style={{ padding: "10px 16px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* BACK NAV */}
      <div style={{ marginBottom: "16px" }}>
        <button onClick={() => navigate("/cases")} style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>← Dashboard</button>
      </div>

      {/* HARD LOCK BANNER */}
      {isBlocked && (
        <div style={{ padding: "14px 20px", borderRadius: "10px", marginBottom: "16px", backgroundColor: "#ef444422", border: "2px solid #ef4444", textAlign: "center", fontSize: "14px", fontWeight: "700", color: "#ef4444", animation: "pulse 2s infinite" }}>
          ⛔ HARD LOCK — DISPOSITION: BLOCKED — DO NOT PROCEED WITHOUT RESOLUTION
        </div>
      )}

      {/* CASE HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "#f8fafc", margin: 0, marginBottom: "4px" }}>{getTitle(caseData)}</h1>
          <div style={{ fontSize: "13px", color: "#64748b" }}>{[caseData.asset_name, caseData.asset_type || caseData.asset_class, caseData.location].filter(Boolean).join(" · ")}</div>
          {caseData.case_id && <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{caseData.case_id}</div>}
        </div>
        <button onClick={() => setShowFindingModal(true)} style={{ padding: "8px 18px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>+ Add Finding</button>
      </div>

      {/* SUPERBRAIN STATUS BAR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Consequence", value: consequence || "—", color: consequenceColor(consequence) },
          { label: "Disposition", value: (disposition || "—").replace(/_/g, " "), color: dispositionColor(disposition) },
          { label: "Confidence", value: confidence > 0 ? Math.round(confidence * 100) + "%" : "—", color: confidence >= 0.8 ? "#22c55e" : confidence >= 0.6 ? "#eab308" : "#ef4444" },
          { label: "Mechanism", value: (mechanism || "—").replace(/_/g, " "), color: "#f8fafc" },
          { label: "Sufficiency", value: (sufficiency || "—").replace(/_/g, " "), color: "#f8fafc" },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{s.label}</div>
            <div style={{ fontSize: s.label === "Mechanism" || s.label === "Sufficiency" ? "14px" : "16px", fontWeight: "600", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* NEXT ACTION */}
      {nextAction && (
        <div style={{ ...cardStyle, borderLeft: "4px solid #3b82f6", backgroundColor: "#1e293b" }}>
          <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>NEXT ACTION</div>
          <div style={{ fontSize: "14px", color: "#f8fafc", fontWeight: "500" }}>{nextAction}</div>
        </div>
      )}

      {/* TAB BAR */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "8px 20px", backgroundColor: activeTab === tab ? "#1e293b" : "transparent", color: activeTab === tab ? "#f8fafc" : "#64748b", border: `1px solid ${activeTab === tab ? "#334155" : "transparent"}`, borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: activeTab === tab ? "600" : "400" }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* WORKFLOW TAB */}
      {activeTab === "workflow" && <>
        {confidenceSections.length > 0 && <div style={cardStyle}>
          <h3 style={{ fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "16px" }}>CONFIDENCE</h3>
          {confidenceSections.map(s => { const pct = Math.round(s.value * 100); const c = pct >= 80 ? "#22c55e" : pct >= 60 ? "#eab308" : "#ef4444"; return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <div style={{ width: "130px", fontSize: "13px", color: "#cbd5e1" }}>{s.label}</div>
              <div style={{ flex: 1, height: "10px", backgroundColor: "#1e293b", borderRadius: "5px", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", backgroundColor: c, borderRadius: "5px", transition: "width 0.5s" }} /></div>
              <div style={{ width: "45px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: c }}>{pct}%</div>
            </div>
          ); })}
        </div>}
        {authority && <div style={cardStyle}><h3 style={{ fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "8px" }}>AUTHORITY</h3><div style={{ fontSize: "14px", color: "#f8fafc" }}>{authority}</div></div>}
        {Object.keys(phaseGroups).length > 0 && <div style={cardStyle}>
          <h3 style={{ fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "16px" }}>PHASED STRATEGY</h3>
          {Object.keys(phaseGroups).map(phase => (
            <div key={phase} style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#f97316", marginBottom: "8px", textTransform: "uppercase" }}>{phase}</div>
              {phaseGroups[phase].map(item => (
                <div key={item.id} onClick={() => toggleChecklist(item.id, item.is_checked)} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 12px", cursor: "pointer", borderRadius: "6px", marginBottom: "4px", backgroundColor: item.is_checked ? "#22c55e11" : "transparent" }}>
                  <div style={{ width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0, marginTop: "1px", border: item.is_checked ? "2px solid #22c55e" : "2px solid #475569", backgroundColor: item.is_checked ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#fff", fontWeight: "700" }}>{item.is_checked ? "✓" : ""}</div>
                  <div style={{ fontSize: "13px", color: item.is_checked ? "#64748b" : "#e2e8f0", textDecoration: item.is_checked ? "line-through" : "none" }}>{item.item_text}</div>
                </div>
              ))}
            </div>
          ))}
        </div>}
        {recoveryQueue.length > 0 && <div style={cardStyle}>
          <h3 style={{ fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "12px" }}>RECOVERY QUEUE</h3>
          {recoveryQueue.map((item: any, idx: number) => { const text = typeof item === "string" ? item : (item.action || item.description || JSON.stringify(item)); return (
            <div key={idx} style={{ padding: "10px 14px", backgroundColor: "#1e293b", borderRadius: "8px", marginBottom: "8px", fontSize: "13px", color: "#e2e8f0", borderLeft: `3px solid ${idx === 0 ? "#3b82f6" : "#334155"}` }}><span style={{ color: "#64748b", marginRight: "8px" }}>{idx + 1}.</span>{text}</div>
          ); })}
        </div>}
      </>}

      {/* METHODS TAB */}
      {activeTab === "methods" && <>
        <div style={cardStyle}>
          <h3 style={{ fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "16px" }}>METHOD SCORES</h3>
          {methodKeys.length > 0 ? methodKeys.map(key => { const val = methodScores[key]; const score = typeof val === "number" ? val : (val.score || val.relevance || 0); const pct = Math.round(score * 100); const c = pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#64748b"; return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <div style={{ width: "60px", fontSize: "13px", fontWeight: "600", color: "#f8fafc" }}>{key.toUpperCase()}</div>
              <div style={{ flex: 1, height: "10px", backgroundColor: "#1e293b", borderRadius: "5px", overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", backgroundColor: c, borderRadius: "5px" }} /></div>
              <div style={{ width: "45px", textAlign: "right", fontSize: "13px", color: c }}>{pct}%</div>
            </div>
          ); }) : <div style={{ color: "#64748b" }}>No method scores available.</div>}
        </div>
        {missingCoverage.length > 0 && <div style={cardStyle}>
          <h3 style={{ fontSize: "14px", color: "#94a3b8", marginTop: 0, marginBottom: "12px" }}>MISSING COVERAGE</h3>
          {missingCoverage.map((gap: any, idx: number) => { const text = typeof gap === "string" ? gap : (gap.description || gap.method || JSON.stringify(gap)); return (
            <div key={idx} style={{ padding: "8px 14px", backgroundColor: "#ef444411", borderRadius: "6px", marginBottom: "6px", fontSize: "13px", color: "#fca5a5", borderLeft: "3px solid #ef4444" }}>{text}</div>
          ); })}
        </div>}
      </>}

      {/* FINDINGS TAB */}
      {activeTab === "findings" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>FINDINGS ({findings.length})</h3>
          <button onClick={() => setShowFindingModal(true)} style={{ padding: "6px 16px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>+ Add Finding</button>
        </div>
        {findings.length === 0 ? <div style={{ ...cardStyle, color: "#64748b", textAlign: "center" }}>No findings recorded yet.</div>
        : findings.map(f => (
          <div key={f.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ fontWeight: "600", color: "#f8fafc" }}>{f.indication_type}</div>
              <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600", backgroundColor: f.severity === "critical" ? "#ef444422" : f.severity === "major" ? "#f9731622" : "#22c55e22", color: f.severity === "critical" ? "#ef4444" : f.severity === "major" ? "#f97316" : "#22c55e" }}>{f.severity}</span>
            </div>
            <div style={{ fontSize: "13px", color: "#94a3b8" }}>{[f.method, f.location, f.dimensions].filter(Boolean).join(" · ")}</div>
            {f.notes && <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "6px" }}>{f.notes}</div>}
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>{formatDate(f.created_at)}</div>
          </div>
        ))}
      </>}

      {/* HISTORY TAB */}
      {activeTab === "history" && <>
        {history.length === 0 ? <div style={{ ...cardStyle, color: "#64748b", textAlign: "center" }}>No history entries.</div>
        : history.map(h => (
          <div key={h.id} style={{ padding: "12px 16px", borderLeft: "3px solid #334155", marginBottom: "8px", backgroundColor: "#0f172a", borderRadius: "0 8px 8px 0" }}>
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc" }}>{(h.action || "").replace(/_/g, " ").toUpperCase()}</div>
            <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "4px" }}>{h.details || ""}</div>
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>{formatDate(h.created_at)}</div>
          </div>
        ))}
      </>}

      {/* RAW TAB */}
      {activeTab === "raw" && <div style={cardStyle}><pre style={{ fontSize: "11px", color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "600px", overflow: "auto", margin: 0 }}>{dc ? JSON.stringify(dc, null, 2) : "No decision-core output available."}</pre></div>}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }`}</style>
    </div>
  );
}
