import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { NDT_METHODS, METHOD_LABELS, METHOD_COLORS, MATERIAL_CLASSES, LOAD_CONDITIONS } from "../lib/constants";

export default function NewCase() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "", method: "" as string, material_class: "carbon_steel",
    load_condition: "static", code_family: "AWS", code_edition: "D1.1",
    code_section: "", acceptance_table: "", component_name: "",
    weld_id: "", joint_type: "", thickness_mm: "",
    procedure_ref: "", inspector_ref: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const body = {
        ...form,
        thickness_mm: form.thickness_mm ? parseFloat(form.thickness_mm) : null,
        org_id: profile.org_id,
        user_id: user?.id,
      };
      const data = await apiFetch("create-case", {
        method: "POST",
        body: JSON.stringify(body),
      });
      navigate("/cases/" + data.case.id);
    } catch (err: any) {
      setError(err.message || "Failed to create case");
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header"><h1>New Inspection Case</h1></div>

      {step === 1 && (
        <div className="form-section">
          <h2>Step 1: Select Method</h2>
          <p className="form-hint">What energy are you putting into the material?</p>
          <div className="method-grid">
            {NDT_METHODS.map((m) => (
              <button key={m}
                className={"method-select-btn" + (form.method === m ? " method-selected" : "")}
                style={{ borderColor: form.method === m ? METHOD_COLORS[m] : "#ddd" }}
                onClick={() => updateField("method", m)}>
                <span className="method-select-code" style={{ color: METHOD_COLORS[m] }}>{m}</span>
                <span className="method-select-name">{METHOD_LABELS[m]}</span>
              </button>
            ))}
          </div>
          {form.method && <button className="btn-primary" onClick={() => setStep(2)}>Continue</button>}
        </div>
      )}

      {step === 2 && (
        <div className="form-section">
          <h2>Step 2: Component & Material</h2>
          <p className="form-hint">Describe the physical reality. The system will build a physics model from this.</p>
          <div className="form-group">
            <label>Case Title</label>
            <input type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)}
              placeholder="e.g. V-101 Nozzle N-3 Weld Inspection" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Material Class</label>
              <select value={form.material_class} onChange={(e) => updateField("material_class", e.target.value)}>
                {MATERIAL_CLASSES.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Load Condition</label>
              <select value={form.load_condition} onChange={(e) => updateField("load_condition", e.target.value)}>
                {LOAD_CONDITIONS.map((l) => <option key={l} value={l}>{l.replace(/_/g, " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Thickness (mm)</label>
              <input type="number" step="0.1" value={form.thickness_mm}
                onChange={(e) => updateField("thickness_mm", e.target.value)} placeholder="e.g. 25.4" />
            </div>
            <div className="form-group">
              <label>Joint Type</label>
              <input type="text" value={form.joint_type}
                onChange={(e) => updateField("joint_type", e.target.value)} placeholder="e.g. Single-V Groove" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Component Name</label>
              <input type="text" value={form.component_name}
                onChange={(e) => updateField("component_name", e.target.value)} placeholder="e.g. Pressure Vessel V-101" />
            </div>
            <div className="form-group">
              <label>Weld ID</label>
              <input type="text" value={form.weld_id}
                onChange={(e) => updateField("weld_id", e.target.value)} placeholder="e.g. W-N3-001" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" onClick={() => setStep(3)} disabled={!form.title}>Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="form-section">
          <h2>Step 3: Code Context</h2>
          <p className="form-hint">Which code governs this inspection?</p>
          <div className="form-row">
            <div className="form-group">
              <label>Code Family</label>
              <input type="text" value={form.code_family} onChange={(e) => updateField("code_family", e.target.value)} placeholder="e.g. AWS, ASME, API" />
            </div>
            <div className="form-group">
              <label>Code Edition</label>
              <input type="text" value={form.code_edition} onChange={(e) => updateField("code_edition", e.target.value)} placeholder="e.g. D1.1, Section VIII" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Code Section</label>
              <input type="text" value={form.code_section} onChange={(e) => updateField("code_section", e.target.value)} placeholder="e.g. Section 6" />
            </div>
            <div className="form-group">
              <label>Acceptance Table</label>
              <input type="text" value={form.acceptance_table} onChange={(e) => updateField("acceptance_table", e.target.value)} placeholder="e.g. Table 6.1" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Procedure Reference</label>
              <input type="text" value={form.procedure_ref} onChange={(e) => updateField("procedure_ref", e.target.value)} placeholder="e.g. NDE-UT-001 Rev 3" />
            </div>
            <div className="form-group">
              <label>Inspector Reference</label>
              <input type="text" value={form.inspector_ref} onChange={(e) => updateField("inspector_ref", e.target.value)} placeholder="e.g. CWI #12345" />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Creating case & building physics model..." : "Create Case"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
