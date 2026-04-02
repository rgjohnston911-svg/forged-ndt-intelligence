import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import MethodBadge from "../components/MethodBadge";
import { DISPOSITION_COLORS } from "../lib/constants";

type TabName = "overview" | "evidence" | "physics" | "findings" | "rules" | "decision" | "teaching";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState<any | null>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [physics, setPhysics] = useState<any | null>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabName>("overview");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");

  useEffect(() => { if (id) loadCase(); }, [id]);

  async function loadCase() {
    setLoading(true);
    const { data: c } = await supabase.from("inspection_cases").select("*").eq("id", id).single();
    setCaseData(c);
    const { data: f } = await supabase.from("findings").select("*").eq("case_id", id).order("created_at", { ascending: true });
    setFindings(f || []);
    const { data: r } = await supabase.from("rule_evaluations").select("*").eq("case_id", id).order("created_at", { ascending: true });
    setRules(r || []);
    const { data: p } = await supabase.from("physics_reality_models").select("*").eq("case_id", id).single();
    setPhysics(p);
    const { data: ev } = await supabase.from("evidence").select("*").eq("case_id", id).order("created_at", { ascending: true });
    setEvidence(ev || []);
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !id || !user) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop() || "jpg";
      const storagePath = caseData.org_id + "/" + id + "/" + Date.now() + "." + fileExt;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("ndt-evidence")
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      // Determine evidence type
      let evidenceType = "image";
      if (file.type.startsWith("video/")) evidenceType = "video";
      else if (file.type === "application/pdf") evidenceType = "document";

      // Record evidence metadata
      const resp = await fetch("/api/upload-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: id,
          evidence_type: evidenceType,
          storage_path: storagePath,
          mime_type: file.type,
          filename: file.name,
          uploaded_by: user.id,
          capture_source: "web_upload",
          metadata_json: { original_size: file.size }
        })
      });

      if (!resp.ok) {
        const errData = await resp.json();
        console.error("Evidence record error:", errData);
      }
    }

    setUploading(false);
    e.target.value = "";
    loadCase();
  }

  async function runAnalysis() {
    if (!id) return;
    setAnalyzing(true);
    setAnalysisStatus("Starting AI analysis pipeline...");

    try {
      setAnalysisStatus("Stage 1: GPT-4o observing evidence...");

      const resp = await fetch("/api/run-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: id, user_id: user?.id })
      });

      const data = await resp.json();

      if (data.ok) {
        setAnalysisStatus("Analysis complete!");
      } else {
        setAnalysisStatus("Analysis completed with some issues. Check results.");
      }

      // Reload all case data
      await loadCase();
    } catch (err: any) {
      setAnalysisStatus("Error: " + (err.message || "Analysis failed"));
    }

    setAnalyzing(false);
  }

  function getEvidenceUrl(storagePath: string) {
    const { data } = supabase.storage.from("ndt-evidence").getPublicUrl(storagePath);
    return data.publicUrl;
  }

  if (loading || !caseData) return <div className="page-loading">Loading case...</div>;

  const TABS: { key: TabName; label: string }[] = [
    { key: "overview", label: "Overview" }, { key: "evidence", label: "Evidence" },
    { key: "physics", label: "Physics Model" }, { key: "findings", label: "Findings" },
    { key: "rules", label: "Rules" }, { key: "decision", label: "Decision" },
    { key: "teaching", label: "Teaching" },
  ];

  return (
    <div className="page">
      <div className="case-header">
        <div className="case-header-top">
          <span className="case-number">{caseData.case_number}</span>
          <MethodBadge method={caseData.method} size="md" />
          <span className="case-status-badge">{caseData.status.replace(/_/g, " ")}</span>
        </div>
        <h1>{caseData.title}</h1>
        {caseData.final_disposition && (
          <div className="case-disposition-banner" style={{ borderColor: DISPOSITION_COLORS[caseData.final_disposition] || "#333" }}>
            <span className="disposition-label" style={{ color: DISPOSITION_COLORS[caseData.final_disposition] || "#333" }}>
              {caseData.final_disposition.replace(/_/g, " ").toUpperCase()}
            </span>
            {caseData.final_confidence != null && (
              <span className="disposition-confidence">{Math.round(caseData.final_confidence * 100)}% confidence</span>
            )}
          </div>
        )}
      </div>

      <div className="tab-bar">
        {TABS.map((tab) => (
          <button key={tab.key} className={"tab-btn" + (activeTab === tab.key ? " tab-active" : "")} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
            {tab.key === "findings" && findings.length > 0 && <span className="tab-count">{findings.length}</span>}
            {tab.key === "rules" && rules.length > 0 && <span className="tab-count">{rules.length}</span>}
            {tab.key === "evidence" && evidence.length > 0 && <span className="tab-count">{evidence.length}</span>}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === "overview" && (
          <div className="overview-grid">
            <div className="detail-section">
              <h3>Component</h3>
              <p>{caseData.component_name || "Not specified"}</p>
              {caseData.weld_id && <p>Weld: {caseData.weld_id}</p>}
              {caseData.joint_type && <p>Joint: {caseData.joint_type}</p>}
              {caseData.thickness_mm && <p>Thickness: {caseData.thickness_mm} mm</p>}
            </div>
            <div className="detail-section">
              <h3>Material & Loading</h3>
              <p>{caseData.material_class.replace(/_/g, " ")}</p>
              <p>Load: {caseData.load_condition.replace(/_/g, " ")}</p>
            </div>
            <div className="detail-section">
              <h3>Code Context</h3>
              <p>{[caseData.code_family, caseData.code_edition].filter(Boolean).join(" ") || "Not specified"}</p>
              {caseData.code_section && <p>Section: {caseData.code_section}</p>}
              {caseData.acceptance_table && <p>Table: {caseData.acceptance_table}</p>}
            </div>
            <div className="detail-section">
              <h3>4D Energy Model</h3>
              <p>Energy: {caseData.energy_type}</p>
              <p>Interaction: {caseData.interaction_type}</p>
              <p>Response: {caseData.response_type}</p>
              <p>Time: {caseData.time_dimension_type}</p>
            </div>
          </div>
        )}

        {activeTab === "evidence" && (
          <div>
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <label className="btn-primary" style={{ cursor: "pointer" }}>
                {uploading ? "Uploading..." : "Upload Evidence Photos"}
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
              </label>

              {evidence.length > 0 && !analyzing && (
                <button className="btn-primary" onClick={runAnalysis}
                  style={{ background: "#2E7D32" }}>
                  Run AI Analysis
                </button>
              )}

              {analyzing && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="loading-spinner" style={{ width: "20px", height: "20px" }} />
                  <span style={{ color: "#666", fontSize: "14px" }}>{analysisStatus}</span>
                </div>
              )}

              {!analyzing && analysisStatus && (
                <span style={{ color: "#2E7D32", fontSize: "14px", fontWeight: "600" }}>{analysisStatus}</span>
              )}
            </div>

            {evidence.length === 0 ? (
              <div className="empty-state">
                <p>No evidence uploaded yet. Upload photos of the weld, indication, or inspection screen.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "16px" }}>
                {evidence.map((ev) => (
                  <div key={ev.id} style={{
                    background: "var(--surface)", border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-lg)", overflow: "hidden"
                  }}>
                    {ev.storage_path && ev.evidence_type === "image" && (
                      <img
                        src={getEvidenceUrl(ev.storage_path)}
                        alt={ev.filename || "Evidence"}
                        style={{ width: "100%", height: "200px", objectFit: "cover" }}
                      />
                    )}
                    <div style={{ padding: "12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--dark)" }}>
                        {ev.filename || "Evidence"}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Type: {ev.evidence_type} | Source: {ev.capture_source || "upload"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                        {new Date(ev.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "physics" && (
          <div>
            {physics ? (
              <div className="physics-model">
                <div className="detail-section">
                  <h3>Probable Discontinuities (Predicted Before Inspection)</h3>
                  {physics.probable_discontinuities_json && physics.probable_discontinuities_json.length > 0 ? (
                    <div className="predictions-list">
                      {physics.probable_discontinuities_json.map((d: any, i: number) => (
                        <div key={i} className="prediction-card">
                          <strong>{d.type || d.label || "Unknown"}</strong>
                          {d.probability && <span className="prediction-prob">{d.probability}</span>}
                          {d.typical_location && <p>Likely location: {d.typical_location}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p>No predictions generated yet.</p>}
                </div>
                <div className="detail-section">
                  <h3>Method Capability Map</h3>
                  <pre className="json-display">{JSON.stringify(physics.method_capability_map_json, null, 2)}</pre>
                </div>
                <div className="detail-section">
                  <h3>Material Properties</h3>
                  <pre className="json-display">{JSON.stringify(physics.material_properties_json, null, 2)}</pre>
                </div>
              </div>
            ) : <div className="empty-state"><p>Physics model not yet generated.</p></div>}
          </div>
        )}

        {activeTab === "findings" && (
          <div>
            {findings.length === 0 ? (
              <div className="empty-state"><p>No findings yet. Upload evidence and run the AI analysis.</p></div>
            ) : (
              <div className="findings-list">
                {findings.map((f) => (
                  <div key={f.id} className="finding-card">
                    <div className="finding-header">
                      <span className={"finding-source finding-source-" + f.source}>{f.source}</span>
                      <span className="finding-type">{f.finding_type.replace(/_/g, " ")}</span>
                      {f.severity && <span className={"severity-badge severity-" + f.severity}>{f.severity}</span>}
                    </div>
                    <div className="finding-label">{f.label}</div>
                    {f.location_ref && <div className="finding-location">Location: {f.location_ref}</div>}
                    {f.confidence != null && <div className="finding-confidence">Confidence: {Math.round(f.confidence * 100)}%</div>}
                    {f.structured_json && f.structured_json.reasoning && (
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px", padding: "8px", background: "var(--bg)", borderRadius: "var(--radius)" }}>
                        {f.structured_json.reasoning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            {rules.length === 0 ? (
              <div className="empty-state"><p>No rule evaluations yet. Run the AI analysis first.</p></div>
            ) : (
              <div className="rules-list">
                {rules.map((r) => (
                  <div key={r.id} className={"rule-card rule-" + (r.passed === true ? "pass" : r.passed === false ? "fail" : "na")}>
                    <div className="rule-header">
                      <span className="rule-status-icon">{r.passed === true ? "\u2713" : r.passed === false ? "\u2717" : "\u2014"}</span>
                      <span className="rule-name">{r.rule_name}</span>
                      <span className="rule-class">{r.rule_class.replace(/_/g, " ")}</span>
                    </div>
                    <div className="rule-explanation">{r.explanation}</div>
                    {r.engineering_basis_cited && (
                      <div className="rule-basis"><strong>Engineering basis:</strong> {r.engineering_basis_cited}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "decision" && (
          <div>
            {caseData.truth_engine_summary ? (
              <div className="decision-panel">
                <div className="decision-what"><h3>WHAT</h3><p>{caseData.truth_engine_summary}</p></div>
                <div className="decision-why"><h3>WHY</h3><p>{caseData.final_decision_reason || "No detailed reason available."}</p></div>
                <div className="decision-how"><h3>HOW</h3><p>{caseData.final_disposition === "reject" ? "Repair, re-inspect, or escalate for adjudication per governing procedure and code." : "Proceed per procedure. Archive with evidence trail."}</p></div>
                {caseData.ai_openai_summary && (
                  <div className="detail-section" style={{ marginTop: "16px" }}>
                    <h3>GPT-4o Observation Summary</h3>
                    <p>{caseData.ai_openai_summary}</p>
                  </div>
                )}
                {caseData.ai_claude_summary && (
                  <div className="detail-section" style={{ marginTop: "16px" }}>
                    <h3>Claude Reasoning Summary</h3>
                    <p>{caseData.ai_claude_summary}</p>
                  </div>
                )}
              </div>
            ) : <div className="empty-state"><p>Decision not yet generated. Upload evidence and run the AI analysis.</p></div>}
          </div>
        )}

        {activeTab === "teaching" && (
          <div className="empty-state"><p>Teaching intelligence coming in Phase 2.</p></div>
        )}
      </div>
    </div>
  );
}
