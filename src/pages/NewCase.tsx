import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import {
  NDT_METHODS, METHOD_LABELS, METHOD_COLORS, MATERIAL_CLASSES, LOAD_CONDITIONS,
  WELDING_PROCESSES, WELDING_PROCESS_LABELS, WELD_POSITIONS,
  JOINT_TYPES, JOINT_TYPE_LABELS, HEAT_INPUT_LEVELS, TRAVEL_SPEED_LEVELS
} from "../lib/constants";

export default function NewCase() {
  var { user, profile } = useAuth();
  var navigate = useNavigate();
  var [step, setStep] = useState(1);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState("");

  var [form, setForm] = useState({
    title: "", method: "" as string, material_class: "carbon_steel",
    load_condition: "static", code_family: "AWS_D1_1", code_edition: "",
    code_section: "", acceptance_table: "", component_name: "",
    weld_id: "", joint_type: "fillet", thickness_mm: "",
    procedure_ref: "", inspector_ref: "",
    welding_process: "unknown", weld_position: "unknown",
    heat_input: "unknown", travel_speed: "unknown",
    interpass_cleaning: "unknown", preheat_used: "unknown",
    passes: "",
  });

  function updateField(field: string, value: string) {
    setForm(function(prev) { return Object.assign({}, prev, { [field]: value }); });
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      var body = {
        title: form.title,
        method: form.method,
        material_class: form.material_class,
        load_condition: form.load_condition,
        code_family: form.code_family,
        code_edition: form.code_edition,
        code_section: form.code_section,
        acceptance_table: form.acceptance_table,
        component_name: form.component_name,
        weld_id: form.weld_id,
        joint_type: form.joint_type,
        thickness_mm: form.thickness_mm ? parseFloat(form.thickness_mm) : null,
        procedure_ref: form.procedure_ref,
        inspector_ref: form.inspector_ref,
        welding_process: form.welding_process,
        weld_position: form.weld_position,
        heat_input: form.heat_input,
        travel_speed: form.travel_speed,
        interpass_cleaning: form.interpass_cleaning,
        preheat_used: form.preheat_used,
        passes: form.passes ? parseInt(form.passes) : null,
        org_id: profile.org_id,
        user_id: user?.id,
      };
      var data = await apiFetch("create-case", {
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
            {NDT_METHODS.map(function(m) {
              return (
                <button key={m}
                  className={"method-select-btn" + (form.method === m ? " method-selected" : "")}
                  style={{ borderColor: form.method === m ? METHOD_COLORS[m] : "#ddd" }}
                  onClick={function() { updateField("method", m); }}>
                  <span className="method-select-code" style={{ color: METHOD_COLORS[m] }}>{m}</span>
                  <span className="method-select-name">{METHOD_LABELS[m]}</span>
                </button>
              );
            })}
          </div>
          {form.method && <button className="btn-primary" onClick={function() { setStep(2); }}>Continue</button>}
        </div>
      )}

      {step === 2 && (
        <div className="form-section">
          <h2>Step 2: Component &amp; Material</h2>
          <p className="form-hint">Describe the physical reality. The system builds a physics model from this.</p>
          <div className="form-group">
            <label>Case Title</label>
            <input type="text" value={form.title} onChange={function(e) { updateField("title", e.target.value); }}
              placeholder="e.g. V-101 Nozzle N-3 Weld Inspection" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Material Class</label>
              <select value={form.material_class} onChange={function(e) { updateField("material_class", e.target.value); }}>
                {MATERIAL_CLASSES.map(function(m) { return <option key={m} value={m}>{m.replace(/_/g, " ")}</option>; })}
              </select>
            </div>
            <div className="form-group">
              <label>Load Condition</label>
              <select value={form.load_condition} onChange={function(e) { updateField("load_condition", e.target.value); }}>
                {LOAD_CONDITIONS.map(function(l) { return <option key={l} value={l}>{l.replace(/_/g, " ")}</option>; })}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Thickness (mm)</label>
              <input type="number" step="0.1" value={form.thickness_mm}
                onChange={function(e) { updateField("thickness_mm", e.target.value); }} placeholder="e.g. 25.4" />
            </div>
            <div className="form-group">
              <label>Joint Type</label>
              <select value={form.joint_type} onChange={function(e) { updateField("joint_type", e.target.value); }}>
                {JOINT_TYPES.map(function(j) { return <option key={j} value={j}>{JOINT_TYPE_LABELS[j] || j}</option>; })}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Component Name</label>
              <input type="text" value={form.component_name}
                onChange={function(e) { updateField("component_name", e.target.value); }} placeholder="e.g. Pressure Vessel V-101" />
            </div>
            <div className="form-group">
              <label>Weld ID</label>
              <input type="text" value={form.weld_id}
                onChange={function(e) { updateField("weld_id", e.target.value); }} placeholder="e.g. W-N3-001" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={function() { setStep(1); }}>Back</button>
            <button className="btn-primary" onClick={function() { setStep(3); }} disabled={!form.title}>Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="form-section">
          <h2>Step 3: Welding Process Context</h2>
          <p className="form-hint">This information drives the physics engine. The more you provide, the smarter the system gets.</p>
          <div className="form-row">
            <div className="form-group">
              <label>Welding Process</label>
              <select value={form.welding_process} onChange={function(e) { updateField("welding_process", e.target.value); }}>
                {WELDING_PROCESSES.map(function(p) { return <option key={p} value={p}>{WELDING_PROCESS_LABELS[p] || p}</option>; })}
              </select>
            </div>
            <div className="form-group">
              <label>Weld Position</label>
              <select value={form.weld_position} onChange={function(e) { updateField("weld_position", e.target.value); }}>
                {WELD_POSITIONS.map(function(p) { return <option key={p} value={p}>{p}</option>; })}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Heat Input</label>
              <select value={form.heat_input} onChange={function(e) { updateField("heat_input", e.target.value); }}>
                {HEAT_INPUT_LEVELS.map(function(h) { return <option key={h} value={h}>{h.replace(/_/g, " ")}</option>; })}
              </select>
            </div>
            <div className="form-group">
              <label>Travel Speed</label>
              <select value={form.travel_speed} onChange={function(e) { updateField("travel_speed", e.target.value); }}>
                {TRAVEL_SPEED_LEVELS.map(function(s) { return <option key={s} value={s}>{s.replace(/_/g, " ")}</option>; })}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Interpass Cleaning</label>
              <select value={form.interpass_cleaning} onChange={function(e) { updateField("interpass_cleaning", e.target.value); }}>
                <option value="unknown">Unknown</option>
                <option value="yes">Yes - Confirmed</option>
                <option value="no">No - Not Performed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Number of Passes</label>
              <input type="number" min="1" max="50" value={form.passes}
                onChange={function(e) { updateField("passes", e.target.value); }} placeholder="e.g. 3" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Preheat Used</label>
              <select value={form.preheat_used} onChange={function(e) { updateField("preheat_used", e.target.value); }}>
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={function() { setStep(2); }}>Back</button>
            <button className="btn-primary" onClick={function() { setStep(4); }}>Continue</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="form-section">
          <h2>Step 4: Code Context</h2>
          <p className="form-hint">Which code governs this inspection?</p>
          <div className="form-row">
            <div className="form-group">
              <label>Code Family</label>
              <select value={form.code_family} onChange={function(e) { updateField("code_family", e.target.value); }}>
                <option value="AWS_D1_1">AWS D1.1 - Structural Welding</option>
                <option value="ASME_VIII">ASME Section VIII - Pressure Vessels</option>
                <option value="API_1104">API 1104 - Pipeline Welding</option>
                <option value="AWS_D1_5">AWS D1.5 - Bridge Welding</option>
                <option value="ASME_B31_3">ASME B31.3 - Process Piping</option>
                <option value="GENERIC">Other / Generic</option>
              </select>
            </div>
            <div className="form-group">
              <label>Code Edition / Section</label>
              <input type="text" value={form.code_edition} onChange={function(e) { updateField("code_edition", e.target.value); }} placeholder="e.g. 2020 Edition" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Acceptance Table</label>
              <input type="text" value={form.acceptance_table} onChange={function(e) { updateField("acceptance_table", e.target.value); }} placeholder="e.g. Table 6.1" />
            </div>
            <div className="form-group">
              <label>Procedure Reference</label>
              <input type="text" value={form.procedure_ref} onChange={function(e) { updateField("procedure_ref", e.target.value); }} placeholder="e.g. NDE-VT-001 Rev 3" />
            </div>
          </div>
          <div className="form-group">
            <label>Inspector Reference</label>
            <input type="text" value={form.inspector_ref} onChange={function(e) { updateField("inspector_ref", e.target.value); }} placeholder="e.g. CWI #12345 / Level II #67890" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button className="btn-secondary" onClick={function() { setStep(3); }}>Back</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Creating case & building physics model..." : "Create Case"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
