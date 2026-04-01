import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MethodBadge from "../components/MethodBadge";
import { DISPOSITION_COLORS } from "../lib/constants";

type TabName = "overview" | "evidence" | "physics" | "findings" | "rules" | "decision" | "teaching";

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<any | null>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [physics, setPhysics] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabName>("overview");
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
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
              <div className="empty-state"><p>No findings yet. Upload evidence and run the truth engine.</p></div>
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
                    {f.confidence != null && <div className="finding-confidence">Confidence: {Math.round(f.confidence * 100)}%</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            {rules.length === 0 ? (
              <div className="empty-state"><p>No rule evaluations yet.</p></div>
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
                    {r.engineering_basis_cited && <div className="rule-basis"><strong>Engineering basis:</strong> {r.engineering_basis_cited}</div>}
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
              </div>
            ) : <div className="empty-state"><p>Decision not yet generated. Upload evidence and run the truth engine.</p></div>}
          </div>
        )}

        {activeTab === "evidence" && <div className="empty-state"><p>Evidence upload coming in next deploy.</p></div>}
        {activeTab === "teaching" && <div className="empty-state"><p>Teaching intelligence coming in Phase 2.</p></div>}
      </div>
    </div>
  );
}
